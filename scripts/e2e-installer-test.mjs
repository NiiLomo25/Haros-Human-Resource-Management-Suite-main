/**
 * Haros HRMIS — Installer-Level E2E Tests
 *
 * Executes the three installer-level checklist items that
 * scripts/e2e-functional-test.mjs skips, using the REAL production
 * installers — no mocks:
 *
 *   1. Offline installation        -> documented limitation (see below)
 *  21. Application upgrade         -> silent reinstall-over-existing with
 *                                     data-preservation verification
 *  23. Application uninstallation  -> silent uninstall, program/registry
 *                                     cleanup, user-data preservation
 *
 * Additionally verifies per architecture:
 *   - silent install to an isolated directory (C:\HRMIS-Test\<arch>)
 *   - application launch + SQLite hrmis.db initialization
 *   - existing-database preservation across upgrade and uninstall
 *   - backup-file preservation across uninstall
 *
 * ISOLATION / SAFETY
 *   - App data is redirected by launching the exe with a custom
 *     LOCALAPPDATA env var (electron/main.cjs getDataRoot() honours it),
 *     so the PRODUCTION %LOCALAPPDATA%\HRMIS database is never touched.
 *   - Installers target C:\HRMIS-Test\<arch>, not Program Files.
 *   - The shared Add/Remove Programs registry entry is restored at the
 *     end by reinstalling the x64 setup to its default location.
 *
 * ELEVATION
 *   Per-machine NSIS install/uninstall requires admin. Each elevated step
 *   is launched via `powershell Start-Process -Verb RunAs`, which triggers
 *   a UAC consent prompt — approve the prompts for the test to proceed.
 *
 * OFFLINE INSTALLATION
 *   Cannot be automated safely (would require disabling the NIC or a
 *   separate clean VM). The installer is a single self-contained NSIS
 *   package with no download stage; see the verification procedure in
 *   HRMIS-Distribution/Release/Installer-Test-Results.txt.
 *
 * Usage:
 *   node scripts/e2e-installer-test.mjs [--arch x64|x86|both]
 */

