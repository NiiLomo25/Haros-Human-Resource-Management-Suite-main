# Haros HRMIS — User Manual

Welcome to the official User Manual for **Haros HRMIS (Human Resource Management Information Suite)**. This guide covers daily operations across every module—from signing in and registering staff (including Ghana Card / NIA & bulk Excel upload) to managing movements, Single Spine payroll, appraisals, retirements, and statutory PDF/Excel reports.

---

## Table of Contents
1. [Signing In & Password Management](#1-signing-in--password-management)
2. [Workspace Layout & Navigation](#2-workspace-layout--navigation)
3. [Dashboard & Analytics](#3-dashboard--analytics)
4. [Staff Management & Employee Dossier](#4-staff-management--employee-dossier)
5. [Bulk Employee Registration (.xlsx)](#5-bulk-employee-registration-xlsx)
6. [Organization Structure & Establishment Control](#6-organization-structure--establishment-control)
7. [Recruitment & Appointment Onboarding](#7-recruitment--appointment-onboarding)
8. [Staff Movements & Postings](#8-staff-movements--postings)
9. [Promotions & Career Progression](#9-promotions--career-progression)
10. [Leave Management & Attendance](#10-leave-management--attendance)
11. [Training & Performance Appraisals (SPAS)](#11-training--performance-appraisals-spas)
12. [Payroll & Compensation (Single Spine)](#12-payroll--compensation-single-spine)
13. [Retirement, Separation & Disciplinary Records](#13-retirement-separation--disciplinary-records)
14. [Statutory Reports & Analytics (`REP-01` – `REP-20`)](#14-statutory-reports--analytics-rep-01--rep-20)
15. [User Access (RBAC), System Configuration & Audit Trail](#15-user-access-rbac-system-configuration--audit-trail)

---

## 1. Signing In & Password Management

### Signing In
1. Launch Haros HRMIS in your browser (`http://localhost:3000` or your intranet URL).
2. Enter your **Email Address or Username** and **Password**.
3. Click **Sign In**. (Use the eye toggle inside the password field to verify characters if needed.)

### Default Seeded Accounts (Initial Setup Only)
| Username | Email | Role | Default Password |
| :--- | :--- | :--- | :--- |
| `admin` | `admin@hrmis.gov.gh` | System Administrator | `Admin@2026` |
| `hr_director` | `janet.antwi@ohcs.gov.gh` | HR Director | `Civil@2026` |
| `hr_manager` | `emmanuel.ofori@ohcs.gov.gh` | HR Manager | `Civil@2026` |
| `hr_officer` | `beatrice.mensah@ohcs.gov.gh` | HR Officer | `Civil@2026` |
| `auditor` | `kofi.senanu@iaa.gov.gh` | Auditor | `Civil@2026` |

> **Security Reminder:** Change all default passwords immediately after initial deployment.

### Resetting Your Password
- Click your profile badge at the top right of the Title Bar and select **Reset Password** (or go to **System Configuration -> Password Reset**).
- Enter your **Current Password**, your **New Password** (minimum 6 characters), and **Confirm New Password**, then submit.
- **System Administrators** can also reset any user account's password from the Administrator Password Reset panel on the same tab or via **User & Access (RBAC)**.
- If you are locked out on the sign-in screen, click **Forgot password?** to view reset instructions for contacting your System Administrator.

---

## 2. Workspace Layout & Navigation

- **Top Title Bar:** Displays the **Ghana Civil Service Crest**, **Haros HRMIS** branding, your active **Institution Name**, **SQLite WAL Mode** diagnostics button, **Audit Trail** quick button, and your **User Profile Menu** (**Reset Password** / **Sign Out**).
- **Left Navigation Sidebar:** Collapsible menu listing all **17 modules** with live badge counters for:
  - **Staff Movements** (pending workflow queue)
  - **Promotions & Progression** (eligible officers)
  - **Retirement & Separation** (officers within 12 months of statutory retirement)
- **Bottom Status Bar:** Displays active storage status (`Air-Gapped Local Storage`) and quick access to database diagnostics.

---

## 3. Dashboard & Analytics

The **Dashboard & Analytics** home screen summarizes real-time workforce health:
- Active headcount, MDA/Department coverage, promotion-eligible officers, and upcoming retirements.
- Visual breakdowns by Cadre, Grade Level, and MDA distribution.
- Clicking quick links or highlighted officer records jumps straight to the relevant module or Employee Dossier.

---

## 4. Staff Management & Employee Dossier

Open **Staff Management** from the sidebar to view, search, register, export, or inspect civil service personnel.

### Searching & Filtering
- Filter staff by **Name**, **Staff ID**, **Ghana Card (NIA)**, **MDA**, **Department**, **Grade**, **Cadre**, or **Employment Status**.
- Export the filtered roster directly to CSV.

### Registering a New Officer (`Register New Staff`)
Click **Register New Staff** to open the 4-step registration panel:
1. **1. Personal & Next-of-Kin:** Enter unique **Staff ID** (e.g., `OHCS-EMP-00108`), Surname, First Name, Other Names, Date of Birth (minimum 18 years), Gender, Marital Status, Nationality, **Ghana Card (NIA)** (`GHA-XXXXXXXXX-X`), Telephone, Email, Residential Address, and Next-of-Kin / Emergency details.
2. **2. Placement & Grade Cadre:** Select Staff Categorization (`Professional`, `Sub-Professional`, `Technical`, `Administrative`, `Consultant`), Employment Type, MDA, Department, Position Title, Grade Scale, Salary Level & Step, Date of First Appointment, and Assumption of Duty. *(Statutory Retirement Date is computed automatically as the earlier of age 60 or 35 years of service.)*
3. **3. Academic Qualification:** Record highest qualification level, title, awarding institution, course of study, and year obtained.
4. **4. Training & Skills:** Add up to 10 **Specific Training Capabilities** and up to 10 **Staff Skills** categorized across 8 competency groups with supporting evidence.

### Inspecting & Updating an Officer (`12-Tab Employee Dossier`)
Click any officer in the roster to open their **12-Tab Master Dossier**:
1. **Overview:** Biographical card (including **Ghana Card (NIA)**), cadre placement, succession/promotion eligibility badge, training capabilities & skills summary, and confidential disciplinary notice (if authorized).
2. **Personal Details:** Click **Edit Personal Details** to update names, **Ghana Card (NIA)**, telephone, email, residential address, or next-of-kin details, then click **Save Changes**.
3. **Employment Details:** Service tenure dates, grade & scheme of service, and Single Spine compensation step.
4. **Qualifications:** Add and verify academic qualifications.
5. **Memberships:** Track professional body registrations (e.g., IHRMP, ICAG, Ghana Bar).
6. **Department History** & **7. Movement History:** Complete chronological posting & transfer ledger.
8. **Promotions:** Historical grade progression timeline.
9. **Leave:** Leave entitlements, taken days, and applications.
10. **Training & Skills:** Edit capabilities and skill evidence directly.
11. **Appraisals:** Historical SPAS evaluation ratings.
12. **Documents:** Upload, preview, and manage dossier attachments.

> Use **Edit Employee Record** at the top right of the Dossier for full multi-tab editing, **Print Dossier CV** to print a formatted profile, or **Initiate Movement** to launch a transfer/promotion workflow.

---

## 5. Bulk Employee Registration (`.xlsx`)

Use **Bulk Register Staff** in **Staff Management** to onboard up to **1,000 employees** per Excel workbook:

1. **Step 1 — Download Template:**
   - Click **Download Template (.xlsx)** to generate `Employee_Bulk_Registration_Template.xlsx` pre-populated with live MDAs, dependent MDA -> Department dropdowns, Grade Scales, Salary Steps, Qualification Levels, and Skill Categories.
   - Fill out the `Employees` tab (and optionally link rows via `Staff ID*` on the `Training Capabilities` and `Skills` tabs).
   - Enter **Ghana Card (NIA)** in Column `I` (`GHA-XXXXXXXXX-X` format, optional). *Do not rename sheets or header columns.*
2. **Step 2 — Upload & Validate:**
   - Upload your filled `.xlsx` file. Haros validates every row for mandatory fields, `DD/MM/YYYY` dates, `+233` phone formatting, `GHA-XXXXXXXXX-X` Ghana Card syntax, MDA-Department alignment, and duplicate persons (matching Staff ID, Phone, Email, Ghana Card, or Name+DOB).
   - Review any **Warnings** (choose **Skip** or **Import Anyway**) or download the Excel Error Report if any rows have **Errors**.
3. **Step 3 — Review & Import:**
   - Select your import policy (**Import valid rows only** or **Cancel if any errors**) and execute the batch upload. Download the resulting import ledger for your records.

---

## 6. Organization Structure & Establishment Control

- **Organization Structure:** Manage **Ministries, Departments & Agencies (MDAs)**, **Directorates / Departments**, **Operational Units**, and view the **24 Civil Service Grade Levels**.
- **Establishment & Cadre:** Define authorized post quotas (`Approved Cadre Quota`) per MDA/Department/Grade and monitor filled posts versus critical vacancies.

---

## 7. Recruitment & Appointment Onboarding

Open **Recruitment & Appt.** to manage public service hiring pipelines:
1. **Log Applicant:** Click **Add Applicant** and enter candidate contact details, **National ID (NIN / Ghana Card)**, target position, MDA/Department, grade, qualification, and years of experience.
2. **Interview & Shortlisting:** Score applicants, record committee interview notes, and update status (`Shortlisted`, `Interviewed`, `Selected`, `Rejected`).
3. **Appointment & Onboarding:** For `Selected` candidates, preview the appointment warrant and convert them directly into active staff records in **Staff Management**—their **Ghana Card (NIA)** and core particulars transfer automatically.

---

## 8. Staff Movements & Postings

Open **Staff Movements** to process Transfers, Departmental Reassignments, Acting Appointments, Secondments, and Promotions:
1. Click **Initiate Movement**, choose the officer, movement type, target MDA/Department/Grade/Step, effective date, and justification.
2. Advance the workflow step by step: `Draft` -> `Submitted` -> `Under Review` -> `Approved` (requires `HR Director` or `System Administrator`) -> `Implemented`.
3. Upon **Implementation**, the officer's active `EmployeeEmploymentInfo` updates automatically, a permanent record appends to `StaffMovementHistory`, and the effective date updates tenure tracking for both **Grade** and **Ministry**.

---

## 9. Promotions & Career Progression

Open **Promotions & Progression** to review statutory eligibility:
- **Automatic Progression:** Standard grades meeting `PROMOTION_STANDARD_YEARS` (default **3 years** in grade).
- **Competitive Senior Merit:** Principal / Chief / Director grades meeting `PROMOTION_SENIOR_YEARS` (default **5 years** in grade) and appraisal/disciplinary clearance.
- Submit eligible officers to a promotion board, record approval outcomes, and apply new grade assignments.

---

## 10. Leave Management & Attendance

- **Leave Management:** View officer leave balances across statutory leave categories (Annual, Sick, Maternity/Paternity, Study, Compassionate), file leave applications, and approve/reject requests with automatic balance checks (`STRICT_LEAVE_BALANCE_CHECK`).
- **Attendance:** Record daily timekeeping logs (`Present`, `Late`, `Absent`, `On Leave`, `Official Duty`) and filter departmental attendance registers.

---

## 11. Training & Performance Appraisals (SPAS)

- **Training & Development:** Create capacity building programs (e.g., CSTC / GIMPA / workshops), nominate civil servants, track completion status, and monitor institutional training budgets.
- **Performance Appraisals:** Manage annual SPAS appraisal cycles, enter self-assessment and supervisor scores, review overall percentages and final ratings (`Outstanding`, `Exceeds Expectations`, `Satisfactory`, etc.).

---

## 12. Payroll & Compensation (Single Spine)

Open **Payroll & Compensation** (authorized HR/Finance/Admin roles):
- Review the active **Single Spine Salary Structure (`SSSS-2026`)**, grade/step salary tables, and allowances/deductions.
- Assign or verify individual officer payroll steps and banking details.
- Execute **Monthly Payroll Runs**, inspect computed gross pay, SSNIT Tier 1/2 deductions, PAYE income tax, and net pay, and print/review individual **Officer Payslips**.

---

## 13. Retirement, Separation & Disciplinary Records

- **Retirement & Separation:**
  - Monitor officers approaching mandatory statutory retirement (**60 years of age** or **35 years of service**, whichever comes first).
  - Process exits (Statutory Retirement, Voluntary Resignation, Secondment Release, etc.) and verify multi-unit **Clearance Checklists** (IT Assets, Registry/Documents, Accounts/Loans, Estates).
- **Disciplinary Records:**
  - Restricted to authorized roles (`CONFIDENTIAL_VIEW` / `DISCIPLINARY_MANAGE`).
  - Log misconduct cases, committee inquiry stages, sanctions, and outcomes with strict audit tracking.

---

## 14. Statutory Reports & Analytics (`REP-01` – `REP-20`)

Open **Reports & Analytics** to generate official civil service documents with the **Ghana Civil Service Crest**, sovereign heading, dynamic institution title, reporting period, KPIs, and triple sign-off footer (**Prepared By**, **Verified By**, **Approved & Certified By**).

### Included 20 Statutory Reports + Personal Dossier
| Category | Code | Report Title |
| :--- | :--- | :--- |
| **Establishment & Staff** | `REP-01` | Staff Nominal Roll (Master Register) |
| | `REP-02` | Complete Staff Personnel Register *(includes Ghana Card, Ministry & Grade, Yrs in Current Grade, Yrs in Current Ministry)* |
| | `REP-03` | Departmental Staff Allocation Register |
| | `REP-04` | Staff Distribution by Grade Level |
| | `REP-05` | Cadre & Gender Diversity Report |
| | `REP-06` | Age Demographics & Cohort Analysis |
| | `REP-07` | Staff Qualifications & Education Register |
| | `REP-08` | Staff Distribution Across MDAs |
| | `REP-17` | Staff Establishment & Cadre Quota Register |
| | `REP-18` | Vacancy & Staffing Variance Analysis |
| **Career & Movements** | `REP-09` | Staff Movements & Postings History |
| | `REP-10` | Promotion History & Career Progression |
| | `REP-11` | Recruitment & Candidate Pipeline Report |
| **Services & Leave** | `REP-13` | Annual & Statutory Leave Register |
| | `REP-14` | Training & Capacity Building Summary |
| | `REP-15` | Annual Performance Appraisal Roster |
| **Compensation & Exits** | `REP-12` | Retirement Horizon Forecast |
| | `REP-16` | Single Spine Payroll & Wage Bill Summary |
| | `REP-19` | Separation Records & Exit Clearances |
| | `REP-20` | Disciplinary Cases & Statutory Sanctions Docket |
| **Individual Extract** | `REP-20-PHR` | Employee Personal History Report *(select an officer in the toolbar or click **Personal History** on any roster row)* |

### Filtering & Exporting
1. Narrow any report by **Search query**, **Reporting Period / Date Range**, **MDA**, **Department**, **Grade**, **Cadre**, or **Employee Status**.
2. Export or print using the toolbar buttons:
   - **Excel (`.xlsx`):** Formatted spreadsheet with institutional banner, crest logo, frozen headers, and auto-sized columns.
   - **Export PDF:** Paginated A4 Portrait or Landscape official PDF with the Ghana Civil Service Crest letterhead, page numbers (`Page X of Y`), and certification signature lines.
   - **CSV:** UTF-8 spreadsheet extract.
   - **Print:** Clean browser print layout hiding sidebar and toolbars.

---

## 15. User Access (RBAC), System Configuration & Audit Trail

- **User & Access (RBAC):** Create new staff login accounts, assign any of the 6 system roles, activate/deactivate accounts, or unlock failed logins.
- **System Configuration:**
  - **Configuration Tab:** Customize **`INSTITUTION_NAME`** (updates Login Page, Title Bar, Sidebar, Dashboard, and all Reports immediately), **`INSTITUTION_COUNTRY`**, default currency, statutory ages/service years, and validation toggles.
  - **Backup & Restore Tab:** Create full `.json` WAL snapshots and restore archives safely (see [`BACKUP_RESTORE.md`](./BACKUP_RESTORE.md)).
  - **Audit Trail Tab:** Filter tamper-proof logs by Actor, Workstation, Module, or Action (`INSERT`, `UPDATE`, `DELETE`, `SYSTEM_INIT`), inspect old/new JSON diffs, or export the ledger to CSV. *(Also accessible anytime via **Audit Trail** in the top Title Bar.)*
  - **Password Reset Tab:** Change your own password or (for System Administrators) reset any user's password.
