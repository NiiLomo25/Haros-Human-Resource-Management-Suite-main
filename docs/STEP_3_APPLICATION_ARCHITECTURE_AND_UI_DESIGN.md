# Haros Human Resource Management Information Suite (HRMIS)
## STEP 3: Application Architecture, UX/UI Design & Layout System

---

### Document Information
- **UI Framework:** Windows Presentation Foundation (WPF) on .NET 10 LTS
- **Design System:** Windows 11 Fluent Design System (ModernWpf / Wpf.Ui)
- **Architectural Pattern:** Clean Architecture + MVVM (CommunityToolkit.Mvvm)
- **Engineering Phase:** Step 3: Application Architecture and UI Design

---

## 1. Application Folder Structure

The complete solution architecture is organized following enterprise Clean Architecture with distinct projects separating Domain, Application logic, Infrastructure, and Presentation.

```
Haros.HRMIS/
├── src/
│   ├── Haros.HRMIS.Domain/                      # Core Domain Layer (Zero external dependencies)
│   │   ├── Common/
│   │   │   ├── BaseEntity.cs                   # Id, CreatedDate, ModifiedDate, IsDeleted
│   │   │   ├── IAggregateRoot.cs
│   │   │   └── ValueObject.cs
│   │   ├── Entities/
│   │   │   ├── Employee.cs
│   │   │   ├── EmployeePersonalInfo.cs
│   │   │   ├── EmployeeEmploymentInfo.cs
│   │   │   ├── EmployeeQualification.cs
│   │   │   ├── EmployeeDocument.cs
│   │   │   ├── Mda.cs
│   │   │   ├── Department.cs
│   │   │   ├── EstablishmentPosition.cs
│   │   │   ├── StaffMovement.cs
│   │   │   ├── StaffMovementHistory.cs         # Immutable ledger entity
│   │   │   ├── PromotionRecord.cs
│   │   │   ├── LeaveApplication.cs
│   │   │   ├── LeaveBalance.cs
│   │   │   ├── AttendanceRecord.cs
│   │   │   ├── TrainingProgram.cs
│   │   │   ├── PerformanceAppraisal.cs
│   │   │   ├── SalaryStructure.cs
│   │   │   ├── DisciplinaryCase.cs
│   │   │   ├── SeparationRecord.cs
│   │   │   ├── User.cs
│   │   │   └── AuditTrailLog.cs
│   │   ├── Enums/
│   │   │   ├── MovementType.cs
│   │   │   ├── WorkflowStatus.cs
│   │   │   ├── LeaveCategory.cs
│   │   │   ├── EmploymentStatus.cs
│   │   │   └── SanctionType.cs
│   │   └── Exceptions/
│   │       ├── DomainException.cs
│   │       └── InvariantViolationException.cs
│   │
│   ├── Haros.HRMIS.Application/                 # Application Layer (Use cases & CQRS)
│   │   ├── Common/
│   │   │   ├── Interfaces/
│   │   │   │   ├── IAppDbContext.cs
│   │   │   │   ├── ICurrentUserService.cs
│   │   │   │   ├── IDateTimeService.cs
│   │   │   │   ├── IReportService.cs
│   │   │   │   └── IBackupService.cs
│   │   │   ├── Models/
│   │   │   │   ├── PagedResult.cs
│   │   │   │   └── ServiceResult.cs
│   │   │   └── Behaviors/
│   │   │       ├── ValidationBehavior.cs
│   │   │       └── AuditLoggingBehavior.cs
│   │   ├── Features/
│   │   │   ├── Staff/
│   │   │   │   ├── Commands/ (CreateStaff, UpdateStaff, UploadDocument)
│   │   │   │   ├── Queries/ (GetStaffPaged, GetStaffById, SearchStaffAdvanced)
│   │   │   │   └── DTOs/ (StaffSummaryDto, StaffDossierDto)
│   │   │   ├── Movements/
│   │   │   │   ├── Commands/ (SubmitMovement, ApproveMovement, ImplementMovement)
│   │   │   │   └── Queries/ (GetMovementHistoryByStaff, GetPendingMovements)
│   │   │   ├── Organization/
│   │   │   ├── Promotions/
│   │   │   ├── Leave/
│   │   │   ├── Reports/
│   │   │   └── Dashboard/
│   │   └── Validators/
│   │
│   ├── Haros.HRMIS.Infrastructure/              # Infrastructure Layer (I/O, EF Core, SQLite)
│   │   ├── Persistence/
│   │   │   ├── AppDbContext.cs
│   │   │   ├── Configurations/                  # Fluent API Entity Type Configurations
│   │   │   ├── Migrations/                      # EF Core Code-First Migrations
│   │   │   └── DbInitializer.cs                 # Seed scripts for civil service lookups
│   │   ├── FileStorage/
│   │   │   └── LocalDocumentStorageService.cs   # Partitioned %ProgramData% document store
│   │   ├── Reporting/
│   │   │   ├── QuestPdfReportEngine.cs          # Vector-based PDF generation
│   │   │   └── ClosedXmlExportService.cs        # Excel .xlsx generation
│   │   ├── Backup/
│   │   │   └── SqliteBackupManager.cs           # Scheduled & pre-restore database snapshots
│   │   └── Security/
│   │       └── BCryptPasswordHasher.cs
│   │
│   └── Haros.HRMIS.Presentation/                # Presentation Layer (WPF Desktop App)
│       ├── App.xaml / App.xaml.cs
│       ├── MainWindow.xaml / MainWindow.xaml.cs # Master shell window
│       ├── Assets/
│       │   ├── Icons/
│       │   ├── Images/
│       │   └── Fonts/
│       ├── Styles/
│       │   ├── Colors.xaml                      # Institutional color palette
│       │   ├── Typography.xaml                  # Segoe UI Variable hierarchies
│       │   ├── ButtonStyles.xaml
│       │   ├── DataGridStyles.xaml
│       │   └── DialogStyles.xaml
│       ├── Controls/                            # Custom & Reusable UI Controls
│       │   ├── KpiSummaryCard.xaml
│       │   ├── FilterToolbar.xaml
│       │   ├── SearchableDataGrid.xaml
│       │   ├── BreadcrumbBar.xaml
│       │   ├── MovementTimelineView.xaml
│       │   ├── DocumentViewerDialog.xaml
│       │   └── ConfirmationDialog.xaml
│       ├── Views/                               # 16 Primary Screen Views
│       │   ├── Dashboard/DashboardView.xaml
│       │   ├── Staff/
│       │   │   ├── StaffRegisterView.xaml
│       │   │   ├── StaffProfileDetailView.xaml  # 12-tab dossier layout
│       │   │   └── StaffFormDialog.xaml
│       │   ├── Organization/OrganizationView.xaml
│       │   ├── Movements/
│       │   │   ├── MovementRegisterView.xaml
│       │   │   └── MovementWorkflowDialog.xaml
│       │   ├── Promotions/PromotionsView.xaml
│       │   ├── Recruitment/RecruitmentView.xaml
│       │   ├── Leave/LeaveManagementView.xaml
│       │   ├── Attendance/AttendanceView.xaml
│       │   ├── Training/TrainingView.xaml
│       │   ├── Performance/PerformanceView.xaml
│       │   ├── Payroll/PayrollView.xaml
│       │   ├── Retirement/RetirementForecastView.xaml
│       │   ├── Establishment/EstablishmentView.xaml
│       │   ├── Reports/ReportsCenterView.xaml
│       │   ├── Users/UserManagementView.xaml
│       │   ├── Settings/SystemConfigurationView.xaml
│       │   └── Auth/LoginWindow.xaml
│       ├── ViewModels/                          # MVVM ViewModels with CommunityToolkit.Mvvm
│       │   ├── ShellViewModel.cs
│       │   ├── DashboardViewModel.cs
│       │   ├── StaffRegisterViewModel.cs
│       │   ├── StaffProfileDetailViewModel.cs
│       │   ├── MovementRegisterViewModel.cs
│       │   └── ...
│       ├── Services/                            # Presentation Services
│       │   ├── NavigationService.cs
│       │   ├── DialogService.cs
│       │   └── ThemeService.cs
│       └── Converters/
│
├── tests/
│   ├── Haros.HRMIS.Domain.Tests/
│   ├── Haros.HRMIS.Application.Tests/
│   └── Haros.HRMIS.Infrastructure.Tests/
│
└── packaging/
    ├── inno-setup/
    │   ├── HRMIS-x86.iss                        # Inno Setup 32-bit compilation script
    │   └── HRMIS-x64.iss                        # Inno Setup 64-bit compilation script
    └── assets/                                  # App icons, banners, license files
```

