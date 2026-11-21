/**
 * Haros HRMIS — Electron Main Process (Windows Desktop Host)
 *
 * Responsibilities:
 *  - Creates the application window loading the bundled Vite build (dist/).
 *  - Hosts an embedded SQLite database (sql.js / SQLite WASM) persisted to
 *    %LOCALAPPDATA%\HRMIS\Database\hrmis.db.
 *  - Applies SQL migrations transactionally with hrmis_schema_migrations bookkeeping.
 *  - Mirrors the renderer's key/value document store into SQLite and serves
 *    the initial snapshot back to the renderer before app boot.
 *  - Exposes a restricted IPC bridge consumed by electron/preload.cjs.
 *  - Guarantees atomic database writes (hrmis.db.tmp -> rename), periodic and
 *    quit-time flushes, and quarantine of corrupt database files.
 *
 * Fully offline: no network access is required or performed by this process.
 */

const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const PRODUCT_NAME = 'Haros HRMIS';
const DATA_ROOT_NAME = 'HRMIS';
const DB_FILE_NAME = 'hrmis.db';
const KV_TABLE = 'hrmis_kv';
const FLUSH_DEBOUNCE_MS = 1500;
const FLUSH_INTERVAL_MS = 15000;
const LOG_FILE = 'hrmis-main.log';

// ---------------------------------------------------------------------------
// Logging (also mirrored to %LOCALAPPDATA%\HRMIS\Logs\hrmis-main.log)
// ---------------------------------------------------------------------------
let logStream = null;
function initLogging() {
  try {
    const logsDir = path.join(getDataRoot(), 'Logs');
    fs.mkdirSync(logsDir, { recursive: true });
    logStream = fs.createWriteStream(path.join(logsDir, LOG_FILE), { flags: 'a' });
  } catch {
    logStream = null;
  }
}
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
  try { process.stdout.write(line); } catch {}
  try { logStream && logStream.write(line); } catch {}
}

