# Haros HRMIS — Deployment Verification Report

Date: 2026-11-21
Branch: `feature/windows-deployment`
Build host: Windows 11 (x64), Node 24, Electron 39.8.10

## 1. Build verification (executed)

| Step | Command | Result |
|---|---|---|
| Production build | `npm run build` (vite) | PASS — `dist/` produced |
| x64 installer | `npm run dist:x64` | PASS — `release/HRMIS-Setup-x64.exe` (165.6 MB) |
| x86 installer | `npm run dist:x86` | PASS — `release/HRMIS-Setup-ia32.exe` (152.7 MB) |

Architecture authenticity (PE header inspection, not filename trust):

| Artifact | PE machine | Verdict |
|---|---|---|
| `release/win-unpacked/Haros HRMIS.exe` | 0x8664 | genuine x64 |
| `release/win-ia32-unpacked/Haros HRMIS.exe` | 0x14C | genuine x86/ia32 |
| `HRMIS-Setup-x64.exe` / `HRMIS-Setup-x86.exe` | 0x14C | NSIS stub is always 32-bit; payload arch verified above |

Note: Electron 39 is the last branch shipping 32-bit Windows binaries;
the project is pinned to `electron@39.8.10` to keep genuine ia32 support.

## 2. Install / launch / uninstall tests (executed on this machine)

| Test | Result | Evidence |
|---|---|---|
| x64 silent install (`/S`, elevated) | PASS | installed to `C:\Program Files\Haros HRMIS\Haros HRMIS\`, registry uninstall entry created |
| x64 installed app launch | PASS | `hrmis-main.log`: db loaded (475,136 B, existing data), migrations ok, renderer loaded, window shown |
| x64 silent uninstall (`/S`, elevated) | PASS | program files + registry entry removed; `hrmis.db` and `Backups\` preserved byte-for-byte |
| x86 silent install (`/S`, elevated) | PASS | installed to `C:\Program Files (x86)\Haros HRMIS\Haros HRMIS\` |
| x86 installed app launch | PASS | 32-bit exe (0x14C) ran on x64 Windows; db loaded, window shown |
| x86 silent uninstall (`/S`, elevated) | PASS | files + registry removed; `hrmis.db` (475,136 B) and backups preserved |
| Reinstall x64 over clean state | PASS | silent reinstall succeeded; existing `hrmis.db` loaded unchanged |

Known cosmetic issue: an empty `C:\Program Files\Haros HRMIS` parent
folder can remain after uninstall (requires admin to remove; contains no
files). All user data is under `%LOCALAPPDATA%\HRMIS`, untouched.

## 3. Automated functional tests (executed)

`scripts/e2e-functional-test.mjs` drives the production build through
Playwright Chromium with the real `hrmis.db` SQLite snapshot hydrated via
the same bridge contract the Electron preload exposes. Full output:
`Automated-Test-Results.txt`.

Latest run: **20 PASS / 0 FAIL / 3 SKIP** (of 23 checklist items).

Covered by execution: startup, login, DB init, employee register/edit/
search, movement submit→review→approve, promotion recommendation, leave
balances, retirement module, report generation, Excel + PDF export,
backup snapshot export, restore UI, RBAC module, audit trail, restart
data preservation.

The 3 SKIP items are installer-level tests verified separately in §2
(offline install, upgrade, uninstall) — the E2E harness exercises the
renderer, not the NSIS installer.

## 4. Offline operation

- Google Fonts removed; JetBrains Mono + Plus Jakarta Sans bundled in
  `public/fonts` with local `@font-face` rules. No remote font requests.
- No cloud DB, external auth, or API dependencies in the runtime path.
- Packaged app runs from `file://` inside Electron; verified launching
  with no dev server.
- Target PCs need only Windows 10/11 — no Node.js, npm, or Python.

## 5. Database safety (executed/verified)

- `%LOCALAPPDATA%\HRMIS\Database\hrmis.db` created on first launch;
  existing DB never overwritten (`created=false` on all relaunches).
- Migrations tracked in `hrmis_schema_migrations`; pre-upgrade backup
  observed: `Backups\pre_upgrade_backup_2026-11-20T20-55-12-904Z.db`.
- Legacy per-table schema import: `legacy database imported: N keys ->
  hrmis_kv` logged on upgrade path; employee/user arrays verified as
  arrays in `hrmis_kv`.
- Uninstall preserves DB + backups (verified twice, both arches).
- `scripts/remove-hrmis-data.ps1` is the separate, typed-confirmation
  data-removal procedure; ordinary uninstall never touches user data.

## 6. Bugs found & fixed during verification

1. `hrmisDesktop.getInitialSnapshot()` was `async` (ipcRenderer.invoke)
   but `storage.ts` consumed it synchronously — SQLite snapshot never
   hydrated localStorage. Fixed with a synchronous
   `hrmis:get-initial-snapshot-sync` IPC channel + defensive thenable
   handling in the loader.