---

## 2. Layered Architecture Flow

The application enforces unidirectional dependency flow:

```
+-------------------------------------------------------------------------------+
| PRESENTATION LAYER (WPF / XAML)                                               |
| Views <---> DataBinding <---> ViewModels (CommunityToolkit.Mvvm)              |
| NavigationService | NotificationService | ThemeService                        |
+--------------------------------------+----------------------------------------+
                                       | Dispatches Requests
                                       v
+-------------------------------------------------------------------------------+
| APPLICATION LAYER (MediatR / Commands / Queries / DTOs)                       |
| Use Case Pipelines | Validation Pipeline (FluentValidation)                   |
| Interceptors for Audit Trail & Unit of Work Coordination                      |
+--------------------------------------+----------------------------------------+
                                       | Operates On
                                       v
+-------------------------------------------------------------------------------+
| DOMAIN LAYER (Entities / Value Objects / Domain Events / Invariants)          |
| Invariant Rules: Zero Overwrite, Valid Effective Dates, Staff ID Uniqueness   |
+--------------------------------------+----------------------------------------+
                                       ^ Implements
                                       |
+-------------------------------------------------------------------------------+
| INFRASTRUCTURE LAYER (EF Core / SQLite WAL / File Store / QuestPDF / ClosedXML)|
| AppDbContext | Local Document Repository | Windows API Integrations           |
+-------------------------------------------------------------------------------+
```

