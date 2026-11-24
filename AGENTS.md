# Project Notes

## Workflow rules
- After any code change is completed and verified, rebuild BOTH installers:
  - `npm run dist:x64` → copy `release/HRMIS-Setup-x64.exe` to `HRMIS-Distribution/x64/HRMIS-Setup-x64.exe`
  - `npm run dist:x86` → copy `release/HRMIS-Setup-ia32.exe` to `HRMIS-Distribution/x86/HRMIS-Setup-x86.exe`
- Verification before rebuild: `npx tsc --noEmit`, `npx vite build`, and relevant `scripts/test-*.ts` suites via `npx tsx`.

## Testing
- Test scripts live in `scripts/` and use an in-memory localStorage shim (see `test-grade-scale.ts` for the pattern). The shim must be installed BEFORE importing `src/db/storage` (singleton instantiates at module load).
- `ELECTRON_RUN_AS_NODE=1` may be set in agent shells — strip it when launching the packaged exe for smoke tests.
