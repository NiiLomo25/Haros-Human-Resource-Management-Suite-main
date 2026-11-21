/**
 * Haros HRMIS — Electron Shell Smoke Test
 *
 * Launches the REAL packaged Electron executable via Playwright
 * (_electron.launch) and verifies the main-process / preload / SQLite
 * boundary that scripts/e2e-functional-test.mjs cannot reach:
 *
 *   1. App process starts and a window loads the bundled UI.
 *   2. window.hrmisHost IPC bridge responds (getDbStats / getDataPaths).
 *   3. window.hrmisDesktop.getInitialSnapshot() returns the live
 *      hrmis_kv snapshot from SQLite (sync sendSync channel).
 *   4. hrmis:open-path rejects paths outside %LOCALAPPDATA%\HRMIS
 *      (regression check for the prefix-boundary defect).
 *   5. A kv write round-trips into hrmis_kv (syncSetItem -> SQLite).
 *
 * Usage:
 *   node scripts/e2e-electron-smoke.mjs [--exe "<path-to-Haros HRMIS.exe>"]
 *
 * Defaults to the x64 installed app; falls back to release/win-unpacked.
 * Writes results to HRMIS-Distribution/Release/Electron-Smoke-Results.txt
 */

import { _electron } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RESULTS_FILE = path.join(ROOT, 'HRMIS-Distribution', 'Release', 'Electron-Smoke-Results.txt');

// ELECTRON_RUN_AS_NODE (sometimes set in dev shells) makes the packaged exe
// boot as plain Node instead of the app — strip it for the child process.
delete process.env.ELECTRON_RUN_AS_NODE;

const args = process.argv.slice(2);
const exeIdx = args.indexOf('--exe');
const DEFAULT_EXE = [
  'C:\\Program Files\\Haros HRMIS\\Haros HRMIS\\Haros HRMIS.exe',
  path.join(ROOT, 'release', 'win-unpacked', 'Haros HRMIS.exe'),
].find((p) => { try { return fs.existsSync(p); } catch { return false; } });
const DEV_MODE = args.includes('--dev');
let EXE = exeIdx !== -1 ? args[exeIdx + 1] : DEFAULT_EXE;
let LAUNCH_ARGS = [];
if (DEV_MODE) {
  // Launch repo Electron against the local build (main.cjs from working tree)
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  EXE = require('electron');
  LAUNCH_ARGS = [ROOT];
}

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

