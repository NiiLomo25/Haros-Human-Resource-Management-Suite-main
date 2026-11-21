# Haros HRMIS — Backup and Restore Guide

## What is backed up automatically

The desktop application persists **all** application data to a single
SQLite database:

```
%LOCALAPPDATA%\HRMIS\Database\hrmis.db
```

This includes employee records, staff movements, promotions, leave,
retirement, payroll, users, roles, permissions, settings, audit logs,
computer registrations, and license/expiry configuration.

Writes are flushed to disk on a debounce timer, every 15 seconds, and on
application exit, using an atomic write (`hrmis.db.tmp` → rename), so the
database file is never left half-written.

Before any schema migration runs during an upgrade, an automatic backup
is written to:

```
%LOCALAPPDATA%\HRMIS\Backups\pre_upgrade_backup_YYYY-MM-DDTHH-MM-SS-sssZ.db
```

## Manual backup (recommended routine)

1. Close Haros HRMIS (or leave it running — the file is consistent
   between flushes, but closing guarantees the latest state).
2. Copy `hrmis.db` to removable media or a network share.
3. Store the copy with the date in the filename, e.g.
   `hrmis-backup-2026-11-20.db`.

You can also use **System Configuration → Backup / Snapshot** inside the
application to export a JSON snapshot of every table, and **Restore** to
import a previously exported snapshot (a pre-restore safety snapshot is
created automatically first).

## Restore procedures

### A. Restore the whole database file

1. Close Haros HRMIS.
2. Rename the current `hrmis.db` to `hrmis.db.old` (do not delete it).
3. Copy the backup file into `%LOCALAPPDATA%\HRMIS\Database\` and rename
   it to `hrmis.db`.
4. Launch the application. Migrations re-apply safely; existing data is
   preserved.

### B. Restore via in-app snapshot

1. Open **System Configuration → Restore**.
2. Select the previously exported `.json` snapshot.
3. Confirm. A pre-restore safety backup is saved automatically before
   any table is overwritten.

## Corrupt database handling

If `hrmis.db` fails integrity checks at startup, the application:

- Copies it to `Backups\hrmis-corrupt-<timestamp>.db` (quarantine).
- Creates a fresh database and re-runs migrations.
- **Never overwrites the corrupt file** — recover manually if needed.

## Complete data removal (destructive)

Ordinary uninstall preserves all data. To permanently erase everything:

1. Ensure Haros HRMIS is closed.
2. Open an **elevated** PowerShell window.
3. Run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File "C:\Program Files\HRMIS\resources\remove-hrmis-data.ps1"
   ```

   (If the script was not installed with the app, run the copy in
   `HRMIS-Distribution\Database\remove-hrmis-data.ps1`.)

4. Type `DELETE` when prompted. This removes the entire
   `%LOCALAPPDATA%\HRMIS` folder — database, backups, documents,
   reports, attachments, and logs. This cannot be undone.

## Recommended schedule

- Daily or weekly file copy of `hrmis.db` for small deployments.
- Keep at least one backup off the workstation (USB / network share).
- Before every upgrade, confirm a recent `Backups\pre_upgrade_backup_*.db`
  exists or take a manual copy.
