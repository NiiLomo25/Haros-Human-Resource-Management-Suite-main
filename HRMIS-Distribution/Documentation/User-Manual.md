# Haros HRMIS — User Manual (Desktop Edition)

Haros HRMIS is an offline desktop Human Resource Management Information
Suite for Ministries, Departments, and Agencies (MDAs). It runs entirely
on the local workstation — no internet connection is required.

## Signing In

1. Launch **Haros HRMIS** from the Desktop or Start Menu.
2. On first launch, an activation administrator must register the
   workstation and set the Trade EDate (one-time per computer).
3. Enter your username and password and click **Sign In**.
   Default seed administrator: `admin` (change the password immediately
   via the user menu → password reset).

## Modules

The left sidebar provides access to all HR modules, subject to your
role's permissions:

- **Dashboard & Analytics** — workforce overview and key metrics.
- **Staff Management** — employee registration (multi-tab wizard:
  personal, employment, qualifications, skills), dossier views, editing,
  and search. Also supports bulk registration.
- **Organization Structure** — MDAs, departments, units.
- **Staff Movements** — transfers/postings with directive workflow
  (submit → review → approve → execute).
- **Promotions & Progression** — eligibility and recommendation workflow.
- **Recruitment & Appointment** — applicant tracking.
- **Leave Management** — balances, applications, approvals, resumption.
- **Attendance** — attendance records.
- **Training & Development** — programs, nominations, capabilities, skills.
- **Performance Appraisals** — appraisal cycles and records.
- **Payroll & Compensation** — salary structures, components, runs,
  payslips.
- **Retirement & Separation** — retirement calculations, clearance,
  separation records.
- **Disciplinary Records** — cases and outcomes.
- **Establishment & Cadre** — establishment control and cadre planning.
- **Reports & Analytics** — operational reports with Excel and PDF export.
- **User & Access (RBAC)** — users, roles, route permissions.
- **System Configuration** — institution settings, database backup /
  snapshot / restore, audit trail, computer registration, expiry (Trade
  EDate) management.

## Exports and Reports

- Excel (`.xlsx`) and PDF exports are produced inside the app; downloaded
  files are saved to `%LOCALAPPDATA%\HRMIS\Reports`.
- Full database snapshots (JSON) can be exported/restored from
  **System Configuration**.

## Data and Backups

See **Backup-and-Restore-Guide.md**. In short: all data lives in
`%LOCALAPPDATA%\HRMIS\Database\hrmis.db`; copy that file (with the app
closed) for backups; uninstalling the app never deletes it.

## Security Notes

- Workstation registration binds the installation to the computer's
  hardware UUID; registrations are integrity-signed.
- The Trade EDate controls application expiry; clock-rollback tampering
  is detected and locked.
- All passwords are hashed (never stored in plain text).
- Every significant action is written to the audit log
  (**Audit Trail** in the title bar / System Configuration).