async function main() {
  fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
  console.log('=== Haros HRMIS Electron Shell Smoke Test ===');
  console.log(`Target: ${DEV_MODE ? 'electron . (dev)' : EXE}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  if (!EXE || !fs.existsSync(EXE)) {
    record('executable found', false, EXE || 'no default exe located');
    writeResults();
    process.exit(1);
  }
  record('executable found', true, path.basename(EXE));

  let electronApp;
  try {
    electronApp = await _electron.launch({ executablePath: EXE, args: LAUNCH_ARGS });
  } catch (err) {
    record('electron launch', false, err.message.split('\n')[0]);
    writeResults();
    process.exit(1);
  }

  try {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    // Give the renderer a moment to boot the React shell
    await page.waitForTimeout(6000);

    const title = await page.title().catch(() => '');
    const dom = await page.evaluate(() => ({
      text: document.body?.textContent?.length || 0,
      rootKids: document.getElementById('root')?.children.length || 0,
      buttons: document.querySelectorAll('button').length,
    })).catch(() => ({ text: 0, rootKids: 0, buttons: 0 }));
    record('window loaded + UI rendered', dom.rootKids > 0 && dom.text > 200,
      `title="${title}" rootKids=${dom.rootKids} textChars=${dom.text} buttons=${dom.buttons}`);

    // --- IPC: machine info + data paths + db stats ---
    const stats = await page.evaluate(async () => {
      try { return await window.hrmisHost.getDbStats(); } catch (e) { return { ok: false, error: String(e) }; }
    });
    record('hrmisHost.getDbStats IPC', stats?.ok === true && stats.kvCount > 0,
      stats?.ok ? `kvCount=${stats.kvCount} migrations=${stats.migrationCount}` : JSON.stringify(stats));

    const paths = await page.evaluate(async () => {
      try { return await window.hrmisHost.getDataPaths(); } catch (e) { return { error: String(e) }; }
    });
    record('hrmisHost.getDataPaths IPC', Boolean(paths?.databaseFile && paths.databaseFile.includes('hrmis.db')),
      paths?.databaseFile || JSON.stringify(paths));

    // --- Sync snapshot channel (sendSync) ---
    const snap = await page.evaluate(() => {
      try {
        const s = window.hrmisDesktop.getInitialSnapshot();
        return { isObj: !!s && typeof s === 'object', keys: s ? Object.keys(s).length : -1 };
      } catch (e) { return { error: String(e) }; }
    });
    record('hrmisDesktop.getInitialSnapshot (sync)', snap.isObj === true && snap.keys > 0,
      snap.keys >= 0 ? `snapshot keys=${snap.keys}` : JSON.stringify(snap));

    // --- kv write round-trip into SQLite ---
    const probeKey = '__e2e_smoke_probe';
    const writeRes = await page.evaluate(async (k) => {
      try {
        window.hrmisDesktop.syncSetItem(k, '"probe-ok"');
        await window.hrmisDesktop.flush();
        return 'sent';
      } catch (e) { return String(e); }
    }, probeKey);
    // verify via a fresh snapshot read in the same page (kv-set already committed to memory)
    const readBack = await page.evaluate((k) => {
      try {
        const s = window.hrmisDesktop.getInitialSnapshot();
        return s && s[k];
      } catch { return null; }
    }, probeKey);
    record('kv-set -> SQLite round-trip', writeRes === 'sent' && readBack === '"probe-ok"',
      `write=${writeRes} readBack=${readBack}`);
    // cleanup probe key
    await page.evaluate((k) => { try { window.hrmisDesktop.syncRemoveItem(k); window.hrmisDesktop.flush(); } catch {} }, probeKey);

    // --- open-path boundary (D1 regression) ---
    const outside = await page.evaluate(async () => {
      const evil = (await window.hrmisHost.getDataPaths()).root + '-evil\\should-not-open.txt';
      try { return await window.hrmisHost.openPath(evil); } catch (e) { return { ok: false, error: String(e) }; }
    });
    record('open-path rejects sibling-prefix path', outside?.ok === false,
      JSON.stringify(outside).slice(0, 120));

    // In-root path that does not exist: shell.openPath fails fast at OS level.
    // We only assert the request passed OUR guard (error is not the guard's
    // "outside" message) — avoids actually opening files/dialogs.
    const inside = await page.evaluate(async () => {
      const p = (await window.hrmisHost.getDataPaths()).root + '\\__nonexistent_probe__.txt';
      try { return await window.hrmisHost.openPath(p); } catch (e) { return { ok: false, error: String(e) }; }
    }).catch((e) => ({ ok: false, error: String(e) }));
    record('open-path allows in-root path (guard pass)',
      inside !== null && !/outside/i.test(inside?.error || ''),
      inside ? JSON.stringify(inside).slice(0, 140) : 'n/a');

  } catch (err) {
    record('smoke execution', false, err.message.split('\n')[0]);
  } finally {
    try { await electronApp.close(); } catch {}
  }

  writeResults();
  const fails = results.filter((r) => !r.ok).length;
  console.log(`\nTOTAL: ${results.length} | PASS: ${results.length - fails} | FAIL: ${fails}`);
  process.exit(fails ? 1 : 0);
}

function writeResults() {
  const lines = [
    'Haros HRMIS — Electron Shell Smoke Test Results',
    '=================================================',
    `Run at: ${new Date().toISOString()}`,
    `Target: ${DEV_MODE ? 'electron . (dev)' : EXE}`,
    '',
    ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} | ${r.name}${r.detail ? ' — ' + r.detail : ''}`),
    '',
    `TOTAL: ${results.length} | PASS: ${results.filter((r) => r.ok).length} | FAIL: ${results.filter((r) => !r.ok).length}`,
  ];
  fs.writeFileSync(RESULTS_FILE, lines.join('\n'));
  console.log(`\nResults written to ${RESULTS_FILE}`);
}

main();