// ---------------------------------------------------------------------------
// Data directories (%LOCALAPPDATA%\HRMIS\...)
// ---------------------------------------------------------------------------
let DATA_ROOT = null;
function getDataRoot() {
  if (DATA_ROOT) return DATA_ROOT;
  const localAppData =
    process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  DATA_ROOT = path.join(localAppData, DATA_ROOT_NAME);
  return DATA_ROOT;
}
function getDataPaths() {
  const root = getDataRoot();
  return {
    root,
    databaseDir: path.join(root, 'Database'),
    databaseFile: path.join(root, 'Database', DB_FILE_NAME),
    backupsDir: path.join(root, 'Backups'),
    documentsDir: path.join(root, 'Documents'),
    reportsDir: path.join(root, 'Reports'),
    logsDir: path.join(root, 'Logs'),
    attachmentsDir: path.join(root, 'Attachments'),
  };
}
function ensureDataDirectories() {
  const p = getDataPaths();
  for (const dir of [p.databaseDir, p.backupsDir, p.documentsDir, p.reportsDir, p.logsDir, p.attachmentsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return p;
}

// Electron's default userData lives under %APPDATA% (Roaming). Redirect it so
// Chromium profile data also stays inside the documented %LOCALAPPDATA%\HRMIS
// tree and is preserved across reinstalls exactly like the database.
try {
  app.setPath('userData', getDataRoot());
} catch {}

// ---------------------------------------------------------------------------
// SQLite engine (sql.js — SQLite compiled to WebAssembly)
// ---------------------------------------------------------------------------
let SQL = null;
let db = null;
let stmts = null;
let saveTimer = null;

function wasmAssetCandidates() {
  const candidates = [];
  // Packaged (asar): file shipped under electron/assets via electron-builder files
  candidates.push(path.join(__dirname, 'assets', 'sql-wasm.wasm'));
  // Unpacked / dev layouts
  candidates.push(path.join(process.resourcesPath || '', 'app.asar.unpacked', 'electron', 'assets', 'sql-wasm.wasm'));
  candidates.push(path.join(__dirname, '..', 'electron', 'assets', 'sql-wasm.wasm'));
  candidates.push(path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'));
  return candidates;
}

async function initSqlJs() {
  const initSqlJs = require('sql.js');
  const locateFile = (file) => {
    for (const candidate of wasmAssetCandidates()) {
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch {}
    }
    return file;
  };
  SQL = await initSqlJs({ locateFile });
}

function ensureColumns(table, columns) {
  try {
    const res = db.exec(`PRAGMA table_info(${table})`);
    if (!res.length) return;
    const existing = new Set(res[0].values.map((r) => String(r[1])));
    for (const [col, type] of Object.entries(columns)) {
      if (!existing.has(col)) {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
        log(`schema reconciled: ${table}.${col} added`);
      }
    }
  } catch (err) {
    log(`ensureColumns(${table}) failed: ${err.message}`);
  }
}

function prepareStatements() {
  stmts = {
    migrationCheck: db.prepare('SELECT version FROM hrmis_schema_migrations WHERE version = ?'),
    insertMigration: db.prepare('INSERT INTO hrmis_schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'),
    upsertMetadata: db.prepare(
      'INSERT INTO hrmis_metadata (key, value, updated_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    ),
    kvGet: db.prepare('SELECT value FROM hrmis_kv WHERE key = ?'),
    kvAll: db.prepare('SELECT key, value FROM hrmis_kv ORDER BY key'),
    kvUpsert: db.prepare(
      'INSERT INTO hrmis_kv (key, value, updated_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    ),
    kvDelete: db.prepare('DELETE FROM hrmis_kv WHERE key = ?'),
    registryUpsert: db.prepare(
      'INSERT INTO hrmis_registry (key, value, updated_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    ),
    logChange: db.prepare(
      'INSERT INTO hrmis_change_log (entity, action, record_key, detail, created_at) VALUES (?, ?, ?, ?, ?)'
    ),
  };
}

function migrationFiles() {
  const dirs = [
    path.join(__dirname, '..', 'database', 'migrations'),       // dev / unpacked
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'database', 'migrations'),
    path.join(__dirname, 'database', 'migrations'),
  ];
  for (const dir of dirs) {
    try {
      if (fs.existsSync(dir)) {
        return fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
      }
    } catch {}
  }
  return [];
}

function migrationSql(name) {
  const dirs = [
    path.join(__dirname, '..', 'database', 'migrations'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'database', 'migrations'),
    path.join(__dirname, 'database', 'migrations'),
  ];
  for (const dir of dirs) {
    const file = path.join(dir, name);
    try {
      if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
    } catch {}
  }
  return null;
}

function appliedVersions() {
  const rows = db.exec('SELECT version FROM hrmis_schema_migrations ORDER BY version');
  if (!rows.length) return new Set();
  return new Set(rows[0].values.map((r) => String(r[0])));
}

function runMigrations() {
  const files = migrationFiles();
  const applied = appliedVersions();
  const now = new Date().toISOString();
  let count = 0;
  for (const file of files) {
    const version = file.replace(/\.sql$/i, '');
    if (applied.has(version)) continue;
    const sqlText = migrationSql(file);
    if (!sqlText) continue;
    db.run('BEGIN');
    try {
      db.run(sqlText);
      stmts.insertMigration.run([version, file, now]);
      db.run('COMMIT');
      count++;
      log(`migration applied: ${file}`);
    } catch (err) {
      try { db.run('ROLLBACK'); } catch {}
      log(`migration FAILED: ${file} -> ${err.message}`);
      throw err;
    }
  }
  return count;
}

function loadOrCreateDatabase() {
  const paths = ensureDataDirectories();
  const dbPath = paths.databaseFile;
  let created = false;

  if (fs.existsSync(dbPath)) {
    try {
      const bytes = fs.readFileSync(dbPath);
      db = new SQL.Database(bytes);
      // sanity check: must contain our schema marker table or be a valid sqlite db
      db.exec('SELECT name FROM sqlite_master LIMIT 1');
      log(`database loaded: ${dbPath} (${bytes.length} bytes)`);
    } catch (err) {
      // Quarantine corrupt database — NEVER silently overwrite production data
      const quarantine = path.join(
        paths.backupsDir,
        `hrmis-corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}.db`
      );
      try { fs.copyFileSync(dbPath, quarantine); } catch {}
      log(`database corrupt (${err.message}); quarantined copy -> ${quarantine}; creating fresh database`);
      try { db && db.close(); } catch {}
      db = new SQL.Database();
      created = true;
    }
  } else {
    db = new SQL.Database();
    created = true;
    log(`database created: ${dbPath}`);
  }

  // Core schema (idempotent) — mirrors the migration baseline so a fresh file
  // always has the metadata/kv/registry/log tables even before migrations run.
  db.run(`
    CREATE TABLE IF NOT EXISTS hrmis_schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hrmis_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hrmis_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hrmis_registry (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hrmis_change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      action TEXT NOT NULL,
      record_key TEXT,
      detail TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_change_log_created ON hrmis_change_log(created_at);
  `);

  // Older databases may carry same-named tables with a different column set
  // (e.g. a previous hrmis_schema_migrations without name/applied_at). Additively
  // reconcile columns so upgrades never fail on pre-existing structures.
  ensureColumns('hrmis_schema_migrations', {
    name: 'TEXT',
    applied_at: 'TEXT',
  });
  ensureColumns('hrmis_metadata', { updated_at: 'TEXT NOT NULL DEFAULT \'\'' });
  ensureColumns('hrmis_kv', { updated_at: 'TEXT NOT NULL DEFAULT \'\'' });
  ensureColumns('hrmis_registry', { updated_at: 'TEXT NOT NULL DEFAULT \'\'' });
  ensureColumns('hrmis_change_log', {
    record_key: 'TEXT',
    detail: 'TEXT',
    created_at: 'TEXT NOT NULL DEFAULT \'\'',
  });

  prepareStatements();
  const appliedCount = runMigrations();

  // Application metadata / settings initialization (never overwrites existing)
  const now = new Date().toISOString();
  const metaPairs = [
    ['app_name', PRODUCT_NAME],
    ['app_version', app.getVersion ? app.getVersion() : '2.5.0'],
    ['storage_engine', 'SQLite (sql.js WASM)'],
    ['database_file', paths.databaseFile],
    ['initialized_at', now],
    ['platform', `${process.platform}-${process.arch}`],
    ['electron', process.versions.electron || 'unknown'],
    ['node', process.versions.node || 'unknown'],
  ];
  for (const [k, v] of metaPairs) {
    stmts.upsertMetadata.run([k, String(v), now]);
  }

  // One-time import of the legacy per-table schema used by earlier builds
  // (t_haros_hrmis_v2_<table>_<hash>(seq,data) + meta kv: keys) into hrmis_kv,
  // so upgrades preserve all employee/HR data. Legacy tables are left intact.
  try {
    importLegacyDatabase();
  } catch (err) {
    log(`legacy import failed (non-fatal): ${err.message}`);
  }

  if (created || appliedCount > 0) {
    // Automatic pre-upgrade backup marker before schema changes take effect
    if (appliedCount > 0 && !created) {
      try {
        const bytes = db.export();
        const backupPath = path.join(
          paths.backupsDir,
          `pre_upgrade_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`
        );
        const tmp = backupPath + '.tmp';
        fs.writeFileSync(tmp, Buffer.from(bytes));
        fs.renameSync(tmp, backupPath);
        log(`pre-upgrade backup written: ${backupPath}`);
      } catch (err) {
        log(`pre-upgrade backup failed: ${err.message}`);
      }
    }
    saveDatabaseNow();
  }
  return { created, appliedCount };
}

// ---------------------------------------------------------------------------
// Legacy schema import (per-table t_* layout + meta kv: keys -> hrmis_kv)
// ---------------------------------------------------------------------------
// Canonical renderer storage keys (must match src/db/storage.ts table names).
// Legacy builds wrote some tables under all-lowercase names; normalize on import.
const KNOWN_STORAGE_KEYS = [
  'activationAdmins','applicationExpiryConfig','attendanceRecords','auditLogs',
  'backupHistory','clearanceItems','computerRegistrations','departments',
  'disciplinaryCases','documents','employees','employmentInfo','establishment',
  'gradeLevels','leaveApplications','leaveBalances','leaveTypes','mdas',
  'memberships','movementHistory','movements','payrollAssignments',
  'payrollComponents','payrollRuns','payslips','performanceAppraisals',
  'personalInfo','priorHistory','promotionRecommendations','qualifications',
  'recruitmentApplicants','roles','routePermissions','salaryGradeSteps',
  'salaryStructures','separationRecords','skills','systemSettings',
  'trainingCapabilities','trainingNominations','trainingPrograms','units','users',
];
const KNOWN_KEY_LOWER = new Map(KNOWN_STORAGE_KEYS.map((k) => [k.toLowerCase(), k]));
function bareTableName(candidate) {
  const s = String(candidate);
  return s.startsWith('haros_hrmis_v2_') ? s.slice('haros_hrmis_v2_'.length) : s;
}
function canonicalStorageKey(candidate) {
  const bare = bareTableName(candidate);
  const canonical = KNOWN_KEY_LOWER.get(bare.toLowerCase());
  return canonical ? `haros_hrmis_v2_${canonical}` : candidate;
}
function isKnownTableKey(candidate) {
  // meta 'kv:' values may carry the prefix or the bare table name
  return KNOWN_KEY_LOWER.has(bareTableName(candidate).toLowerCase());
}

function importLegacyDatabase() {
  const kvCountRes = db.exec('SELECT COUNT(*) AS c FROM hrmis_kv');
  if (kvCountRes.length && Number(kvCountRes[0].values[0][0]) > 0) return; // already populated

  const tablesRes = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 't_haros_hrmis_%'"
  );
  const legacyTables = tablesRes.length ? tablesRes[0].values.map((r) => String(r[0])) : [];
  const metaExists = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'");
  if (legacyTables.length === 0 && !metaExists.length) return;

  const now = new Date().toISOString();
  let imported = 0;

  for (const table of legacyTables) {
    // t_haros_hrmis_v2_employees_c386c651 -> haros_hrmis_v2_employees
    const m = table.match(/^t_(haros_hrmis_v\d+_.+?)_[0-9a-f]{8}$/);
    if (!m) continue;
    const storageKey = canonicalStorageKey(m[1]);
    try {
      const res = db.exec(`SELECT data FROM ${table} ORDER BY seq`);
      if (!res.length) continue;
      const rows = res[0].values.map((r) => String(r[0]));
      let payload;
      if (rows.length === 1) {
        const parsed = JSON.parse(rows[0]);
        payload = Array.isArray(parsed) ? rows[0] : `[${rows[0]}]`;
      } else {
        payload = `[${rows.join(',')}]`;
      }
      // sanity: payload must be a JSON array
      const check = JSON.parse(payload);
      if (!Array.isArray(check)) continue;
      stmts.kvUpsert.run([storageKey, payload, now]);
      imported++;
    } catch (err) {
      log(`legacy import skip ${table}: ${err.message}`);
    }
  }

  if (metaExists.length) {
    try {
      // meta 'kv:<key>' rows are ambiguous in legacy databases: scalar values
      // (e.g. kv:haros_current_user -> 'admin') coexist with per-table row
      // COUNTS (e.g. kv:haros_hrmis_v2_employees -> '0'). Import a meta value
      // only when no corresponding t_* table exists — table data always wins.
      const res = db.exec("SELECT key, value FROM meta WHERE key LIKE 'kv:%'");
      if (res.length) {
        for (const [k, v] of res[0].values) {
          const bare = String(k).slice(3);
          const val = String(v);
          // Skip anything that names a known table — those meta rows hold row
          // counts, not data (the t_* tables are authoritative). Also skip
          // bare-integer meta values: in legacy DBs they are per-table row
          // counts for keys whose t_* table name didn't match the canonical
          // list (e.g. 'appraisals' vs 'performanceAppraisals').
          if (isKnownTableKey(bare)) continue;
          if (/^\d+$/.test(val)) continue;
          // localStorage values must be JSON — quote bare scalars so the
          // renderer's JSON.parse-based getItem() reads them correctly.
          let stored = val;
          try { JSON.parse(val); } catch { stored = JSON.stringify(val); }
          stmts.kvUpsert.run([bare, stored, now]);
          imported++;
        }
      }
      const reg = db.exec("SELECT key, value FROM meta WHERE key NOT LIKE 'kv:%'");
      if (reg.length) {
        for (const [k, v] of reg[0].values) {
          stmts.registryUpsert.run([String(k), String(v), now]);
        }
      }
    } catch (err) {
      log(`legacy meta import failed: ${err.message}`);
    }
  }

  if (imported > 0) {
    stmts.upsertMetadata.run(['legacy_import_v1', `${imported} keys`, now]);
    stmts.logChange.run(['system', 'legacy_import', 'hrmis_kv', `${imported} keys imported`, now]);
    saveDatabaseNow();
    log(`legacy database imported: ${imported} keys -> hrmis_kv`);
  }
}

// ---------------------------------------------------------------------------
// Persistence (atomic export -> hrmis.db)
// ---------------------------------------------------------------------------
function saveDatabaseNow() {
  if (!db || !SQL) return false;
  try {
    // Export BEFORE finalizing any statements — export() needs the live db.
    const data = db.export();
    const paths = getDataPaths();
    fs.mkdirSync(paths.databaseDir, { recursive: true });
    const tmpPath = paths.databaseFile + '.tmp';
    fs.writeFileSync(tmpPath, Buffer.from(data));
    fs.renameSync(tmpPath, paths.databaseFile);
    return true;
  } catch (err) {
    log(`Failed to persist ${DB_FILE_NAME}: ${err.message}`);
    return false;
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveDatabaseNow();
  }, FLUSH_DEBOUNCE_MS);
}

function flushNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  return saveDatabaseNow();
}

// ---------------------------------------------------------------------------
// KV snapshot bridge (renderer document store <-> SQLite hrmis_kv)
// ---------------------------------------------------------------------------
function getKvSnapshot() {
  const out = {};
  try {
    // sql.js Statement API: step() + getAsObject() (no .all())
    while (stmts.kvAll.step()) {
      const row = stmts.kvAll.getAsObject();
      if (typeof row.key === 'string') out[row.key] = String(row.value);
    }
    stmts.kvAll.reset();
  } catch (err) {
    try { stmts.kvAll.reset(); } catch {}
    // fallback: raw exec
    try {
      const res = db.exec('SELECT key, value FROM hrmis_kv ORDER BY key');
      if (res.length) {
        for (const r of res[0].values) {
          if (typeof r[0] === 'string') out[r[0]] = String(r[1]);
        }
      }
    } catch (e2) {
      log(`kv snapshot error: ${err.message}; fallback: ${e2.message}`);
    }
  }
  return out;
}

function kvSet(fullKey, value) {
  try {
    stmts.kvUpsert.run([String(fullKey), String(value), new Date().toISOString()]);
    scheduleSave();
    return true;
  } catch (err) {
    log(`kv set error: ${err.message}`);
    return false;
  }
}

function kvRemove(fullKey) {
  try {
    stmts.kvDelete.run([String(fullKey)]);
    scheduleSave();
    return true;
  } catch (err) {
    log(`kv remove error: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Machine identity (native Windows info for the licensing fingerprint)
// ---------------------------------------------------------------------------
let cachedHardwareUuid = null;
function getSystemUuid() {
  if (cachedHardwareUuid !== null) return cachedHardwareUuid;
  cachedHardwareUuid = '';
  if (process.platform === 'win32') {
    try {
      const out = require('child_process').execSync(
        'powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"',
        { timeout: 8000, encoding: 'utf8', windowsHide: true }
      ).trim();
      if (/^[0-9A-Fa-f-]{36}$/.test(out)) cachedHardwareUuid = out.toUpperCase();
    } catch {
      try {
        const out = require('child_process').execSync('wmic csproduct get uuid /value', {
          timeout: 8000, encoding: 'utf8', windowsHide: true,
        });
        const m = out.match(/UUID=([0-9A-Fa-f-]{36})/);
        if (m) cachedHardwareUuid = m[1].toUpperCase();
      } catch {}
    }
  }
  return cachedHardwareUuid;
}

function getMachineInfo() {
  const computerName = (os.hostname() || 'UNKNOWN').toUpperCase();
  let hardwareId = '';
  try {
    // Prefer the stable system UUID (matches registrations created by earlier
    // builds); fall back to a deterministic hash of OS identity signals.
    const uuid = getSystemUuid();
    hardwareId = uuid || 'HW-' + crypto.createHash('sha256')
      .update([process.env.COMPUTERNAME, os.hostname(), os.platform() + os.arch()].filter(Boolean).join('::'))
      .digest('hex').slice(0, 16).toUpperCase();
  } catch {
    hardwareId = 'HW-UNKNOWN';
  }
  return {
    computerName,
    hardwareName: computerName,
    hardwareId,
    osPlatform: `${os.type()} ${os.release()} (${os.arch()})`,
    platform: process.platform,
    arch: process.arch,
  };
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
function registerIpc() {
  ipcMain.handle('hrmis:get-data-paths', () => getDataPaths());
  ipcMain.handle('hrmis:get-machine-info', () => getMachineInfo());
  ipcMain.handle('hrmis:get-computer-name', () => os.hostname());
  ipcMain.handle('hrmis:get-initial-snapshot', () => getKvSnapshot());
  // Synchronous variant: the renderer hydrates localStorage during module
  // evaluation, before promise-based IPC could resolve.
  ipcMain.on('hrmis:get-initial-snapshot-sync', (e) => {
    e.returnValue = getKvSnapshot();
  });
  ipcMain.handle('hrmis:kv-set', (_e, key, value) => kvSet(key, value));
  ipcMain.handle('hrmis:kv-remove', (_e, key) => kvRemove(key));
  ipcMain.handle('hrmis:db-flush', () => flushNow());
  ipcMain.handle('hrmis:db-stats', () => {
    try {
      const res = db.exec('SELECT COUNT(*) AS c FROM hrmis_kv');
      const kvCount = res.length ? res[0].values[0][0] : 0;
      const mig = db.exec('SELECT COUNT(*) AS c FROM hrmis_schema_migrations');
      const migCount = mig.length ? mig[0].values[0][0] : 0;
      const meta = db.exec('SELECT key, value FROM hrmis_metadata');
      const metadata = {};
      if (meta.length) meta[0].values.forEach((r) => { metadata[r[0]] = r[1]; });
      return { ok: true, kvCount, migrationCount: migCount, metadata, dbPath: getDataPaths().databaseFile };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
  ipcMain.handle('hrmis:save-file', async (_e, opts) => {
    try {
      const paths = getDataPaths();
      const defaultDir = opts && opts.kind === 'report' ? paths.reportsDir
        : opts && opts.kind === 'backup' ? paths.backupsDir
        : paths.documentsDir;
      const result = await dialog.showSaveDialog(mainWindow, {
        title: opts?.title || 'Save File',
        defaultPath: path.join(defaultDir, opts?.defaultName || 'export.txt'),
        filters: opts?.filters || [{ name: 'All Files', extensions: ['*'] }],
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      const content = Buffer.isBuffer(opts?.content)
        ? opts.content
        : Buffer.from(String(opts?.content ?? ''), opts?.encoding || 'utf8');
      fs.mkdirSync(path.dirname(result.filePath), { recursive: true });
      fs.writeFileSync(result.filePath, content);
      return { canceled: false, filePath: result.filePath };
    } catch (err) {
      return { canceled: false, error: err.message };
    }
  });
  ipcMain.handle('hrmis:open-path', async (_e, targetPath) => {
    try {
      const p = String(targetPath || '');
      // Only allow opening paths inside the HRMIS data root (or registered dirs).
      // Boundary check: the resolved path must equal the root or sit strictly
      // beneath it — a bare startsWith() would also accept sibling directories
      // that merely share the "HRMIS" name prefix (e.g. "HRMIS-evil").
      const root = path.resolve(getDataRoot()).toLowerCase();
      const resolved = path.resolve(p).toLowerCase();
      if (!p || (resolved !== root && !resolved.startsWith(root + path.sep))) {
        return { ok: false, error: 'Path outside HRMIS data directory' };
      }
      // shell.openPath never settles for nonexistent paths on Windows —
      // fail fast instead of leaving the caller hanging.
      if (!fs.existsSync(p)) {
        return { ok: false, error: 'Path does not exist' };
      }
      const err = await shell.openPath(p);
      return { ok: !err, error: err || undefined };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

// ---------------------------------------------------------------------------
// Window management
// ---------------------------------------------------------------------------
let mainWindow = null;
let flushInterval = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: PRODUCT_NAME,
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#0f1f1a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log('main window shown');
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Load the bundled production build; fall back to dev server in dev mode.
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    log('renderer finished loading');
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log(`renderer gone: ${JSON.stringify(details)}`);
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Route all renderer downloads (Excel/PDF/JSON exports) into Reports\
  try {
    session.defaultSession.on('will-download', (_event, item) => {
      try {
        const reportsDir = getDataPaths().reportsDir;
        fs.mkdirSync(reportsDir, { recursive: true });
        item.setSavePath(path.join(reportsDir, item.getFilename() || 'download'));
      } catch (err) {
        log(`download handler error: ${err.message}`);
      }
    });
  } catch {}

  app.whenReady().then(async () => {
    initLogging();
    log(`=== ${PRODUCT_NAME} starting (electron ${process.versions.electron}, node ${process.versions.node}) ===`);

    try {
      await initSqlJs();
      const { created, appliedCount } = loadOrCreateDatabase();
      log(`database initialized (created=${created}, migrationsApplied=${appliedCount})`);
      registerIpc();
      createWindow();

      flushInterval = setInterval(() => {
        try { saveDatabaseNow(); } catch {}
      }, FLUSH_INTERVAL_MS);
    } catch (err) {
      log(`FATAL startup error: ${err.stack || err.message}`);
      try {
        await dialog.showErrorBox(
          `${PRODUCT_NAME} startup failed`,
          `The application database could not be initialized.\n\n${err.message}\n\nLogs: ${path.join(getDataRoot(), 'Logs', LOG_FILE)}`
        );
      } catch {}
      app.quit();
    }
  });

  app.on('before-quit', () => {
    try { flushNow(); } catch {}
  });

  app.on('will-quit', () => {
    try { if (flushInterval) clearInterval(flushInterval); } catch {}
    try { if (saveTimer) clearTimeout(saveTimer); } catch {}
    try { flushNow(); } catch {}
    try { stmts && Object.values(stmts).forEach((s) => { try { s.free(); } catch {} }); } catch {}
    try { db && db.close(); } catch {}
    try { logStream && logStream.end(); } catch {}
  });

  app.on('window-all-closed', () => {
    // Keep running on Windows only while a window exists; standard behavior:
    if (process.platform !== 'darwin') app.quit();
  });
}
