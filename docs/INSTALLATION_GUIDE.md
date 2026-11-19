# Haros HRMIS — Installation Guide

This guide explains how to install, configure, run, verify, and deploy **Haros HRMIS (Human Resource Management Information Suite)** on a workstation or local server.

---

## 1. System Requirements

### Software Prerequisites
- **Node.js:** v20.x LTS or newer (includes `npm`) — *or* **Bun** v1.1+
- **Modern Chromium/Edge/Firefox Browser:** Microsoft Edge, Google Chrome, or Mozilla Firefox (latest ESR/release) with `localStorage` and file downloads enabled
- **Git** (optional, if cloning from version control)

### Recommended Workstation Specifications
- **OS:** Windows 10 / Windows 11 (64-bit), macOS, or Linux
- **CPU:** Dual-core 2.0 GHz or faster
- **RAM:** Minimum 4 GB (8 GB recommended when importing 1,000-row Excel bulk batches)
- **Disk Space:** 500 MB free space for dependencies, build artifacts, and local backup archives
- **Network:** Required only during initial dependency installation (`npm install`). Once built/served locally, the application operates **100% offline**.

---

## 2. Project Setup & Dependency Installation

1. **Open a terminal** in the project root directory (where `package.json` is located).

2. **Install project dependencies:**
   ```bash
   npm install
   ```
   *(If your environment uses Bun, you may alternatively run `bun install`.)*

3. **Environment Variables (Optional):**
   Review `.env.example` if present. The core HRMIS application stores data locally in the browser and requires **no external database server or API keys** to run standard HR, payroll, bulk registration, and reporting workflows.

   > **Important:** Never commit real secrets or private `.env` files to source control.

---

## 3. Running in Development Mode

Start the Vite development server on port `3000`:

```bash
npm run dev
```

This executes `vite --port=3000 --host=0.0.0.0`.

- **Local Access:** Open `http://localhost:3000` in your browser.
- **LAN Workstation Access:** Open `http://<HOST-IP>:3000` from another computer on the same internal network (ensure Windows Firewall allows inbound TCP on port `3000` if sharing on a LAN).

> **Note:** On first launch, the storage engine automatically initializes the Civil Service seed dataset (5 MDAs, departments, 24 civil service grade levels, sample officers, `SSSS-2026` salary structure, statutory rules, and default RBAC accounts).

---

## 4. Verifying Code & Building for Production

Before packaging or deploying to a production workstation/intranet server:

1. **Run TypeScript Type-Checking (Lint):**
   ```bash
   npm run lint
   ```
   Verifies `tsc --noEmit` completes with zero errors.

2. **Create Production Bundle:**
   ```bash
   npm run build
   ```
   Outputs optimized static assets into the `dist/` directory.

3. **Preview Production Build Locally:**
   ```bash
   npm run preview
   ```

4. **Clean Build Artifacts (Optional):**
   ```bash
   npm run clean
   ```
   Removes `dist/` and temporary build output.

---

## 5. Offline / Intranet Deployment Options

Because Haros HRMIS compiles into a self-contained static web bundle (`dist/`), you can deploy it cleanly in air-gapped civil service environments:

### Option A: Serve Static Build on a Local Intranet Host
Serve the contents of `dist/` using any lightweight static HTTP server (e.g., Nginx, IIS, Caddy, or `npx serve dist -l 3000`). Users access the portal via `http://<intranet-server>:3000`.

### Option B: Standalone Workstation Setup
1. Install Node.js LTS once on the HR workstation.
2. Copy the built `dist/` folder (or project folder after `npm install`).
3. Create a desktop shortcut launching `npm run preview -- --port 3000` and open `http://localhost:3000` in Microsoft Edge/Chrome (**Install as App / Create Shortcut** in browser menu for a native window experience).

---

## 6. Post-Installation Security Checklist

Immediately after initial installation and login:

1. Sign in as the **System Administrator** (`admin` / `Admin@2026`).
2. Navigate to **System Configuration -> Password Reset** (or click your profile menu -> **Reset Password**) and **change the default administrator password**.
3. Open **User & Access (RBAC)** or **System Configuration -> Password Reset** to rotate passwords for all seeded accounts (`hr_director`, `hr_manager`, `hr_officer`, `auditor`) or deactivate unused accounts.
4. Go to **System Configuration -> Configuration** and verify:
   - `INSTITUTION_NAME` (e.g., *Office of the Head of Civil Service* or your MDA name)
   - `INSTITUTION_COUNTRY` (e.g., *Republic of Ghana*)
   - Statutory retirement & promotion rules (`60` years age / `35` years service).
5. Create an initial clean baseline backup via **System Configuration -> Backup & Restore -> Create Full Backup Now**.

---

## 7. Troubleshooting Installation

| Symptom | Cause | Resolution |
| :--- | :--- | :--- |
| `vite: not found` when running `npm run dev` | Dependencies not installed | Run `npm install` in the workspace root |
| Port `3000` already in use | Another process is bound to port `3000` | Stop the conflicting service or free port `3000` before starting Vite |
| Browser shows blank data or old schema | Corrupted local browser storage from an earlier build | Clear site storage or sign in as `admin` -> **SQLite WAL Mode** -> **Factory Reset** (after exporting a backup) |
| Fonts or assets look unstyled | Incomplete build or blocked local assets | Run `npm run build` and verify there are no console errors |