import { _electron } from 'playwright-core';
import { execFileSync, execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RESULTS_FILE = path.join(ROOT, 'HRMIS-Distribution', 'Release', 'Installer-Test-Results.txt');

const args = process.argv.slice(2);
const archIdx = args.indexOf('--arch');
const ARCH = archIdx !== -1 ? args[archIdx + 1] : 'both';

const SETUP = {
  x64: path.join(ROOT, 'HRMIS-Distribution', 'x64', 'HRMIS-Setup-x64.exe'),
  x86: path.join(ROOT, 'HRMIS-Distribution', 'x86', 'HRMIS-Setup-x86.exe'),
};
const INSTALL_DIR = (a) => `C:\\HRMIS-Test\\${a}`;
const EXE_NAME = 'Haros HRMIS.exe';
const TEST_ROOT = path.join(os.tmpdir(), 'hrmis-installer-test');

const results = [];
const record = (id, name, ok, detail = '') => {
  results.push({ id, name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id}. ${name}${detail ? ' — ' + detail : ''}`);
};
const skip = (id, name, reason) => {
  results.push({ id, name, ok: null, detail: reason });
  console.log(`[SKIP] ${id}. ${name} — ${reason}`);
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function runElevated(exePath, extraArgs = [], timeoutMs = 300000) {
  // Start-Process -Verb RunAs triggers UAC; -Wait blocks until exit.
  const file = exePath.replace(/'/g, "''");
  const argList = extraArgs.length
    ? ` -ArgumentList ${extraArgs.map((a) => `'${a.replace(/'/g, "''")}'`).join(',')}`
    : '';
  const ps = `$p = Start-Process -FilePath '${file}'${argList} -Verb RunAs -Wait -PassThru; exit $p.ExitCode`;
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { timeout: timeoutMs });
  return { code: r.status, stdout: (r.stdout || '').toString(), stderr: (r.stderr || '').toString() };
}

function runQuiet(cmd, cmdArgs, timeoutMs = 60000) {
  const r = spawnSync(cmd, cmdArgs, { timeout: timeoutMs, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function harosProcessesRunning() {
  const r = runQuiet('tasklist', ['/FI', 'IMAGENAME eq Haros HRMIS.exe', '/NH']);
  return /Haros HRMIS\.exe/i.test(r.out);
}

async function waitForProcessesGone(timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!harosProcessesRunning()) return true;
    await sleep(1000);
  }
  return !harosProcessesRunning();
}

const INSTALLER_PROC_SCRIPT = path.join(TEST_ROOT, 'installer-procs.ps1');
function installerProcessesRunning() {
  // NSIS installers/uninstallers re-launch from %TEMP% copies — match by
  // image name or path fragment rather than exact location.
  fs.mkdirSync(TEST_ROOT, { recursive: true });
  if (!fs.existsSync(INSTALLER_PROC_SCRIPT)) {
    fs.writeFileSync(INSTALLER_PROC_SCRIPT, [
      "@(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -match 'HRMIS-Setup|Uninstall Haros|HRMIS-Test' -or $_.Name -match 'nsis|Un_A|Au_|consent' }).Count",
    ].join('\n'));
  }
  const r = runQuiet('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', INSTALLER_PROC_SCRIPT]);
  const n = parseInt((r.out || '').trim(), 10);
  return Number.isFinite(n) ? n > 0 : false;
}

async function waitForInstallerIdle(timeoutMs = 180000) {
  const start = Date.now();
  // Give the elevated stub a moment to spawn its temp-copy worker first.
  await sleep(5000);
  while (Date.now() - start < timeoutMs) {
    if (!installerProcessesRunning()) return true;
    await sleep(2000);
  }
  return !installerProcessesRunning();
}

const REG_SCRIPT = path.join(TEST_ROOT, 'regcheck.ps1');
function regQueryUninstall() {
  // Returns "DisplayName | InstallLocation | UninstallString" lines for every
  // Haros HRMIS Add/Remove Programs entry in BOTH registry views (64-bit and
  // WOW6432Node — x64 and ia32 NSIS stubs may register in different hives).
  fs.mkdirSync(TEST_ROOT, { recursive: true });
  if (!fs.existsSync(REG_SCRIPT)) {
    fs.writeFileSync(REG_SCRIPT, [
      "$paths = @('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
      "'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*')",
      "Get-ItemProperty $paths -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'Haros|HRMIS' } | ForEach-Object { \"$($_.DisplayName) | $($_.InstallLocation) | $($_.UninstallString)\" }",
    ].join('\n'));
  }
  const r = runQuiet('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', REG_SCRIPT]);
  return r.out;
}

function dirHasAppFiles(dir) {
  // True if any real application payload remains (exe/asar/dll).
  try {
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).some((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : /\.(exe|asar|dll|pak|dat)$/i.test(e.name));
    return walk(dir);
  } catch { return false; }
}

async function launchAndProbe(exePath, localAppData, { waitMs = 12000 } = {}) {
  delete process.env.ELECTRON_RUN_AS_NODE;
  const env = { ...process.env, LOCALAPPDATA: localAppData };
  const app = await _electron.launch({ executablePath: exePath, args: [], env });
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(waitMs);
    const dom = await page.evaluate(() => ({
      rootKids: document.getElementById('root')?.children.length || 0,
      text: document.body?.textContent?.length || 0,
    })).catch(() => ({ rootKids: 0, text: 0 }));
    const stats = await page.evaluate(async () => {
      try { return await window.hrmisHost.getDbStats(); } catch { return null; }
    }).catch(() => null);
    const snap = await page.evaluate(() => {
      try {
        const s = window.hrmisDesktop.getInitialSnapshot();
        return s && typeof s === 'object' ? Object.keys(s) : [];
      } catch { return []; }
    }).catch(() => []);
    return { app, page, dom, stats, snap };
  } catch (err) {
    try { await app.close(); } catch {}
    return { app: null, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Per-architecture test flow
// ---------------------------------------------------------------------------
async function testArch(arch) {
  const setup = SETUP[arch];
  const installDir = INSTALL_DIR(arch);
  const appData = path.join(TEST_ROOT, arch, 'LocalAppData');
  const hrmisData = path.join(appData, 'HRMIS');
  const exePath = path.join(installDir, EXE_NAME);
  const uninstallCandidates = () => {
    try {
      return fs.readdirSync(installDir).filter((f) => /^Uninstall.*\.exe$/i.test(f));
    } catch { return []; }
  };

  console.log(`\n===== ${arch.toUpperCase()} installer tests =====`);
  console.log(`install dir : ${installDir}`);
  console.log(`isolated appdata: ${appData}`);

  if (!fs.existsSync(setup)) { record(`${arch}-0`, `${arch} installer present`, false, setup); return; }
  record(`${arch}-0`, `${arch} installer present`, true, path.basename(setup));

  // --- 1. Silent install ---------------------------------------------------
  fs.rmSync(installDir, { recursive: true, force: true });
  fs.rmSync(appData, { recursive: true, force: true });
  console.log(`\n[install] ${arch} -> ${installDir} (UAC prompt may appear)`);
  let r = runElevated(setup, ['/S', `/D=${installDir}`]);
  // Wait for UAC consent + installer worker, then for the exe to appear.
  let installed = false;
  for (let i = 0; i < 240; i++) {
    await sleep(1000);
    if (fs.existsSync(exePath) && !installerProcessesRunning()) { installed = true; break; }
  }
  record(`${arch}-1`, `${arch} silent install`, installed, `exit=${r.code} exeExists=${installed}`);
  if (!installed) return;

  // --- 2. Launch + DB init --------------------------------------------------
  let launched = null;
  try {
    launched = await launchAndProbe(exePath, appData);
    const dbFile = path.join(hrmisData, 'Database', 'hrmis.db');
    const dbOk = fs.existsSync(dbFile) && fs.statSync(dbFile).size > 0;
    const uiOk = launched.dom && launched.dom.rootKids > 0 && launched.dom.text > 200;
    const ipcOk = launched.stats && launched.stats.ok === true;
    record(`${arch}-2`, `${arch} launch + SQLite init`, Boolean(uiOk && dbOk && ipcOk),
      `ui=${uiOk} db=${dbOk} ipc=${ipcOk} kv=${launched.stats?.kvCount}`);
  } catch (e) {
    record(`${arch}-2`, `${arch} launch + SQLite init`, false, e.message.split('\n')[0]);
  }

  // --- 3. Seed marker data (kv + backup file) -------------------------------
  const MARKER = '__installer_preserve_probe';
  if (launched?.page) {
    await launched.page.evaluate(async (k) => {
      try {
        window.hrmisDesktop.syncSetItem(k, '"preserve-me"');
        await window.hrmisDesktop.flush();
      } catch {}
    }, MARKER).catch(() => {});
    await sleep(2500); // allow debounced save
  }
  const backupsDir = path.join(hrmisData, 'Backups');
  fs.mkdirSync(backupsDir, { recursive: true });
  const backupProbe = path.join(backupsDir, 'preserve-me.bak');
  fs.writeFileSync(backupProbe, 'backup-preserve-probe');

  // --- 4. Upgrade: reinstall over existing ---------------------------------
  console.log(`\n[upgrade] ${arch} reinstall over ${installDir} (UAC prompt may appear)`);
  r = runElevated(setup, ['/S', `/D=${installDir}`]);
  await waitForInstallerIdle(180000);
  const reinstalled = fs.existsSync(exePath) && fs.statSync(exePath).size > 0;
  record(`${arch}-21a`, `${arch} reinstall over existing`, reinstalled, `exit=${r.code}`);

  // --- 5. Launch after upgrade + data preservation --------------------------
  let afterUpgrade = null;
  try {
    if (launched?.app) { try { await launched.app.close(); } catch {} launched = null; }
    afterUpgrade = await launchAndProbe(exePath, appData);
    const snapHasMarker = afterUpgrade.snap?.includes(MARKER);
    const uiOk = afterUpgrade.dom && afterUpgrade.dom.rootKids > 0;
    const dbOk = fs.existsSync(path.join(hrmisData, 'Database', 'hrmis.db'));
    record(`${arch}-21b`, `${arch} startup after upgrade + data preserved`,
      Boolean(uiOk && dbOk && snapHasMarker),
      `ui=${uiOk} db=${dbOk} marker=${snapHasMarker}`);
  } catch (e) {
    record(`${arch}-21b`, `${arch} startup after upgrade + data preserved`, false, e.message.split('\n')[0]);
  }

  // Close all app instances BEFORE uninstall — a running Haros HRMIS.exe
  // locks its own files and makes the uninstaller fail partway. Wait until
  // the processes are actually gone, not just until close() resolves.
  try { if (afterUpgrade?.app) await afterUpgrade.app.close(); } catch {}
  try { if (launched?.app) await launched.app.close(); } catch {}
  afterUpgrade = null; launched = null;
  const procsGone = await waitForProcessesGone(45000);
  if (!procsGone) console.log('  [warn] Haros HRMIS.exe still running after close — uninstall may fail');

  // --- 6. Uninstall ----------------------------------------------------------
  const un = uninstallCandidates();
  console.log(`\n[uninstall] ${arch} (${un[0] || 'no uninstaller found'}) (UAC prompt may appear)`);
  let uninstalled = false;
  let unName = '';
  if (un.length) {
    unName = un[0];
    const unExe = path.join(installDir, un[0]);
    // The NSIS stub exits immediately after spawning its temp-copy worker
    // (Un_A.exe) — exit code is meaningless. Retry once if the first attempt
    // stalls (observed flaky under AV/timing pressure).
    for (let attempt = 0; attempt < 2 && !uninstalled; attempt++) {
      if (attempt > 0) {
        console.log(`  [retry] uninstall attempt ${attempt + 1}`);
        if (!fs.existsSync(unExe)) break; // uninstaller already removed itself
        await sleep(3000);
      }
      r = runElevated(unExe, ['/S']);
      await waitForInstallerIdle(180000);
      for (let i = 0; i < 60; i++) {
        await sleep(1000);
        if (!fs.existsSync(exePath) && !dirHasAppFiles(installDir)) { uninstalled = true; break; }
      }
      if (!uninstalled) uninstalled = !dirHasAppFiles(installDir);
    }
  }
  record(`${arch}-23a`, `${arch} silent uninstall removes program files`, uninstalled,
    `uninstaller=${unName || 'NONE FOUND'} exit=${r?.code}`);

  // --- 7. Registry cleanup ----------------------------------------------------
  // The shared per-appid ARP entry may legitimately remain if ANOTHER install
  // of the product exists (e.g. the standard Program Files x64 install). The
  // correct assertion: no entry points at the TEST install dir.
  // Poll up to 20 s — the uninstaller may lag behind file removal.
  const normDir = installDir.toLowerCase().replace(/\\/g, '/');
  let regLines = [];
  let regGone = false;
  for (let i = 0; i < 45; i++) {
    await sleep(1000);
    regLines = regQueryUninstall().split(/\r?\n/).filter((l) => l.includes('|'));
    regGone = !regLines.some((l) => l.toLowerCase().replace(/\\/g, '/').includes(normDir));
    if (regGone) break;
  }
  record(`${arch}-23b`, `${arch} registry (Add/Remove Programs) cleanup`, regGone,
    regGone
      ? `no ARP entry for ${installDir}${regLines.length ? ` (${regLines.length} other install entry/entries remain — expected)` : ''}`
      : `stale entry: ${regLines.find((l) => l.toLowerCase().includes(normDir.toLowerCase())) || regLines.join(' ; ')}`);

  // --- 8. User data preservation ----------------------------------------------
  const dbPreserved = fs.existsSync(path.join(hrmisData, 'Database', 'hrmis.db'));
  const backupPreserved = fs.existsSync(backupProbe);
  record(`${arch}-23c`, `${arch} uninstall preserves database + backups`,
    Boolean(dbPreserved && backupPreserved),
    `db=${dbPreserved} backupFile=${backupPreserved}`);
}

// ---------------------------------------------------------------------------
async function main() {
  fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
  console.log('=== Haros HRMIS Installer-Level E2E Tests ===');
  console.log(`Started: ${new Date().toISOString()}`);

  const arches = ARCH === 'both' ? ['x64', 'x86'] : [ARCH];
  for (const a of arches) {
    if (!['x64', 'x86'].includes(a)) { console.error('bad --arch'); process.exit(1); }
    await testArch(a);
  }

  // Offline installation: cannot be automated without NIC control / clean VM.
  skip(1, 'Offline installation',
    'NOT AUTO-EXECUTED — requires disconnected-network environment. Installer is a ' +
    'self-contained NSIS package (no download stage). Manual procedure: disconnect ' +
    'network, run HRMIS-Setup-<arch>.exe, verify install+launch, reconnect.');

  // Restore the standard Program Files install + shared ARP registry entry.
  console.log('\n[restore] reinstalling x64 to default location to restore ARP entry');
  if (fs.existsSync(SETUP.x64)) {
    runElevated(SETUP.x64, ['/S']);
    await waitForInstallerIdle(240000);
    const restoredExe = path.join('C:\\Program Files\\Haros HRMIS', 'Haros HRMIS', EXE_NAME);
    const restored = fs.existsSync(restoredExe);
    record('restore', 'standard install restored (ARP entry)', restored);
  }

  // Cleanup isolated dirs
  try { fs.rmSync('C:\\HRMIS-Test', { recursive: true, force: true }); } catch {}

  const fails = results.filter((r) => r.ok === false).length;
  const passes = results.filter((r) => r.ok === true).length;
  const skipsN = results.filter((r) => r.ok === null).length;

  const lines = [
    'Haros HRMIS — Installer-Level E2E Test Results',
    '===============================================',
    `Run at: ${new Date().toISOString()}`,
    '',
    ...results.map((r) => `${r.ok === true ? 'PASS' : r.ok === false ? 'FAIL' : 'SKIP'} | ${r.id}. ${r.name}${r.detail ? ' — ' + r.detail : ''}`),
    '',
    `TOTAL: ${results.length} | PASS: ${passes} | FAIL: ${fails} | SKIP: ${skipsN}`,
    '',
    'OFFLINE INSTALLATION — manual verification procedure:',
    '  1. Disconnect the test machine from all networks (Wi-Fi/Ethernet).',
    '  2. Run HRMIS-Setup-x64.exe (or -x86) and complete installation.',
    '  3. Launch Haros HRMIS; verify the app opens and creates %LOCALAPPDATA%\\HRMIS\\Database\\hrmis.db.',
    '  4. Reconnect network. The installer is a single self-contained NSIS',
    '     executable with no download stage, so offline installation is',
    '     expected to succeed; this procedure confirms it on target hardware.',
  ];
  fs.writeFileSync(RESULTS_FILE, lines.join('\n'));
  console.log(`\nTOTAL: ${results.length} | PASS: ${passes} | FAIL: ${fails} | SKIP: ${skipsN}`);
  console.log(`Results written to ${RESULTS_FILE}`);
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