---

## 3. Navigation Structure & Shell Layout

The main window features a **Windows 11 Fluent Navigation Shell** with a collapsible left-hand navigation pane, top breadcrumb toolbar, and bottom system status bar:

```
+------------------------------------------------------------------------------------+
|  [Logo] Haros HRMIS  |  Ministry of Finance - Head Office  |  [Theme] [User: Admin] v |
+------------------+-----------------------------------------------------------------+
| NAVIGATION PANE  | BREADCRUMB: Staff Management > Employee Dossier (EMP-00104)      |
| [Collapse/Expand]| SEARCH: [ Global quick search by Staff ID, Name, NIN...        ] |
|------------------+-----------------------------------------------------------------+
| [~] Dashboard    |                                                                 |
| [i] Staff Mgmt   |                                                                 |
| [T] Org Struct   |                                                                 |
| [>] Staff Move   |                       ACTIVE VIEW CONTAINER                     |
| [^] Promotions   |               (Dynamically swapped via NavigationService)        |
| [+] Recruitment  |                                                                 |
| [L] Leave Mgmt   |                                                                 |
| [A] Attendance   |                                                                 |
| [*] Training     |                                                                 |
| [#] Performance  |                                                                 |
| [$] Payroll      |                                                                 |
| [R] Retirement   |                                                                 |
| [E] Establishment|                                                                 |
| [=] Reports      |                                                                 |
| [U] Users & RBAC |                                                                 |
| [S] Settings     |                                                                 |
+------------------+-----------------------------------------------------------------+
| System Status: Database Connected (WAL Mode) | Station: HR-DESK-01 | Encrypted: Yes|
+------------------------------------------------------------------------------------+
```

---

## 4. Dashboard Layout & Analytics Screen

The Executive Dashboard serves as the command center for HR Directors and Senior Officers:

