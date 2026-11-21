# HRMIS Dependency Security Report

Date: 2026-11-21
Method: fresh `npm audit` + `npm ls` dependency-path analysis + patched-version
checks against the npm registry + Electron release notes.

## Fresh audit result

**8 vulnerabilities — 2 high, 6 moderate** (unchanged count from previous audit;
uuid advisory remains resolved via override).

| # | Package (installed) | Severity | Dependency path | Impact area |
|---|---|---|---|---|
| 1 | `electron@39.8.10` | High | direct `devDependencies` → **ships inside the app** | Production runtime (Chromium/Electron) |
| 2 | `extract-zip@2.0.1` | High ×2 advisories | `electron` → `extract-zip` (npm install/postinstall only) | Development only — NOT shipped, NOT used by electron-builder at runtime |
| 3 | `minimatch@9.0.9` | Moderate | `app-builder-lib` → `@electron/universal` → `minimatch@^9.0.3` | Build-time only (electron-builder packaging) |
| 4 | `minimatch@10.2.6` | Moderate | `app-builder-lib` → `minimatch@^10.2.5` | Build-time only |

## Finding 1 — Electron CVEs (HIGH, runtime)

Advisories (all under the `electron` package): GHSA-hq2x-r82h-9wj4,
GHSA-gr2m-v5gq-v685, GHSA-j84w-jfhq-vhvj, GHSA-9qh4-3jw8-366w,
GHSA-fw47-9c62-h3vw, GHSA-2p8c-gr87-2676, GHSA-x562-297c-g43g,
GHSA-98mx-cjp9-gchm, GHSA-3qxv-5xgr-q7w9, GHSA-h3v5-h239-pg29,
GHSA-997q-gvvc-jwmx, GHSA-jr5w-w6x2-84p9 — sandbox-escape, permission-
attribution, cookie, webview, and certificate-mitigation issues.

**Can it be fixed?**
- `electron@39.8.10` is the **latest 39.x** — no patch exists within the branch.
- `npm audit fix --force` wants `electron@45.4.1` — a 6-major jump.
- **Correction to earlier assumption:** 32-bit Windows (`win32-ia32`) binaries
  are published through **Electron 43.x** — v44.0.0 removed them (official
  Electron breaking-changes doc; v43 is the last series, EOL Jan 2027).
  So x86 support does NOT require staying on 39 — it requires staying ≤43.

**Decision: NOT upgraded in this stage.** A 39→43 jump is four Chromium
milestones; it requires a full compatibility pass and rebuild+retest of both
installers, which is a scheduled-change decision, not an audit fix. Per
instructions, no major upgrade was attempted without that testing.

**Mitigations already in place:** the app is fully offline (no remote content,
no navigation to untrusted origins), `contextIsolation: true`,
`nodeIntegration: false`, sandboxed renderer posture, and no `<webview>`/
`window.open` usage — most listed CVEs require attacker-controlled web content
or specific API misuse that this app does not expose. Residual risk is
primarily defense-in-depth, not a demonstrated exploit path.

**Recommendation:** schedule an Electron 39→**43.x** upgrade (NOT 44+) as a
separate work item, then rebuild and re-verify both x86/x64 installers before
the next release. Electron 43 retains ia32 and will itself reach EOL Jan 2027 —
plan the x86 sunset before then.

## Finding 2 — extract-zip@2.0.1 (HIGH ×2, dev-only)

GHSA-jmr9-qjv8-65gv, GHSA-7pqw-9j4j-h8q3 — symlink path traversal / arbitrary
file write **while extracting archives**.

- Used only by the `electron` npm package's install/postinstall step to
  unpack the Electron binary zip **on the build machine**. It is not bundled
  into `app.asar`, not invoked by electron-builder, and never runs on target
  machines.
- **No patched version exists** — 2.0.1 is the latest release and the
  advisories cover all versions (`*`).
- Archives it extracts are Electron's own release zips from the npm/Electron
  mirror — not attacker-controlled input in this workflow.

**Fix:** none available. **Accepted risk** — dev-machine-only, trusted input.

## Finding 3 — minimatch@9.0.9 / 10.2.6 (MODERATE, build-only)

GHSA-g3hv-75wg-m249 — potential DoS via globparts amplification.

- Only reached through `electron-builder` → `app-builder-lib` /
  `@electron/universal`. It processes **our own** glob patterns during
  packaging — not user or attacker-supplied input.
- Patched versions exist only in the 11.x line (advisory range 7.0.0–11.0.0),
  while `@electron/universal` requires `^9.0.3` and `app-builder-lib` requires
  `^10.2.5`. A global `overrides` entry would force v11 onto five nested
  consumers (glob@7→minimatch@3, jake/filelist→minimatch@5, etc.) with real
  breakage risk for a negligible, non-exploitable-in-context gain.

**Fix:** none applied (deliberate). **Accepted risk** — build-time only,
trusted patterns.

## uuid override — verified compatible

`"overrides": { "uuid": "^11.1.1" }` remains in `package.json`.
Compatibility test executed:

```
ExcelJS.Workbook().xlsx.writeBuffer() → 6412-byte valid .xlsx  PASS
require('uuid') → 11.1.1, v4() generates RFC-4122 UUID           PASS
```

Excel export functionality is unaffected.

## Overrides / lockfile review

- `package.json` overrides: only `uuid@^11.1.1` — minimal and verified.
- `package-lock.json` is consistent with the override; no manual edits.
- No dependency was removed; nothing the app requires was replaced.

## Remaining accepted risks

1. **Electron 39.x runtime CVEs** — cannot be patched within the branch;
   resolved only by the planned ≤43 upgrade (x86-safe ceiling). Highest-severity
   item; mitigated by offline, isolated-renderer architecture.
2. **extract-zip** — unpatched upstream; dev-only, trusted input.
3. **minimatch** — unpatched in required major ranges; build-only, trusted
   input.

## Tests executed

| Test | Result |
|---|---|
| `npm audit` (fresh) | 8 findings — 2 high, 6 moderate |
| `npm ls electron extract-zip minimatch` | dependency paths confirmed |
| `npm view` patched-version checks | extract-zip: none; minimatch: 11.x only; electron: 39.8.10 is branch-latest |
| Electron release-notes check | ia32 binaries published through v43; removed in v44 |
| exceljs + uuid runtime smoke | PASS |
