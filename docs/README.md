# Haros HRMIS — Documentation Overview

**Haros HRMIS (Human Resource Management Information Suite)** is a desktop-style, offline-capable Enterprise Human Resource Management Information System designed for Civil Service Ministries, Departments, and Agencies (MDAs). It provides end-to-end civil service lifecycle management—from recruitment and establishment control to staff movements, Single Spine payroll, statutory retirements, audit logging, and official reporting.

---

## Documentation Index

| Document | Audience | Purpose |
| :--- | :--- | :--- |
| **[README.md](./README.md)** | All Stakeholders | System overview, technology stack, modules, and architecture summary |
| **[INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md)** | IT / System Admins / Developers | Prerequisites, local setup, development server, production build, and troubleshooting |
| **[BACKUP_RESTORE.md](./BACKUP_RESTORE.md)** | System Administrators | Full JSON snapshot backups, pre-restore safety recovery, WAL integrity, and Factory Reset |
| **[USER_MANUAL.md](./USER_MANUAL.md)** | HR Officers, Directors, Auditors, Admins | Step-by-step operational manual across all 17 system modules and 20 statutory reports |
| **[HAROS_HRMIS_USER_MANUAL.pdf](./HAROS_HRMIS_USER_MANUAL.pdf)** | All Stakeholders (Printable / Offline PDF) | Comprehensive 20-page official PDF User & Operations Manual covering activation, licensing, all 17 modules, bulk Excel, RBAC, and statutory reports |
| **[COMPUTER_REGISTRATION_AND_EXPIRY_CONTROL.md](./COMPUTER_REGISTRATION_AND_EXPIRY_CONTROL.md)** | Activation & Security Administrators | Hardware binding, Trade EDate licensing enforcement, permanent vault persistence, and offline clock-tampering defense |

### Engineering Reference Docs
- [`STEP_1_PROJECT_FOUNDATION_AND_REQUIREMENTS.md`](./STEP_1_PROJECT_FOUNDATION_AND_REQUIREMENTS.md) — Statutory requirements and system scope
- [`STEP_2_DATABASE_ARCHITECTURE_AND_ERD.md`](./STEP_2_DATABASE_ARCHITECTURE_AND_ERD.md) — Relational tables, foreign keys, and schema rules
- [`STEP_3_APPLICATION_ARCHITECTURE_AND_UI_DESIGN.md`](./STEP_3_APPLICATION_ARCHITECTURE_AND_UI_DESIGN.md) — Shell design, RBAC, and component structure

---

## Key Capabilities

- **100% Offline Standalone Architecture:** Runs locally without external cloud dependencies using ACID-structured browser relational storage (`SQLite WAL Mode Emulated`).
- **Central Employee Database:** Comprehensive **12-Tab Employee Dossier** tracking Ghana Card (NIA), biographical details, placements, academic qualifications, professional memberships, capabilities/skills, leave, appraisals, disciplinary notices, and scanned documents.
- **Bulk Excel Onboarding:** Three-step `.xlsx` bulk employee registration workflow with live MDA/Department dependent dropdowns, Ghana Card validation, duplicate detection, and batch audit logging.
- **Statutory Movement & Progression Controls:** Enforces `Draft -> Submitted -> Under Review -> Approved -> Implemented` workflows with an immutable `StaffMovementHistory` ledger, automatic 3-year progression checks, and 5-year competitive senior promotion reviews.
- **Single Spine Payroll (`SSSS-2026`):** Computes basic pay, allowances, deductions, SSNIT, and PAYE remittances with monthly batch runs and officer payslips.
- **20 Statutory Civil Service Reports + Personal History Dossier:** Instant preview and formatted exports to **PDF** (with embedded Ghana Civil Service Crest letterhead & sign-off block), **Microsoft Excel (`.xlsx`)**, **UTF-8 CSV**, and **Print**.
- **Dynamic Institutional Branding:** Changing `INSTITUTION_NAME` or `INSTITUTION_COUNTRY` in System Configuration dynamically updates the Login Page, Title Bar, Sidebar, Dashboard, and all generated reports.
- **Forensic Audit Trail & RBAC:** Immutable audit logging across every create, update, movement, login, backup, and restore operation across six role tiers.

---

## Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript |
| **Build Tool & Dev Server** | Vite 8 (Port `3000`) |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`) |
| **Icons** | Lucide React |
| **Excel Processing** | ExcelJS (`.xlsx` bulk templates & statutory workbook exports) |
| **PDF Generation** | jsPDF + `jspdf-autotable` (A4 Portrait/Landscape statutory reports) |
| **Persistence** | Local Relational Storage Engine (`haros_hrmis_v1_*` namespace with JSON snapshot export/restore) |

---

## Seeded Access Roles

| Role | Access Scope |
| :--- | :--- |
| **System Administrator** | Full unrestricted access (`ALL`), user & password resets, System Configuration, Backup & Restore, and Factory Reset |
| **HR Director** | Movement & promotion approvals, establishment management, confidential disciplinary dossiers, separations, payroll view, and reports |
| **HR Manager** | Staff creation/editing, movement submission, leave approval, training & separation management, and reports |
| **HR Officer** | Staff registration/updates, qualification & document management, daily attendance logging |
| **Auditor** | Strict read-only statutory oversight across staff, movements, payroll, audit logs, and reports |
| **Finance Officer** | Compensation parameters, payroll processing & reports, confidential payroll views |
