# Haros HRMIS — Windows Installation Guide

## Overview

Haros HRMIS is a standalone, fully offline Windows desktop application.
The installer contains the complete application, the embedded Chromium
runtime, the SQLite database engine, and all required fonts and assets.

**No internet connection, Node.js, npm, Python, or cloud service is required
on the target computer.**

## Packages

| Package | Architecture | Target systems |
|---|---|---|
| `HRMIS-Setup-x64.exe` | 64-bit (x64) | Windows 10/11 64-bit |
| `HRMIS-Setup-x86.exe` | 32-bit (x86) | 32-bit and 64-bit Windows |

Each installer is a genuine architecture-specific build — they are not
renamed copies of one another.

## Installation Steps

1. Copy the appropriate installer to the target computer (USB drive or
   network share — no internet needed).
2. Right-click the installer and choose **Run as administrator**
   (per-machine installation requires elevation).
3. If Windows SmartScreen shows "Windows protected your PC", click
   **More info → Run anyway**. The installers are not code-signed;
   this warning is expected.
4. Follow the wizard:
   - Accept the license agreement.
   - Choose the installation directory (default `C:\Program Files\Haros HRMIS`;
     32-bit installs may default to `C:\Program Files (x86)\Haros HRMIS`).
   - Choose which shortcuts to create (Desktop and Start Menu are
     enabled by default).
5. Click **Install** and wait for completion.
6. Click **Finish** — the application launches automatically.

## First Launch

On first launch the application:

- Creates `%LOCALAPPDATA%\HRMIS\` with `Database`, `Backups`,
  `Documents`, `Reports`, `Logs`, and `Attachments` subfolders.
- Creates `Database\hrmis.db` (SQLite) and applies all schema migrations.
- Shows the **workstation registration gate**. An activation
  administrator must authorize and register the computer and set the
  Trade EDate before the login portal is accessible.
- After activation, sign in with a provisioned account
  (default seed administrator: `admin`).

## Data Location

All user data lives under the installing user's profile:

```
%LOCALAPPDATA%\HRMIS\
    Database\hrmis.db      <- SQLite database (all HR records)
    Backups\               <- automatic pre-upgrade backups
    Documents\             <- user documents
    Reports\               <- exported Excel/PDF/JSON reports
    Logs\hrmis-main.log    <- application log
    Attachments\           <- uploaded attachments
```

Program files are installed under `C:\Program Files\Haros HRMIS` and contain
no user data.

## Offline Verification

The application makes **no network requests** for core operation.
Fonts are bundled locally (`public/fonts`), and there are no Google,
Gemini, cloud database, or online authentication dependencies.

## Uninstallation

Use **Settings → Apps → Haros HRMIS → Uninstall** (or the uninstaller in
the Start Menu folder). The uninstaller:

- Removes program files, shortcuts, and registry entries.
- **Preserves** `%LOCALAPPDATA%\HRMIS` — the database, backups,
  documents, reports, and attachments are never deleted.

To permanently erase all HRMIS data, run the separate confirmation-gated
script `remove-hrmis-data.ps1` as Administrator (see
Backup-and-Restore-Guide.md). Ordinary uninstall never deletes data.

## Upgrades

Installing a newer version over an existing installation:

- Preserves `%LOCALAPPDATA%\HRMIS` completely.
- Before applying schema migrations, the app writes an automatic
  timestamped backup to `Backups\pre_upgrade_backup_*.db`.
- Migrations run transactionally and are recorded in
  `hrmis_schema_migrations`.
- A corrupt database is quarantined to `Backups\` — it is never silently
  overwritten.