```
+------------------------------------------------------------------------------------+
| DASHBOARD FILTERS: [ MDA: All MDAs v ] [ Dept: All v ] [ Status: Active v ] [Refresh]|
+------------------------------------------------------------------------------------+
| SUMMARY KPI CARDS (Top Metric Band)                                                |
| +----------------+ +----------------+ +----------------+ +----------------+        |
| | Total Staff    | | Active Staff   | | Gender Ratio   | | Est. Vacancies |        |
| | 4,820          | | 4,685          | | M: 58% | F: 42%| | 142 Vacant     |        |
| | +32 this month | | 97.2% active   | | 2,717 / 1,968  | | 91.8% filled   |        |
| +----------------+ +----------------+ +----------------+ +----------------+        |
|                                                                                    |
| OPERATIONAL ALERTS BAND (Early Warning & Queues)                                   |
| [!] 28 Retiring in < 1 Year  |  [?] 45 Pending Movements  |  [*] 63 Eligible for Prom|
+------------------------------------------------------------------------------------+
| CHARTS & ANALYTICAL GRIDS (Two-Column Responsive Grid)                             |
| +--------------------------------------+ +---------------------------------------+ |
| | Departmental Staff Strength (Bar)    | | Staff by Grade Distribution (Pyramid) | |
| | Administration  [==================] | | Directorate / L17-L20    [==]         | |
| | Finance & Acc.  [==============    ] | | Senior Officers / L14-L16[======]     | |
| | Human Resource  [========          ] | | Middle Officers / L10-L13[==========] | |
| | Research & Stat [======            ] | | Junior Officers / L1-L9  [===========]| |
| +--------------------------------------+ +---------------------------------------+ |
| +--------------------------------------+ +---------------------------------------+ |
| | Recent Staff Movements (Live Feed)   | | Upcoming Statutory Retirements        | |
| | • John Mensah: Transfer -> MoF Head  | | • Sarah Addo (Chief Dir) - 14 Days    | |
| | • Grace Osei: Promotion -> Grade L16 | | • Robert K. Tawiah (L17) - 45 Days    | |
| | • K. Baah: Reassignment -> Tech Div  | | • Daniel Boateng (L15)   - 88 Days    | |
| +--------------------------------------+ +---------------------------------------+ |
+------------------------------------------------------------------------------------+
```

---

## 5. Employee Profile Layout (12-Tab Master Dossier)

When inspecting an employee profile, the system opens a unified dossier with a persistent header card and 12 dedicated operational tabs:

```
+------------------------------------------------------------------------------------+
| MASTER EMPLOYEE HEADER                                                             |
| [Photo]  KOFI KWAME MENSAH                     Staff ID:     MDA-EMP-00104         |
|          Principal Administrative Officer      Current MDA:  Ministry of Finance   |
|          Grade: Level 16 (Step 4)             Department:   Human Resource Mgmt   |
|          Status: Active | First Appt: 2012     Retirement:   14 Oct 2042 (16y rem) |
| [Action: Initiate Movement]  [Action: Promote]  [Action: Print Full CV]  [Edit]   |
+------------------------------------------------------------------------------------+
| DOSSIER TAB NAVIGATION:                                                            |
| [1.Overview] [2.Personal] [3.Employment] [4.Qualifications] [5.Memberships]        |
| [6.Dept History] [7.Movement History*] [8.Promotions] [9.Leave] [10.Training]      |
| [11.Performance] [12.Documents]                                                    |
+------------------------------------------------------------------------------------+
| SELECTED TAB CONTENT: [Tab 7: Movement History - Chronological Career Ledger]      |
|                                                                                    |
| (•) 15-Jan-2024 - LATTER IMPLEMENTED POSTING                                       |
|     Type: Intra-MDA Transfer | Ref: MOV-2024-0012 | Approved By: Dr. E. Quaye     |
|     From: Procurement Directorate (Senior Officer L15)                             |
|     To:   Human Resource Management Directorate (Principal Officer L16)           |
|     Reason: Operational Realignment & Establishment Upgrade                        |
|     [View Signed Transfer Letter.pdf]                                              |
|                                                                                    |
| (•) 01-Feb-2021 - PROMOTION MOVEMENT                                               |
|     Type: Grade Progression | Ref: PROM-2021-0084 | Approved By: Civil Service Com |
|     From: Administration Directorate (Officer L14, Step 3)                         |
|     To:   Procurement Directorate (Senior Officer L15, Step 1)                     |
|                                                                                    |
| (•) 01-Sep-2015 - INITIAL ASSUMPTION OF DUTY                                       |
|     Type: First Appointment | Ref: APPT-2015-0911 | Approved By: Head of Service   |
|     Assigned: Administration Directorate (Assistant L14, Step 1)                   |
+------------------------------------------------------------------------------------+
```

---

## 6. Main Application Screens Catalog

