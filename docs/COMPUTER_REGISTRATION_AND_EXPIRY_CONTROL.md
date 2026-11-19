# Haros HRMIS — Computer Registration, Application Activation & Expiry Control

## 1. Architecture Overview
Haros HRMIS enforces a startup licensing and hardware-binding gate before granting access to the regular HRMIS login screen or authenticated workspace:

1. **First-Time Activation Gate (`LoginPage.tsx`, `App.tsx`)**:
   - On initial launch on an unregistered workstation, `computerRegistrations` is empty and `validateStartupAndClock(...)` returns `blockReason: 'UNREGISTERED_COMPUTER'`.
   - Standard login inputs are locked and disabled until the workstation is registered and an active `Trade EDate` is configured.
2. **Administrator Authorization (`ActivationAdminAuthModal.tsx`, `seedData.ts`, `password.ts`)**:
   - Accessing the `ADMINISTRATIVE CONFIG` tab (or triggering **Administrator Renewal** from the expiry lock modal) requires authenticating against `activationAdmins`.
   - Credentials use a salted SHA-256 hash format (`sha256_v1$<salt>$<hex_digest>`) verified via `verifyActivationPassword(...)`. No plaintext administrator password is stored in code or persistent storage.
3. **One-Time Computer Registration (`AdministrativeConfigPanel.tsx`, `storage.ts`)**:
   - **Get This ComputerName**: Queries native Windows desktop bridges (`window.hrmisHost`, `window.electronAPI`, or WebView2 `window.chrome.webview.hostObjects.hrmis`) when packaged as a Windows desktop app, falling back in browser mode to a deterministic workstation hardware/GPU/canvas fingerprint (`HW-...` + workstation label).
   - **Duplicate Prevention**: `db.registerComputer(...)` rejects duplicate `hardwareId` or `computerName` entries and stores a signed record (`integritySignature`) in `computerRegistrations`.
   - **Registered Computers Grid**: Displays registered workstations with live drag-and-drop column grouping (`Drag a column header here to group by that column`).
4. **Application Expiry Control (`Trade EDate`)**:
   - Controlled under the `ETradeDate` panel in `ADMINISTRATIVE CONFIG`.
   - When `effectiveYmd > tradeEDate`, `canAccessLogin` and `canAccessApplication` evaluate to `false` (`blockReason: 'EXPIRED'`).
   - Displays the blocking popup:
     > *"Your HRMIS access authorization has expired. Please contact the administrator for renewal."*  
     > Contact: `+233243586743` / `+233266363781`
   - All employee, payroll, movement, establishment, and audit records remain intact during expiry lock.

## 2. Persistence & Upgrade Survival
- Registered computer bindings (`computerRegistrations`) and `applicationExpiryConfig` are **excluded** from `resetDatabase()` and `factoryResetAllData()`.
- Every write to registrations or expiry configuration is mirrored to an isolated IndexedDB vault (`HarosHRMIS_PermanentRegistryVault` -> store `machineBindings`). On startup, `db.reconcilePermanentVault()` restores valid bindings and monotonic clock watermarks automatically.

## 3. Offline Clock-Tampering Detection & Limitations
Because Haros HRMIS operates **100% offline**, there is no remote NTP time authority. The module uses a monotonic high-watermark defense (`maxSeenUtcMs`) paired with SHA-256 integrity signatures:

- **How It Works**:
  - Every startup, focus event, sign-in attempt, and 30-second runtime tick compares `Date.now()` against `maxSeenUtcMs` (with a 2-minute `120_000ms` tolerance for minor OS clock jitter/DST transitions).
  - If `nowMs < maxSeenUtcMs - 120_000`, or if any localStorage/vault JSON record fails `verifyComputerSignature(...)` / `verifyExpiryConfigSignature(...)`, the app sets `clockTamperDetected: true` (`blockReason: 'CLOCK_TAMPERED'`), records a `SECURITY` audit entry, and locks HRMIS until Administrator `Harry` re-authenticates and saves a valid `Trade EDate` renewal.
  - Because `effectiveUtcMs = Math.max(nowMs, maxSeenUtcMs)`, minor clock rollbacks within tolerance still cannot roll the evaluated date backward once a later date has been observed.
- **Inherent Offline Limitations**:
  1. **Pre-First-Launch Clock Modification**: If an operator sets the Windows system clock backward *before* HRMIS ever runs past `Trade EDate` (and before any higher `maxSeenUtcMs` is recorded), no local watermark exists yet to prove the clock was rolled back.
  2. **Browser Profile / Site-Data Wipe vs. Native Windows Deployment**: In a standalone web browser, clearing browser origin storage wipes both `localStorage` and `IndexedDB`. When packaged for Windows Desktop (Electron / WebView2 / MSIX), bridge `window.hrmisHost` to persist the signed binding/watermark inside Windows `%ProgramData%\HarosHRMIS\Data\hrmis.db` (SQLite) and `HKLM\SOFTWARE\HarosHRMIS` so registrations and expiry watermarks survive uninstall/reinstall and local profile resets.
