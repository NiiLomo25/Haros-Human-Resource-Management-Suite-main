# HRMIS Audit Defect Fixes — Stage Report

Date: 2026-11-21
Branch: `feature/windows-deployment`
Scope: defects from `Technical-Audit-Report.md` + defects discovered during verification.

## Defects fixed

### D1 — `hrmis:open-path` prefix-validation bypass (audit defect)
- **Root cause:** `resolved.startsWith(root)` accepted sibling paths sharing the
  `HRMIS` name prefix (e.g. `HRMIS-evil\file`).
- **Fix:** `electron/main.cjs` — allow `resolved === root` or
  `resolved.startsWith(root + path.sep)` only.
- **Verified:** direct boundary test (inside/root/sibling/parent/outside) and
  live IPC test in `e2e-electron-smoke.mjs` — sibling-prefix rejected,
  in-root path passes the guard.

### D2 — E2E `--exe` dead code / no real Electron coverage (audit defect)
- **Root cause:** suite always launched vite-preview + JS bridge stub; `--exe`
  was parsed but unused.
- **Fix:** new `scripts/e2e-electron-smoke.mjs` launches the real executable
  via Playwright `_electron` (or `electron .` with `--dev`) and exercises the
  actual preload/IPC/SQLite path. `--exe` in the functional suite now prints a
  pointer to the smoke script instead of silently ignoring it.
- **Verified:** 8/8 PASS against `electron .` (dev) — see
  `Release/Electron-Smoke-Results.txt`.

### D7 — SQLite snapshot never reached the renderer (NEW, critical)
- **Root cause:** `getKvSnapshot()` called `stmts.kvAll.all()`, which does not
  exist in the sql.js Statement API (`step()`/`getAsObject()` required). The
  try/catch swallowed the TypeError and returned `{}` — so **the packaged app
  never hydrated `hrmis_kv` into localStorage**. All prior E2E passed because
  the preview-mode stub injected the snapshot directly, masking the defect.
- **Fix:** `electron/main.cjs` — iterate with `step()`/`getAsObject()` +
  `reset()`, with `db.exec` fallback on error.
- **Verified:** smoke test — `getInitialSnapshot` now returns all keys
  (46 → 50 across runs), kv write round-trips into SQLite.

### D8 — Packaged app rendered a blank window (NEW, critical)
- **Root cause:** `vite.config.ts` had no `base`, so `dist/index.html`
  emitted absolute asset URLs (`/assets/...`, `/fonts/fonts.css`). Under
  Electron `loadFile()` (file://), `/` resolves to the filesystem root →
  `ERR_FILE_NOT_FOUND` ×3, empty `#root`. The shipped x64/x86 installers
  contain this broken bundle.
- **Fix:** `vite.config.ts` — `base: './'`; `index.html` — fonts link changed
  to `./fonts/fonts.css`. Rebuilt `dist/`; verified zero absolute asset URLs
  remain in HTML/CSS/JS bundle.
- **Verified:** dev-mode Electron smoke — `rootKids=1`, UI text renders,
  no resource errors.

### D9 — `shell.openPath` hangs on nonexistent paths (NEW, low)
- **Root cause:** `hrmis:open-path` passed missing files straight to
  `shell.openPath`, whose promise never settles on Windows for nonexistent
  paths — the IPC caller hangs forever.
- **Fix:** `electron/main.cjs` — `fs.existsSync` guard returns
  `{ ok:false, error:'Path does not exist' }` before calling `shell.openPath`.
- **Verified:** smoke test — in-root nonexistent path now returns in ms
  instead of hanging (previously >15 s, never resolved).

## Files changed

| File | Reason |
|---|---|
| `electron/main.cjs` | D1 boundary check, D7 snapshot API fix, D9 existsSync guard |
| `vite.config.ts` | D8 `base: './'` for file:// loading |
| `index.html` | D8 relative fonts path |
| `scripts/e2e-electron-smoke.mjs` | NEW — real Electron smoke suite (D2) |
| `scripts/e2e-functional-test.mjs` | D2 — honest `--exe` deprecation notice, target labels |

## Tests executed

| Test | Result |
|---|---|
| `node --check electron/main.cjs` | PASS |
| `npm run lint` (tsc --noEmit) | PASS |
| `npm run build` (vite) | PASS — relative asset URLs confirmed |
| `e2e-electron-smoke.mjs --dev` | **8/8 PASS** |
| `e2e-functional-test.mjs` (preview harness) | **20 PASS / 0 FAIL / 3 SKIP** (unchanged) |

## Remaining defects / pending

- **D3** build-only deps in installer (~81 MB) — code change done? NO, pending.
- **D4** x86 artifact naming (`ia32` → `x86`) — pending.
- **D5** notification-history key not synced to SQLite — pending.
- **D6** `sandbox: false` → trial `sandbox: true` — pending.

## Risks requiring approval

1. **CRITICAL: the currently installed app and both shipped installers are
   broken** — they contain the pre-fix bundle (blank window, no SQLite
   hydration). They must be rebuilt before any deployment. Per instructions,
   final installers were NOT rebuilt in this stage.
2. D3–D6 remain; D3/D6 verification requires packaged builds.
3. `sandbox: true` (D6) must be compatibility-tested on both arches before
   adoption — preload uses `sendSync`, which is supported in sandboxed
   preloads but needs verification.