1. **Staff Register Screen:** Multi-criteria searchable data grid listing all active/inactive employees with quick search, advanced filters (age range, grade, MDA, department), Excel export, and New Staff onboarding button.
2. **Staff Movement Center:** Dual-pane workflow manager: left pane lists movement requests (`Draft`, `Submitted`, `Under Review`, `Approved`); right pane provides the implementation verification screen with diff preview (Previous vs. New placement) and approval sign-off.
3. **Organizational Hierarchy Viewer:** Interactive visual tree view of MDAs, Directorates, Departments, and Units with attached cadre metrics and employee rosters.
4. **Establishment & Cadre Monitor:** Departmental vacancy dashboard showing Approved Cadre, Occupied Cadre, Variance, and Overstaffing/Understaffing indicators with recruitment request triggers.
5. **Promotion Center:** Auto-calculated eligibility workbench highlighting employees meeting time-in-grade (3+ years) and appraisal thresholds, with bulk recommendation tools.
6. **Leave Management Board:** Calendar view and approval queue displaying department-level leave overlaps, individual leave balance cards, and resumption certifications.
7. **Retirement Forecaster:** Timeline view partitioning staff into 1-Year, 2-Year, and 3-Year retirement cohorts with clearance status tracking.
8. **Reports & Document Generation Center:** Centralized hub for generating and previewing the 20 statutory civil service reports with custom date/MDA filters, PDF generation (QuestPDF), and Excel generation (ClosedXML).
9. **Audit Trail Inspector:** Forensic search grid showing chronologically sorted before-and-after change diffs with actor, workstation, and module metadata.
10. **System Configuration & Backup Console:** Parameter management for institutional branding, grade scales, SSSS tables, automated backup schedules, and pre-restore safeguards.

---

## 7. Reusable UI Components

To maintain consistency and minimize code duplication, the presentation layer utilizes standardized custom WPF controls:

1. **`KpiSummaryCard`**: Renders metric value, title, icon, secondary trend badge, and click command.
2. **`SearchableDataGrid`**: Enhanced DataGrid featuring instant column filtering, sorting, custom column visibility toggle, pagination bar, and built-in "Export to Excel" button.
3. **`FilterToolbar`**: Collapsible header container with dropdown selectors for MDA, Department, Grade, Gender, and Status, accompanied by "Apply Filters" and "Reset" actions.
4. **`MovementTimelineView`**: Chronological vertical timeline rendering career movements with milestone badges, status tags, and document attachment links.
5. **`StatusBadge`**: Visual tag rendering standardized color-coded states (`Active` [Green], `On Probation` [Yellow], `Interdicted` [Red], `Separated` [Gray]).
6. **`ConfirmationDialog`**: Modal window requiring explicit confirmation and optional justification input before executing irreversible or state-altering actions.
7. **`DocumentViewerDialog`**: Embedded local document viewer for PDF and image scans with zoom, rotate, and print controls.

---

## 8. Design System Specification

### 8.1 Color Palette (Institutional Civil Service Theme)
- **Primary Institutional Navy:** `#0F2C59` (Command bars, window titles, active states)
- **Secondary Slate Blue:** `#1E4E8C` (Selection highlights, active tab indicators)
- **Accent Gold / Bronze:** `#D4AF37` (Civil service crest highlights, key metrics)
- **Surface / Background (Light):** `#F8FAFC` (Application canvas)
- **Surface / Background (Dark):** `#0F172A` (Windows 11 dark theme canvas)
- **Card Background:** `#FFFFFF` (Light) / `#1E293B` (Dark)
- **Border Subtle:** `#E2E8F0` (Light) / `#334155` (Dark)
- **Success / Active Green:** `#15803D`
- **Warning / Review Amber:** `#B45309`
- **Danger / Interdicted Red:** `#B91C1C`

### 8.2 Typography & Spacing
- **Font Family:** `Segoe UI Variable Text`, `Segoe UI`, `system-ui`
- **Type Scale:**
  - Page Title: 24px SemiBold
  - Section Header: 18px SemiBold
  - Card Metric Value: 28px Bold
  - DataGrid Header: 12px SemiBold (Uppercase)
  - DataGrid Cell: 13px Regular
  - Caption / Metadata: 11px Regular
- **Spacing Grid:** 4px baseline grid (4px, 8px, 12px, 16px, 24px, 32px padding).
- **Control Sizing:** 32px standard button/input height for high-density enterprise operations.
