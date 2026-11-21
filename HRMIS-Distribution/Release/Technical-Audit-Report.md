# Haros HRMIS — Technical Audit Report

Date: 2026-11-21 · Branch: `feature/windows-deployment` · Commit audited: `10976b7`
Scope: read-only audit of the deployed Electron + SQLite Windows application.
No code was changed and no data was touched.

---

## 1. Confirmed working functionality (verified by execution, not assumption)

| Area | Evidence |
|---|---|
| Production build + lint | `npm run build`, `tsc --noEmit` clean |
| Genuine x64 + ia32 installers | `HRMIS-Setup-x64.exe` (165.6 MB), `HRMIS-Setup-x86.exe` (152.7 MB); inner app PE headers 0x8664 / 0x14C |
| Silent install both arches | `/S` elevated installs to `C:\Program Files\(x86)\Haros HRMIS\`; registry entries created |
| Installed app launch both arches | 32-bit exe runs on x64 Windows; log shows db loaded → window shown |
| SQLite init/migrations/legacy import | `hrmis.db` created once, never overwritten; `hrmis_schema_migrations` bookkeeping; pre-upgrade backup observed |
| 20/23 functional tests | Employee register/edit/search, movement workflow, promotion, leave/retirement, reports, Excel+PDF export, backup/restore UI, RBAC, audit, restart persistence — all PASS |
| Uninstall data preservation | Both arches: files + registry removed, `hrmis.db` + `Backups\` byte-identical after uninstall |
| Reinstall-over | x64 reinstall loads existing db unchanged (`created=false`) |
| Offline fonts | Local woff2 + fonts.css; no Google Fonts references remain |
| Data-removal script | `remove-hrmis-data.ps1`, confirmation-gated, separate from uninstall |

## 2. Remaining genuine defects

### D1 — `hrmis:open-path` directory-prefix check can be bypassed
- **Cause:** `electron/main.cjs` (~line 663) validates with
  `path.resolve(p).startsWith(path.resolve(root))`. A sibling path such as
  `C:\Users\harry\AppData\Local\HRMIS-Evil\file` shares the `...\HRMIS`
  prefix and passes the check, so `shell.openPath` could open files
  outside the intended data root.
- **Affected:** `electron/main.cjs` → `hrmis:open-path` IPC handler.
- **Reproduce:** call `window.hrmisHost.openPath('%LOCALAPPDATA%\\HRMIS-evil\\x.txt')`
  from devtools — returns `ok` instead of rejection.
- **Severity:** Low — the renderer is first-party app code, but the check
  exists precisely as a trust boundary and is incorrect.
- **Fix:** require `resolved === root || resolved.startsWith(root + path.sep)`.
- **Risk:** none; one-line change.

### D2 — E2E harness `--exe` flag is dead code; tests never touch real Electron
- **Cause:** `scripts/e2e-functional-test.mjs` parses `--exe` (line ~31) and
  prints it in the header, but `launchApp()` always spawns `vite preview`
  + Playwright Chromium with the JS bridge stub. The header comment
  ("Launches the real Electron app via Playwright (_electron)") is stale.
  Consequence: the real `main.cjs`/`preload.cjs` IPC path, the
  `sendSync` snapshot channel, `kv-set`/`kv-remove` sync, `will-download`
  routing, and quit-time flush are **not covered** by the automated suite.
- **Affected:** `scripts/e2e-functional-test.mjs` (`launchApp`, header comment).
- **Reproduce:** `node scripts/e2e-functional-test.mjs --exe "C:\Program Files\Haros HRMIS\Haros HRMIS\Haros HRMIS.exe"`
  — identical browser-stub run; exe never launched.
- **Severity:** Medium — a whole process boundary is untested
  automatically (partially covered by manual packaged-app smoke tests).
- **Fix:** implement `_electron.launch({ executablePath })` mode or
  honestly rename the flag/comment and add a small Electron-mode smoke
  test (launch exe, assert window + `hrmis:db-stats` round-trip).
- **Risk:** none to production; test-only change.

### D3 — ~81 MB of build tooling shipped inside both installers
- **Cause:** `package.json` lists build-time packages (`vite`,
  `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`,
  `typescript`, `@types/*`) under `dependencies`, and `optionalDependencies`
  carries win32 native binaries (`@rolldown/binding-*`,
  `@typescript/typescript-win32-x64`, `lightningcss-*`, `rolldown`).
  electron-builder treats these as production deps and unpacks their
  native `.node` binaries into `app.asar.unpacked` — verified:
  `release/*/resources/app.asar.unpacked/node_modules/` contains
  typescript-win32-x64 (incl. `tsc.exe`), rolldown, tailwind oxide,
  lightningcss (~81 MB) that the runtime never uses (Vite already bundled
  everything into `dist/`).
- **Affected:** `package.json` (`dependencies`, `optionalDependencies`),
  `electron-builder.yml`.
- **Reproduce:** inspect `release/win-unpacked/resources/app.asar.unpacked`.
- **Severity:** Low-medium — pure bloat (~50% of each installer), slightly
  longer install/uninstall and more AV surface; no functional defect.
- **Fix:** move build-only packages to `devDependencies` (react/exceljs/
  jspdf/lucide-react/sql.js stay as needed) and rebuild; expect each
  installer to shrink by ~70–80 MB. Must re-verify both arches launch.
- **Risk:** low — but requires full rebuild + install retest; optional
  deps must remain installed for `vite build` on the build machine.

### D4 — x86 installer artifact name doesn't match required deliverable name
- **Cause:** `electron-builder.yml` `artifactName: HRMIS-Setup-${arch}.${ext}`
  yields `HRMIS-Setup-ia32.exe`; `HRMIS-Setup-x86.exe` is produced by a
  manual copy/rename into `HRMIS-Distribution/x86/`. A fresh
  `npm run dist:x86` alone does not emit the required filename.
- **Affected:** `electron-builder.yml`, distribution step.
- **Severity:** Cosmetic/process — the shipped file IS genuine ia32.
- **Fix:** either accept `ia32` in the artifact name and document the
  rename, or add a small post-build rename/copy script
  (`scripts/dist-copy.ps1`) so the distribution step is reproducible.
- **Risk:** none.

### D5 — Notification history uses a v1 key outside the synced store
- **Cause:** `src/services/notifications/notificationService.ts` writes
  `haros_hrmis_v1_notifications` via raw `localStorage` — not the
  `haros_hrmis_v2_` prefix, so it never reaches `hrmis_kv`. History is
  lost on a fresh profile/reinstall (the permanent vault does not cover it).
- **Affected:** `notificationService.ts` (lines ~11, 60, 75).
- **Severity:** Low — history-only data, no HR records affected.
- **Fix:** route through `DatabaseService.setItem` or add the key to the
  sync path; alternatively accept as session-scoped.
- **Risk:** minimal.

### D6 — `sandbox: false` in webPreferences (hardening, not a defect)
- **Cause:** `electron/main.cjs` `createWindow()` disables the Chromium
  sandbox. The preload only uses `contextBridge`/`ipcRenderer`, which are
  permitted in sandboxed preloads, so `sandbox: true` may work — untested.
- **Severity:** Low — `contextIsolation: true` + `nodeIntegration: false`
  are correctly set; sandbox is defense-in-depth.
- **Fix:** try `sandbox: true`, smoke-test launch/login/exports; keep
  `false` only if preload breaks.
- **Risk:** medium if changed blind — must be tested on both arches.

## 3. Accepted limitations (verified, not defects)

| Item | Status |
|---|---|
| 3 E2E SKIPs (offline install, upgrade, uninstall) | **Covered by separate executed tests** — silent `/S` install+launch+uninstall run for BOTH arches; x64 reinstall-over verified; `hrmis.db` byte-preserved. Only literal "network cable pulled" install was not performed — installer is a self-contained NSIS package with no download stage, so risk is minimal. A truly offline-VM pass remains a recommended manual check. |
| Unsigned installers → SmartScreen | Accepted; code-signing cert unavailable. Documented in install guide. |
| npm audit 8 remaining | `electron@39.x` advisories — cannot upgrade to patched 4x without losing ia32 (x86 requirement). `extract-zip`/`minimatch` are electron-builder **build-time** deps, not shipped runtime. `uuid` already fixed via override. |
| Empty `C:\Program Files\Haros HRMIS` parent dir after uninstall | Cosmetic; `RMDir "$INSTDIR\.."` runs before electron-builder finishes deleting files. Contains zero files; data untouched. Optional NSIS tweak possible but low value. |
| Single ~2.7 MB JS chunk | Vite warning only; lazy-loading modules is an optional improvement. |
| sql.js in-memory engine | Up to ~15 s of writes can be lost on hard crash/power loss (debounce+interval+quit flush). Acceptable for this deployment; a future native `better-sqlite3` would remove it but adds per-arch native rebuilds. |
| Per-user data root | Each Windows user gets own `%LOCALAPPDATA%\HRMIS`; no shared `%ProgramData%` mode — matches the stated per-user model. |
| KV document store, not relational schema | `hrmis_kv` mirrors the app's existing JSON-document model. Deliberate compatibility choice — modules unchanged. Not a defect. |

## 4. Testing gaps worth closing (optional, prioritized)

1. Literal offline install test (disconnect NIC / VM without network).
2. Real version-upgrade test: install build N-1 → install N → verify
   migrations + data (current evidence is same-version reinstall +
   observed `pre_upgrade_backup`).
3. Electron-mode automated smoke (`_electron.launch`) covering IPC sync —
   closes D2.
4. `sandbox: true` trial (D6).
5. Installer size reduction rebuild + retest (D3).

## 5. Recommended implementation order (when approved)

1. **D1** open-path prefix fix — trivial, zero risk.
2. **D3** dependency reclassification + rebuild both arches + install/launch
   retest — biggest tangible win (≈80 MB/installer smaller).
3. **D2** honest `--exe` fix or real Electron smoke test.
4. **D4** post-build rename script for `HRMIS-Setup-x86.exe`.
5. **D6** sandbox trial (both arches).
6. **D5** notification key sync (optional).
7. Optional: offline-VM + N-1→N upgrade test documentation.

## 6. Risk summary

Nothing found threatens employee data, licensing, or offline operation.
The most consequential items are D2 (untested IPC boundary) and D3
(needless bloat), both low-risk to fix. All fixes are additive/hardening;
none require schema changes, business-logic rewrites, or touching
`hrmis_kv` data.
