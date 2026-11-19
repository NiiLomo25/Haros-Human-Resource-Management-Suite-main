# Haros HRMIS — Backup, Restore & Disaster Recovery Guide

This guide describes how Haros HRMIS stores relational data, how to create verified full-database snapshots, how to safely restore an archive, and how the **Pre-Restore Safety Snapshot** and **Factory Reset** mechanisms protect institutional records.

---

## 1. Storage Architecture & Data Persistence

Haros HRMIS persists all operational, organizational, payroll, user, and audit tables locally in browser storage under the namespace prefix `haros_hrmis_v1_` (`SQLite WAL Mode Emulated` / `%ProgramData%\HarosHRMIS\Data\hrmis.db` architecture).

### Data Stored Per Snapshot (36 Core Tables)
A full snapshot captures:
- **Organizational & Establishment:** `mdas`, `departments`, `units`, `gradeLevels`, `establishment`
- **Core Staff Dossiers:** `employees`, `personalInfo` (including Ghana Card / NIA), `employmentInfo`, `qualifications`, `memberships`, `priorHistory`, `documents`
- **Movements & Career:** `movements`, `movementHistory`, `recruitmentApplicants`, `promotionRecommendations`
- **Leave, Attendance, Training & Appraisals:** `leaveTypes`, `leaveBalances`, `leaveApplications`, `attendanceRecords`, `trainingPrograms`, `trainingNominations`, `appraisals`
- **Single Spine Payroll (`SSSS`):** `salaryStructures`, `salaryGradeSteps`, `payrollComponents`, `payrollAssignments`, `payrollRuns`, `payslips`
- **Exits & Discipline:** `separationRecords`, `clearanceItems`, `disciplinaryCases`
- **Security, Config & Forensics:** `roles`, `users`, `systemSettings`, `auditLogs`

> **Important Browser Storage Note:** Because live working data resides in the workstation browser's `localStorage` for offline standalone operation, clearing browser site data or switching browsers/computers without restoring a backup file will leave you with a fresh seeded database. **Always store downloaded `.json` backup files in a secure shared drive, encrypted USB drive, or institutional backup folder.**

---

## 2. Creating a Full Database Backup

Perform regular manual backups before bulk employee imports, payroll runs, institutional configuration changes, or workstation maintenance.

### Step-by-Step Procedure
1. Sign in to Haros HRMIS.
2. In the left navigation sidebar, open **System Configuration**.
3. Select the **Backup & Restore** tab.
4. Click the amber **Create Full Backup Now** button in the *Database Engine Snapshot & WAL Integrity* banner.
5. Your browser downloads a timestamped JSON archive named:
   ```text
   HAROS_HRMIS_FULL_WAL_SNAPSHOT_YYYY-MM-DD.json
   ```
6. Verify the entry appears at the top of **Recent Backup & Snapshot History** with status **`VERIFIED`** and review its file size (in KB).
7. Move or copy the downloaded `.json` file to your designated secure backup location (external drive or institutional archive server).

### Snapshot File Structure
Every snapshot begins with metadata headers followed by the `tables` object:
```json
{
  "systemVersion": "Haros HRMIS Enterprise v2.4.0",
  "databaseEngine": "SQLite WAL Mode Emulated",
  "snapshotTimestamp": "2026-11-15T15:30:00.000Z",
  "institution": "Office of the Head of Civil Service",
  "tables": {
    "mdas": [...],
    "employees": [...],
    "...": [...]
  }
}
```

---

## 3. Restoring a Database Snapshot

Use the Restore tool to roll back to an earlier point in time or migrate data onto another workstation.

### Step-by-Step Procedure
1. Open **System Configuration -> Backup & Restore**.
2. In the **Restore Database from Snapshot** card, load the archive using either method:
   - Click **Browse File...** and select a `.json` snapshot file (`HAROS_HRMIS_FULL_WAL_SNAPSHOT_*.json`).
   - Or paste the full JSON content directly into the text box.
3. Verify the character counter shows the loaded payload (e.g., `145,820 characters loaded`).
4. Click **Execute Database Restore**.
5. Review the amber confirmation prompt (**Confirm Full Database Snapshot Restoration**) and click **Confirm & Restore Archive**.
6. Wait briefly until the green confirmation banner appears reporting the number of restored core tables (up to 35 operational tables; audit history is preserved and appended).

### Automated Pre-Restore Safety Protection
Before overwriting any active table during a restore:
1. Haros automatically generates a snapshot of the **current live state** (`pre_restore_safety_backup`).
2. It logs a **`Pre-Restore Safety Snapshot`** entry (`PRE_RESTORE_SAFETY_SNAPSHOT.json`) into **Recent Backup & Snapshot History**.
3. It validates that the uploaded JSON parses cleanly and contains a valid root `"tables"` object. If validation fails, **no live tables are modified**.
4. It notifies UI listeners (`INSTITUTION_NAME`, `INSTITUTION_COUNTRY`, etc.) and writes an immutable `RESTORE-TRANSACTION` record into the **Audit Trail** detailing the source timestamp, tables restored, and operator username.

---

## 4. Factory Reset (Wiping Operational Data)

> **Access Restriction:** Factory Reset is strictly locked to the **System Administrator** role (`admin`). Other roles see a locked notice and cannot execute this action.

Factory Reset is intended only when clearing sample/test records prior to live production rollout or decommissioning a workstation.

### What Factory Reset Deletes vs. Preserves
- **Permanently Deleted:** All employees, personal/employment records, qualifications, memberships, documents, MDAs, departments, units, establishment quotas, movements, movement history, recruitment applicants, promotions, leave, attendance, training, appraisals, payroll runs/payslips, separations, clearances, disciplinary dockets, backup history, audit logs, and all non-admin user accounts.
- **Preserved:** Your active **System Administrator** account and statutory civil service reference scales (`GradeLevels`, `Roles`, core `SystemSettings`).

### Procedure
1. **Create a backup first** (Section 2) in case you ever need the wiped data later.
2. Click the **SQLite WAL Mode** button in the top Title Bar (or the storage indicator in the bottom Status Bar) to open **SQLite Relational Database Architecture**.
3. Click **Factory Reset**.
4. Read the red warning box carefully, then click **Confirm Delete All Data**.

---

## 5. Recommended Backup Schedule

| Event / Frequency | Action |
| :--- | :--- |
| **Daily (End of Business)** | Create a full JSON snapshot and archive off-workstation |
| **Before Bulk Excel Registration** | Export a snapshot prior to uploading batch employee workbooks |
| **Before & After Monthly Payroll Run** | Archive snapshots before computing payroll and immediately after run finalization |
| **Before Workstation OS Updates / Browser Cleanup** | Export a verified JSON snapshot and store on external media |

---

## 6. Troubleshooting Backup & Restore

| Issue | Likely Cause | Fix |
| :--- | :--- | :--- |
| `Invalid archive: Missing required "tables" root object` | Uploaded a CSV/Excel report or partial JSON instead of a full Haros snapshot | Ensure you select a `HAROS_HRMIS_FULL_WAL_SNAPSHOT_*.json` file created via **Create Full Backup Now** |
| Restore button disabled | Textarea is empty or file failed to load | Re-select the `.json` file with **Browse File...** and verify character count is non-zero |
| Institutional title didn't update immediately after restore | Cached view in another open module | Navigate between modules or refresh the page (`F5`); settings listeners update Title Bar, Sidebar, and Reports automatically |
| Migrating to a new computer | `localStorage` is per-machine/per-browser | Export `.json` snapshot on the old PC -> install/open Haros HRMIS on the new PC -> sign in as `admin` -> restore the `.json` file |