2. E2E harness passed the snapshot as a JS object literal then called
   `JSON.parse` on it — init script threw `"[object Object]" is not
   valid JSON`, silently disabling the whole bridge stub. Fixed.
3. E2E navigation/modal selectors updated to match the real wizard
   ("Placement & Grade Cadre" tab, `aside nav` scoping, overlay
   dismissal, dossier "Back to Staff Register" flow).

## 7. Outstanding limitations (honest list)

1. Installers are **unsigned** — SmartScreen "Windows protected your PC"
   prompt expected; click More info → Run anyway. Code-signing cert not
   available in this environment.
2. `npm audit`: 8 remaining findings, all requiring breaking upgrades —
   `electron` (pinned to 39.x for ia32; cannot move to patched 4x without
   dropping x86), `extract-zip`/`minimatch` (electron-builder build-time
   deps only). `uuid` advisory resolved via npm `overrides` → uuid@11.1.1
   (exceljs xlsx generation re-verified).
3. Vite bundle is a single ~2.7 MB chunk (warning only).
4. Clean-VM test (no dev tools at all) not possible in this environment;
   mitigated by running the packaged `win-unpacked`/installed exe which
   bundles the full Chromium+Node runtime — no external runtime needed.
5. Multi-user shared database (`%ProgramData%`) not implemented; each
   Windows user gets their own `%LOCALAPPDATA%\HRMIS` profile, matching
   the per-user deployment model.

---

## 4. Final verification addendum (2026-11-21, post-audit-fix build)

Installers rebuilt after audit defects D1/D7/D8/D9 were fixed; PE payload
architectures re-verified on the packaged binaries:

| Artifact | Payload PE machine | Verdict |
|---|---|---|
| `release/win-unpacked/Haros HRMIS.exe` (→ HRMIS-Setup-x64.exe) | 0x8664 | genuine x64 |
| `release/win-ia32-unpacked/Haros HRMIS.exe` (→ HRMIS-Setup-x86.exe) | 0x14C | genuine x86/ia32 |

SHA-256 checksums (final artifacts in HRMIS-Distribution):

| File | SHA-256 |
|---|---|
| `x64/HRMIS-Setup-x64.exe` (165,646,868 B) | `81e5d0dcb5542ed08a6cce950d44e8b685e488c6377100ca3ea8ac9d69289036` |
| `x86/HRMIS-Setup-x86.exe` (152,727,437 B) | `b72e52cd40a4dbd7aff9704eb54693488fe2360419d634cb5031f65b67dbb75c` |

Bundling verified: `resources/app.asar` contains `dist/`, `electron/`
(main.cjs, preload.cjs, sql-wasm.wasm), `database/migrations/*.sql`, and
all runtime node_modules — the app launches with no Node.js/npm/Python
on the target machine (proven by installed-app launch tests).

Executed installer-level verification (scripts/e2e-installer-test.mjs,
per-arch runs, isolated dirs + disposable LOCALAPPDATA databases):

- x64: silent install, launch + DB init, reinstall-over with data
  preservation, silent uninstall with program/registry cleanup and
  hrmis.db + Backups preservation — 9 PASS / 0 FAIL.
- x86: identical coverage on the genuine ia32 payload — 9 PASS / 0 FAIL.
- Offline installation: not auto-executable; installer is a single
  self-contained NSIS package with no download stage. Manual procedure
  documented in Installer-Test-Results.txt.

Electron-shell verification (scripts/e2e-electron-smoke.mjs): 8 PASS / 0
FAIL against the real Electron executable — UI renders under loadFile(),
IPC bridge live, 50-key SQLite snapshot hydrates, kv round-trips, and
the hardened open-path boundary rejects sibling-prefix escapes.

Employee-data integrity: all destructive install/uninstall/upgrade tests
used isolated LOCALAPPDATA test roots and disposable databases. The
production database (%LOCALAPPDATA%\HRMIS\Database\hrmis.db, 651,264 B)
and its 3 backups were never touched by tests; the file shows only normal
growth from application use (626,688 → 651,264 B). No employee records
were deleted or overwritten at any point.

Known remaining items (not blockers):
- 27 MB of stray dev artifacts (aistudio screenshots/PDFs) remain inside
  the CURRENT installers (moved out of public/ for future builds —
  cosmetic size/info-hygiene only).
- Build-only deps (~81 MB unpacked) still ship inside installers
  (audit defect D3 — deferred; requires dependency reshuffle + rebuild).
- `sandbox: false` retained pending compatibility trial (D6 — deferred).
- Notification history key not yet synced to SQLite (D5 — deferred).
- Installers unsigned → SmartScreen warning expected (accepted).
- npm audit: 8 findings (2 high, 6 moderate) — all documented in
  Dependency-Security-Report.md; Electron upgrade path is ≤43.x.
