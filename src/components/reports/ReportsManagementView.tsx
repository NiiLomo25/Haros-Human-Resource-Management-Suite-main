/**
 * Haros HRMIS - Comprehensive Statutory Reporting & Document Generation Engine (Section 18)
 * Implements all 20 Civil Service Reports + Employee Personal History Dossier Report
 * with Date, MDA, Department, Grade (position title only), Cadre, and Employee Status filtering,
 * plus Microsoft Excel (.xlsx), PDF (.pdf with page numbers), CSV, and Print exports.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Search,
  Building2,
  Calendar,
  Layers,
  Award,
  Users,
  ShieldAlert,
  ArrowRightLeft,
  GraduationCap,
  Scale,
  CreditCard,
  Hourglass,
  FileText,
  CheckCircle2,
  FileDown,
  RotateCcw,
  UserCheck,
  ArrowLeft,
} from 'lucide-react';
import { db } from '../../db/storage';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { SearchableSelect } from '../common/SearchableSelect';
import { BrandCrest } from '../common/BrandCrest';
import { useInstitutionInfo } from '../../hooks/useInstitutionInfo';
import { printPage } from '../../services/printService';
import {
  exportReportToCsv,
  exportReportToExcel,
  exportReportToPdf,
  exportPersonalHistoryToPdf,
  ReportExportMeta,
  ReportKpiMetric,
  ReportTabularData,
  PersonalHistorySection,
} from '../../services/reports/reportExporter';

interface ReportsManagementViewProps {
  onSelectEmployee?: (employeeId: number) => void;
}

export type StatutoryReportId =
  | 'nominal_roll'
  | 'staff_register'
  | 'departmental_register'
  | 'staff_by_grade'
  | 'cadre_diversity'
  | 'age_demographics'
  | 'qualifications'
  | 'mda_distribution'
  | 'movement_history'
  | 'promotion_progression'
  | 'recruitment_applicants'
  | 'retirement_forecast'
  | 'leave_register'
  | 'training_certifications'
  | 'performance_appraisal'
  | 'payroll_summary'
  | 'establishment_register'
  | 'vacancy_analysis'
  | 'separation_exit'
  | 'disciplinary_docket';

interface ReportDefinition {
  id: StatutoryReportId;
  code: string;
  title: string;
  category: 'Establishment & Staff' | 'Career & Movements' | 'Services & Leave' | 'Compensation & Exits';
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STATUTORY_REPORTS: ReportDefinition[] = [
  // Establishment & Staff
  {
    id: 'nominal_roll',
    code: 'REP-01',
    title: 'Staff Nominal Roll (Master Register)',
    category: 'Establishment & Staff',
    description: 'Statutory public service nominal roll detailing all confirmed officers, dates of appointment, grades, and postings.',
    icon: Users,
  },
  {
    id: 'staff_register',
    code: 'REP-02',
    title: 'Complete Staff Personnel Register',
    category: 'Establishment & Staff',
    description: 'Comprehensive roster with Ghana Card (NIA), contact details, skills/capabilities, and current duty status.',
    icon: FileText,
  },
  {
    id: 'departmental_register',
    code: 'REP-03',
    title: 'Departmental Staff Allocation Register',
    category: 'Establishment & Staff',
    description: 'Breakdown of personnel stationed across Directorates, Divisions, and Operational Units.',
    icon: Building2,
  },
  {
    id: 'staff_by_grade',
    code: 'REP-04',
    title: 'Staff Distribution by Grade Level',
    category: 'Establishment & Staff',
    description: 'Staff-level grade distribution, progression stream, years in current grade, and next grade hierarchy.',
    icon: Layers,
  },
  {
    id: 'cadre_diversity',
    code: 'REP-05',
    title: 'Cadre & Gender Diversity Report',
    category: 'Establishment & Staff',
    description: 'Gender parity indicators across Professional, Sub-Professional, and Technical bands.',
    icon: Award,
  },
  {
    id: 'age_demographics',
    code: 'REP-06',
    title: 'Age Demographics & Cohort Analysis',
    category: 'Establishment & Staff',
    description: 'Civil service workforce age profiling across age brackets (20-29, 30-39, 40-49, 50-59, 60+).',
    icon: Calendar,
  },
  {
    id: 'qualifications',
    code: 'REP-07',
    title: 'Staff Qualifications & Education Register',
    category: 'Establishment & Staff',
    description: 'Inventory of certified PhDs, Masters, Bachelor degrees, professional memberships, and verified capabilities.',
    icon: GraduationCap,
  },
  {
    id: 'mda_distribution',
    code: 'REP-08',
    title: 'Staff Distribution Across MDAs',
    category: 'Establishment & Staff',
    description: 'Comparative headcount and deployment density across central government ministries and commissions.',
    icon: Building2,
  },
  {
    id: 'establishment_register',
    code: 'REP-17',
    title: 'Staff Establishment & Cadre Quota Register',
    category: 'Establishment & Staff',
    description: 'Approved establishment positions, authorized cadre quotas vs. active in-post staffing.',
    icon: Scale,
  },
  {
    id: 'vacancy_analysis',
    code: 'REP-18',
    title: 'Vacancy & Staffing Variance Analysis',
    category: 'Establishment & Staff',
    description: 'Variance analysis identifying departments with critical understaffing or over-quota situations.',
    icon: Scale,
  },

  // Career & Movements
  {
    id: 'movement_history',
    code: 'REP-09',
    title: 'Staff Movements & Postings History',
    category: 'Career & Movements',
    description: 'Audit log of transfers, departmental redeployments, and secondments with reference numbers.',
    icon: ArrowRightLeft,
  },
  {
    id: 'promotion_progression',
    code: 'REP-10',
    title: 'Promotion History & Career Progression',
    category: 'Career & Movements',
    description: 'Promotion board approvals, seniority tracking, and years in current grade analysis.',
    icon: Award,
  },
  {
    id: 'recruitment_applicants',
    code: 'REP-11',
    title: 'Recruitment & Candidate Pipeline Report',
    category: 'Career & Movements',
    description: 'Public service recruitment applications, interview scores, and probationary appointment records.',
    icon: Users,
  },

  // Services & Leave
  {
    id: 'leave_register',
    code: 'REP-13',
    title: 'Annual & Statutory Leave Register',
    category: 'Services & Leave',
    description: 'Leave entitlements, taken days, and remaining balances across all approved leave categories.',
    icon: Calendar,
  },
  {
    id: 'training_certifications',
    code: 'REP-14',
    title: 'Training & Capacity Building Summary',
    category: 'Services & Leave',
    description: 'Civil service training programs, nominated officers, completion rates, and institutional expenditure.',
    icon: GraduationCap,
  },
  {
    id: 'performance_appraisal',
    code: 'REP-15',
    title: 'Annual Performance Appraisal Roster',
    category: 'Services & Leave',
    description: 'Civil service performance appraisal cycles, target achievements, and supervisor grading distribution.',
    icon: CheckCircle2,
  },

  // Compensation & Exits
  {
    id: 'retirement_forecast',
    code: 'REP-12',
    title: 'Retirement Horizon Forecast',
    category: 'Compensation & Exits',
    description: 'Statutory age or service milestone projections for succession planning.',
    icon: Hourglass,
  },
  {
    id: 'payroll_summary',
    code: 'REP-16',
    title: 'Single Spine Payroll & Wage Bill Summary',
    category: 'Compensation & Exits',
    description: 'Consolidated wage bill, SSSS basic salaries, allowances, SSNIT contributions, and PAYE tax remittances.',
    icon: CreditCard,
  },
  {
    id: 'separation_exit',
    code: 'REP-19',
    title: 'Separation Records & Exit Clearances',
    category: 'Compensation & Exits',
    description: 'Official retirements, resignations, and completed multi-unit property and financial clearances.',
    icon: Hourglass,
  },
  {
    id: 'disciplinary_docket',
    code: 'REP-20',
    title: 'Disciplinary Cases & Statutory Sanctions Docket',
    category: 'Compensation & Exits',
    description: 'Classified disciplinary inquiries, committee recommendations, and sanctioned code violations.',
    icon: ShieldAlert,
  },
];

interface BuiltReportOutput {
  kpis: ReportKpiMetric[];
  tabular: ReportTabularData;
  secondaryTitle?: string;
  secondaryTabular?: ReportTabularData;
  rowEmployeeIds?: (number | undefined)[];
}

export const ReportsManagementView: React.FC<ReportsManagementViewProps> = ({ onSelectEmployee }) => {
  const { currentUser, hasPermission, canAccessSubmenu } = useAuth();
  const notifications = useNotifications();

  const canPayrollReport =
    canAccessSubmenu('SUBMENU:/reports/payroll') ||
    hasPermission('PAYROLL_VIEW') ||
    hasPermission('PAYROLL_MANAGE');
  const canDisciplinaryReport =
    canAccessSubmenu('SUBMENU:/reports/disciplinary') ||
    hasPermission('DISCIPLINARY_VIEW') ||
    hasPermission('DISCIPLINARY_MANAGE') ||
    hasPermission('CONFIDENTIAL_VIEW');
  const canPersonalHistoryReport =
    canAccessSubmenu('SUBMENU:/reports/personal_history') || hasPermission('STAFF_VIEW');

  const visibleReports = useMemo(
    () =>
      STATUTORY_REPORTS.filter((r) => {
        if (r.id === 'payroll_summary') return canPayrollReport;
        if (r.id === 'disciplinary_docket') return canDisciplinaryReport;
        return true;
      }),
    [canPayrollReport, canDisciplinaryReport]
  );

  const [selectedReportId, setSelectedReportId] = useState<StatutoryReportId>('nominal_roll');
  const [personalHistoryEmployeeId, setPersonalHistoryEmployeeId] = useState<number | null>(null);

  const activeReportId: StatutoryReportId = useMemo(() => {
    if (visibleReports.some((r) => r.id === selectedReportId)) {
      return selectedReportId;
    }
    return visibleReports[0]?.id || 'nominal_roll';
  }, [visibleReports, selectedReportId]);

  useEffect(() => {
    if (visibleReports.length > 0 && !visibleReports.some((r) => r.id === selectedReportId)) {
      setSelectedReportId(visibleReports[0].id);
    }
  }, [visibleReports, selectedReportId]);

  useEffect(() => {
    if (!canPersonalHistoryReport && personalHistoryEmployeeId !== null) {
      setPersonalHistoryEmployeeId(null);
    }
  }, [canPersonalHistoryReport, personalHistoryEmployeeId]);

  // Filters (Date, MDA, Department, Grade, Cadre, Employee Status, Search)
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [periodPreset, setPeriodPreset] = useState<'ALL' | 'FY2026' | 'THIS_QUARTER' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [selectedMdaId, setSelectedMdaId] = useState<string>('ALL');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('ALL');
  const [selectedGradeId, setSelectedGradeId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Institutional settings from Section 24 System Configuration
  const { institutionName, institutionCountry } = useInstitutionInfo();
  const defaultCurrency = db.getSettingValue('DEFAULT_CURRENCY', 'GHS (Ghana Cedi)');
  const currencyCode = defaultCurrency.split(' ')[0] || 'GHS';

  // Load live lookup & transactional datasets
  const mdas = useMemo(() => db.getMdas(), []);
  const departments = useMemo(() => db.getDepartments(), []);
  const units = useMemo(() => db.getUnits(), []);
  const grades = useMemo(() => db.getGradeLevels(), []);
  const establishment = useMemo(() => db.getEstablishmentPositions(), []);
  const employees = useMemo(() => db.getEmployees(), []);
  const movements = useMemo(() => db.getStaffMovements(), []);
  const movementHistory = useMemo(() => db.getStaffMovementHistory(), []);
  const promotions = useMemo(() => db.getPromotionRecommendations(), []);
  const applicants = useMemo(() => db.getRecruitmentApplicants(), []);
  const leaveTypes = useMemo(() => db.getLeaveTypes(), []);
  const leaveBalances = useMemo(() => db.getLeaveBalances(), []);
  const leaveApps = useMemo(() => db.getLeaveApplications(), []);
  const trainingProgs = useMemo(() => db.getTrainingPrograms(), []);
  const trainingNoms = useMemo(() => db.getTrainingNominations(), []);
  const appraisals = useMemo(() => db.getPerformanceAppraisals(), []);
  const payrollRuns = useMemo(() => (canPayrollReport ? db.getPayrollRuns() : []), [canPayrollReport]);
  const payslips = useMemo(() => (canPayrollReport ? db.getEmployeePayslips() : []), [canPayrollReport]);
  const separations = useMemo(() => db.getSeparationRecords(), []);
  const disciplinary = useMemo(() => (canDisciplinaryReport ? db.getDisciplinaryCases() : []), [canDisciplinaryReport]);

  const scopedDepartments = useMemo(() => {
    if (selectedMdaId === 'ALL') return departments;
    return departments.filter((d) => d.mdaId.toString() === selectedMdaId);
  }, [departments, selectedMdaId]);

  const handleApplyPeriodPreset = (preset: 'ALL' | 'FY2026' | 'THIS_QUARTER' | 'THIS_MONTH' | 'CUSTOM') => {
    setPeriodPreset(preset);
    if (preset === 'ALL') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'FY2026') {
      setDateFrom('2026-01-01');
      setDateTo('2026-12-31');
    } else if (preset === 'THIS_QUARTER') {
      setDateFrom('2026-10-01');
      setDateTo('2026-12-31');
    } else if (preset === 'THIS_MONTH') {
      setDateFrom('2026-11-01');
      setDateTo('2026-11-30');
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setPeriodPreset('ALL');
    setSelectedMdaId('ALL');
    setSelectedDepartmentId('ALL');
    setSelectedGradeId('ALL');
    setSelectedCategory('ALL');
    setSelectedStatus('ALL');
  };

  const isWithinDateRange = (dateStr?: string): boolean => {
    if (!dateFrom && !dateTo) return true;
    if (!dateStr) return false;
    const normalized = dateStr.slice(0, 10);
    if (dateFrom && normalized < dateFrom) return false;
    if (dateTo && normalized > dateTo) return false;
    return true;
  };

  const matchesStaffDimensions = (empId?: number): boolean => {
    if (!empId) return true;
    const employment = db.getEmployeeEmploymentInfo(empId);
    const emp = employees.find((e) => e.id === empId);
    if (!employment || !emp) return false;

    if (selectedMdaId !== 'ALL' && employment.currentMdaId.toString() !== selectedMdaId) return false;
    if (selectedDepartmentId !== 'ALL' && employment.currentDepartmentId.toString() !== selectedDepartmentId) return false;
    if (selectedGradeId !== 'ALL' && employment.currentGradeId.toString() !== selectedGradeId) return false;
    if (selectedCategory !== 'ALL' && employment.employeeCategory !== selectedCategory) return false;

    if (selectedStatus === 'ACTIVE_ONLY') {
      if (employment.currentEmploymentStatus === 'Separated' || employment.currentEmploymentStatus === 'Retired' || !emp.isActive) {
        return false;
      }
    } else if (selectedStatus !== 'ALL' && employment.currentEmploymentStatus !== selectedStatus) {
      return false;
    }

    return true;
  };

  // Enriched employee dataset honoring all filters
  const enrichedEmployees = useMemo(() => {
    return employees
      .map((emp) => {
        const personal = db.getEmployeePersonalInfo(emp.id);
        const employment = db.getEmployeeEmploymentInfo(emp.id);
        const dept = departments.find((d) => d.id === employment?.currentDepartmentId);
        const mda = mdas.find((m) => m.id === employment?.currentMdaId);
        const grade = grades.find((g) => g.id === employment?.currentGradeId);
        const firstGrade = grades.find((g) => g.id === employment?.firstGradeId);
        const age = personal?.dateOfBirth ? db.calculateAge(personal.dateOfBirth) : 0;
        const yrsService = employment?.dateOfFirstAppointment
          ? db.calculateTotalYearsOfService(employment.dateOfFirstAppointment)
          : 0;
        const yrsGrade = employment?.dateAssignedCurrentGrade
          ? db.calculateYearsInCurrentGrade(employment.dateAssignedCurrentGrade)
          : 0;
        const mdaArrivalMovement = mda?.name
          ? movementHistory
              .filter(
                (h) =>
                  h.employeeId === emp.id &&
                  h.mdaNameTo === mda.name &&
                  h.mdaNameFrom !== h.mdaNameTo
              )
              .sort((a, b) => (b.effectiveDate || '').localeCompare(a.effectiveDate || ''))[0]
          : undefined;
        const ministryStartDate =
          mdaArrivalMovement?.effectiveDate ||
          employment?.dateOfAssumptionOfDuty ||
          employment?.dateOfFirstAppointment;
        const yrsMinistry = ministryStartDate
          ? db.calculateYearsInCurrentGrade(ministryStartDate)
          : 0;
        const qualifications = db.getEmployeeQualifications(emp.id);
        const memberships = db.getEmployeeMemberships(emp.id);
        const capabilities = db.getTrainingCapabilities(emp.id);
        const skills = db.getEmployeeSkills(emp.id);

        return {
          emp,
          personal,
          employment,
          dept,
          mda,
          grade,
          firstGrade,
          age,
          yrsService,
          yrsGrade,
          yrsMinistry,
          qualifications,
          memberships,
          capabilities,
          skills,
        };
      })
      .filter((row) => {
        if (selectedMdaId !== 'ALL' && row.employment?.currentMdaId.toString() !== selectedMdaId) return false;
        if (selectedDepartmentId !== 'ALL' && row.employment?.currentDepartmentId.toString() !== selectedDepartmentId)
          return false;
        if (selectedGradeId !== 'ALL' && row.employment?.currentGradeId.toString() !== selectedGradeId) return false;
        if (selectedCategory !== 'ALL' && row.employment?.employeeCategory !== selectedCategory) return false;

        if (selectedStatus === 'ACTIVE_ONLY') {
          if (
            row.employment?.currentEmploymentStatus === 'Separated' ||
            row.employment?.currentEmploymentStatus === 'Retired' ||
            !row.emp.isActive
          ) {
            return false;
          }
        } else if (selectedStatus !== 'ALL' && row.employment?.currentEmploymentStatus !== selectedStatus) {
          return false;
        }

        if (searchTerm.trim() !== '') {
          const q = searchTerm.toLowerCase();
          const matchName = row.personal?.fullName.toLowerCase().includes(q);
          const matchStaffId = row.emp.staffId.toLowerCase().includes(q);
          const matchPos = row.employment?.currentPositionTitle.toLowerCase().includes(q);
          const matchGrade = row.grade?.gradeName.toLowerCase().includes(q);
          const matchDept = row.dept?.departmentName.toLowerCase().includes(q);
          const matchPhone = row.personal?.telephoneNumber?.toLowerCase().includes(q);
          const matchOtherContacts = row.personal?.otherContacts?.some((c) => c.toLowerCase().includes(q));
          const matchFirstGrade = row.firstGrade?.gradeName.toLowerCase().includes(q);
          const matchPrevPosting = row.employment?.previousPosting?.toLowerCase().includes(q);
          if (!matchName && !matchStaffId && !matchPos && !matchGrade && !matchDept && !matchPhone && !matchOtherContacts && !matchFirstGrade && !matchPrevPosting) return false;
        }
        return true;
      });
  }, [
    employees,
    departments,
    mdas,
    grades,
    movementHistory,
    selectedMdaId,
    selectedDepartmentId,
    selectedGradeId,
    selectedCategory,
    selectedStatus,
    searchTerm,
  ]);

  const currentReport = visibleReports.find((r) => r.id === activeReportId) || visibleReports[0];

  const reportingPeriodLabel = useMemo(() => {
    if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`;
    if (dateFrom) return `From ${dateFrom} onwards`;
    if (dateTo) return `Up to ${dateTo}`;
    return `Cumulative Register (As at ${new Date().toLocaleDateString('en-GB')})`;
  }, [dateFrom, dateTo]);

  const appliedFiltersSummary = useMemo(() => {
    const parts: string[] = [];
    if (selectedMdaId !== 'ALL') {
      const m = mdas.find((x) => x.id.toString() === selectedMdaId);
      parts.push(`MDA: ${m?.name || selectedMdaId}`);
    }
    if (selectedDepartmentId !== 'ALL') {
      const d = departments.find((x) => x.id.toString() === selectedDepartmentId);
      parts.push(`Dept: ${d?.departmentName || selectedDepartmentId}`);
    }
    if (selectedGradeId !== 'ALL') {
      const g = grades.find((x) => x.id.toString() === selectedGradeId);
      parts.push(`Grade: ${g?.gradeName || selectedGradeId}`);
    }
    if (selectedCategory !== 'ALL') parts.push(`Cadre: ${selectedCategory}`);
    if (selectedStatus !== 'ALL') parts.push(`Status: ${selectedStatus === 'ACTIVE_ONLY' ? 'Active Workforce Only' : selectedStatus}`);
    if (searchTerm.trim()) parts.push(`Query: "${searchTerm.trim()}"`);
    return parts.length > 0 ? parts.join(' | ') : 'All MDAs, Departments, Grades & Statuses';
  }, [selectedMdaId, selectedDepartmentId, selectedGradeId, selectedCategory, selectedStatus, searchTerm, mdas, departments, grades]);

  // Build dedicated data for authorized statutory reports
  const builtReport = useMemo<BuiltReportOutput>(() => {
    const qLower = searchTerm.trim().toLowerCase();

    switch (activeReportId) {
      // REP-01: Staff Nominal Roll
      case 'nominal_roll': {
        const list = enrichedEmployees.filter((e) =>
          dateFrom || dateTo ? isWithinDateRange(e.employment?.dateOfFirstAppointment) : true
        );
        const activeCount = list.filter(
          (e) => e.emp.isActive && e.employment?.currentEmploymentStatus !== 'Separated' && e.employment?.currentEmploymentStatus !== 'Retired'
        ).length;
        return {
          kpis: [
            { label: 'Nominal Roll Headcount', value: `${list.length} Officers` },
            { label: 'Active In-Post', value: `${activeCount} Officers` },
            { label: 'MDAs Represented', value: `${new Set(list.map((e) => e.mda?.id).filter(Boolean)).size}` },
            { label: 'Avg Service Tenure', value: list.length ? `${(list.reduce((s, e) => s + e.yrsService, 0) / list.length).toFixed(1)} Yrs` : '0.0 Yrs' },
          ],
          tabular: {
            headers: ['Staff ID', 'Officer Full Name', 'Sex', 'MDA', 'Department', 'Substantive Position', 'Grade Title', 'Cadre', '1st Appt Date', 'Retirement Date', 'Status', 'First Grade', 'Current Promotion Date', 'Previous Posting'],
            rows: list.map((e) => [
              e.emp.staffId,
              e.personal?.fullName || '',
              e.personal?.gender || '',
              e.mda?.code || '',
              e.dept?.departmentName || '',
              e.employment?.currentPositionTitle || '',
              e.grade?.gradeName || '',
              e.employment?.employeeCategory || '',
              e.employment?.dateOfFirstAppointment || '',
              e.employment?.statutoryRetirementDate || '',
              e.employment?.currentEmploymentStatus || '',
              e.firstGrade?.gradeName || 'N/A',
              e.employment?.currentPromotionDate || 'N/A',
              e.employment?.previousPosting || 'N/A',
            ]),
          },
          rowEmployeeIds: list.map((e) => e.emp.id),
        };
      }

      // REP-02: Complete Staff Personnel Register
      case 'staff_register': {
        const list = enrichedEmployees.filter((e) =>
          dateFrom || dateTo ? isWithinDateRange(e.employment?.dateOfFirstAppointment) : true
        );
        return {
          kpis: [
            { label: 'Total Personnel Records', value: `${list.length}` },
            { label: 'Verified NIA Cards', value: `${list.filter((e) => Boolean(e.personal?.nationalIdentificationNumber)).length}` },
            { label: 'Mapped Skills', value: `${list.reduce((s, e) => s + e.skills.length, 0)}` },
            { label: 'Training Capabilities', value: `${list.reduce((s, e) => s + e.capabilities.length, 0)}` },
          ],
          tabular: {
            headers: [
              'Staff ID',
              'Officer Full Name',
              'DOB (Age)',
              'Gender / Marital',
              'Ghana Card (NIA)',
              'Telephone',
              'Official Email',
              'Ministry & Grade',
              'Yrs in Current Grade',
              'Yrs in Current Ministry',
              'Capabilities / Skills',
              'Status',
              'Other Contact(s)',
              'First Grade',
              'Current Promotion Date',
              'Previous Posting',
            ],
            rows: list.map((e) => [
              e.emp.staffId,
              e.personal?.fullName || '',
              `${e.personal?.dateOfBirth || 'N/A'} (${e.age}y)`,
              `${e.personal?.gender || ''} • ${e.personal?.maritalStatus || ''}`,
              e.personal?.nationalIdentificationNumber || 'Pending',
              e.personal?.telephoneNumber || '',
              e.personal?.emailAddress || '',
              `${e.mda?.name || ''} (${e.grade?.gradeName || ''})`,
              `${e.yrsGrade.toFixed(1)} yrs`,
              `${e.yrsMinistry.toFixed(1)} yrs`,
              `${e.capabilities.length} Caps / ${e.skills.length} Skills`,
              e.employment?.currentEmploymentStatus || '',
              (e.personal?.otherContacts || []).join('; ') || '',
              e.firstGrade?.gradeName || 'N/A',
              e.employment?.currentPromotionDate || 'N/A',
              e.employment?.previousPosting || 'N/A',
            ]),
          },
          rowEmployeeIds: list.map((e) => e.emp.id),
        };
      }

      // REP-03: Departmental Staff Allocation Register
      case 'departmental_register': {
        const filteredDepts = scopedDepartments.filter((d) => {
          if (selectedDepartmentId !== 'ALL' && d.id.toString() !== selectedDepartmentId) return false;
          if (qLower) {
            return d.departmentName.toLowerCase().includes(qLower) || d.departmentCode.toLowerCase().includes(qLower);
          }
          return true;
        });
        const rows = filteredDepts.map((dept) => {
          const deptEmps = enrichedEmployees.filter((e) => e.employment?.currentDepartmentId === dept.id);
          const mda = mdas.find((m) => m.id === dept.mdaId);
          const hod = dept.departmentHeadEmployeeId ? db.getEmployeePersonalInfo(dept.departmentHeadEmployeeId) : null;
          const male = deptEmps.filter((e) => e.personal?.gender === 'Male').length;
          const female = deptEmps.filter((e) => e.personal?.gender === 'Female').length;
          const quota = establishment
            .filter((est) => est.departmentId === dept.id)
            .reduce((sum, est) => sum + est.approvedCadreQuota, 0);
          return [
            dept.departmentCode,
            mda?.name || '',
            dept.departmentName,
            hod ? hod.fullName : 'Vacant',
            deptEmps.length,
            `${male} M / ${female} F`,
            quota,
            quota - deptEmps.length,
            dept.status,
          ];
        });
        return {
          kpis: [
            { label: 'Departments Covered', value: `${filteredDepts.length}` },
            { label: 'Assigned Staff', value: `${rows.reduce((s, r) => s + Number(r[4]), 0)}` },
            { label: 'Authorized Est. Quota', value: `${rows.reduce((s, r) => s + Number(r[6]), 0)}` },
            { label: 'Net Department Variance', value: `${rows.reduce((s, r) => s + Number(r[7]), 0)}` },
          ],
          tabular: {
            headers: ['Dept Code', 'Parent MDA', 'Department Name', 'Head of Department', 'In-Post Staff', 'Gender Split', 'Est. Quota', 'Vacancies', 'Status'],
            rows,
            summaryRow: [
              'TOTAL',
              '',
              `${filteredDepts.length} Directorates / Units`,
              '',
              rows.reduce((s, r) => s + Number(r[4]), 0),
              '',
              rows.reduce((s, r) => s + Number(r[6]), 0),
              rows.reduce((s, r) => s + Number(r[7]), 0),
              '',
            ],
          },
        };
      }

      // REP-04: Staff Distribution by Grade Level (Staff-Level Progression Details)
      case 'staff_by_grade': {
        const list = enrichedEmployees.filter((e) =>
          dateFrom || dateTo ? isWithinDateRange(e.employment?.dateAssignedCurrentGrade) : true
        );

        let automaticCount = 0;
        let competitiveCount = 0;
        let totalYrsInGrade = 0;
        let validGradeDateCount = 0;
        let eligibleTenureCount = 0;

        const rows = list.map((e) => {
          const posTitle = (e.employment?.currentPositionTitle || '').trim();
          const gradeName = (e.grade?.gradeName || '').trim();
          const positionOrGrade =
            posTitle && gradeName && posTitle.toLowerCase() !== gradeName.toLowerCase()
              ? `${posTitle} / ${gradeName}`
              : gradeName || posTitle || 'N/A';

          const cadreCategory = e.grade?.cadreCategory || e.employment?.employeeCategory || 'General';
          const isCompetitive =
            e.grade?.progressionMode === 'Competitive' || Boolean(e.grade?.isSeniorManagement);
          const minYrs = e.grade?.minYearsInGradeForPromotion ?? (isCompetitive ? 5 : 3);
          const progressionStream = isCompetitive
            ? `Competitive Merit (${minYrs} Yrs)`
            : `Automatic (${minYrs} Yrs)`;

          if (isCompetitive) {
            competitiveCount += 1;
          } else {
            automaticCount += 1;
          }

          const gradeApptDate = e.employment?.dateAssignedCurrentGrade;
          const hasGradeDate = Boolean(gradeApptDate) && !Number.isNaN(new Date(gradeApptDate!).getTime());
          const yrsInGrade = hasGradeDate ? db.calculateYearsInCurrentGrade(gradeApptDate!) : 0;
          if (hasGradeDate) {
            totalYrsInGrade += yrsInGrade;
            validGradeDateCount += 1;
          }

          const nextGrade = db.getNextGradeLabel(e.grade, grades, e.employment?.currentPositionTitle);
          if (hasGradeDate && yrsInGrade >= minYrs && nextGrade !== 'Peak Grade' && nextGrade !== 'N/A') {
            eligibleTenureCount += 1;
          }

          return [
            e.personal?.fullName || 'N/A',
            e.emp.staffId,
            positionOrGrade,
            cadreCategory,
            progressionStream,
            hasGradeDate ? `${yrsInGrade.toFixed(1)} yrs` : 'N/A',
            nextGrade,
            e.firstGrade?.gradeName || 'N/A',
            e.employment?.currentPromotionDate || 'N/A',
          ];
        });

        const avgYears = validGradeDateCount > 0 ? (totalYrsInGrade / validGradeDateCount).toFixed(1) : '0.0';

        return {
          kpis: [
            { label: 'Staff Matched', value: `${list.length}` },
            { label: 'Automatic Track', value: `${automaticCount}` },
            { label: 'Competitive Merit Track', value: `${competitiveCount}` },
            { label: 'Avg Years in Grade', value: `${avgYears} Yrs (${eligibleTenureCount} Tenure-Due)` },
          ],
          tabular: {
            headers: [
              'Name',
              'Staff ID',
              'Position Title / Grade Designation',
              'Cadre Category',
              'Progression Stream',
              'Years in Current Grade',
              'Next Grade',
              'First Grade',
              'Current Promotion Date',
            ],
            rows,
            summaryRow: [
              'TOTAL',
              `${list.length} Officers`,
              '',
              '',
              '',
              `${avgYears} yrs avg`,
              `${eligibleTenureCount} Due`,
              '',
              '',
            ],
          },
          rowEmployeeIds: list.map((e) => e.emp.id),
        };
      }

      // REP-05: Cadre & Gender Diversity Report
      case 'cadre_diversity': {
        const categories = ['Professional', 'Sub-Professional', 'Technical', 'Administrative', 'Consultant'];
        const total = enrichedEmployees.length || 1;
        const maleTotal = enrichedEmployees.filter((e) => e.personal?.gender === 'Male').length;
        const femaleTotal = enrichedEmployees.filter((e) => e.personal?.gender === 'Female').length;
        const matrixRows = categories.map((cat) => {
          const group = enrichedEmployees.filter((e) => e.employment?.employeeCategory === cat);
          const m = group.filter((e) => e.personal?.gender === 'Male').length;
          const f = group.filter((e) => e.personal?.gender === 'Female').length;
          const femalePct = group.length ? ((f / group.length) * 100).toFixed(1) : '0.0';
          const sharePct = ((group.length / total) * 100).toFixed(1);
          return [cat, m, f, group.length, `${femalePct}%`, `${sharePct}%`];
        });
        return {
          kpis: [
            { label: 'Total Workforce', value: `${enrichedEmployees.length}` },
            { label: 'Male Officers', value: `${maleTotal} (${((maleTotal / total) * 100).toFixed(1)}%)` },
            { label: 'Female Officers', value: `${femaleTotal} (${((femaleTotal / total) * 100).toFixed(1)}%)` },
            { label: 'Professional Cadre', value: `${enrichedEmployees.filter((e) => e.employment?.employeeCategory === 'Professional').length}` },
          ],
          tabular: {
            headers: ['Cadre Classification', 'Male', 'Female', 'Total Officers', 'Female Representation', 'Workforce Share'],
            rows: matrixRows,
            summaryRow: [
              'ALL CADRES',
              maleTotal,
              femaleTotal,
              enrichedEmployees.length,
              `${((femaleTotal / total) * 100).toFixed(1)}%`,
              '100.0%',
            ],
          },
          secondaryTitle: 'Officer Roster by Gender & Cadre Classification',
          secondaryTabular: {
            headers: ['Staff ID', 'Officer Name', 'Gender', 'Cadre', 'MDA / Department', 'Grade Title', 'Status'],
            rows: enrichedEmployees.map((e) => [
              e.emp.staffId,
              e.personal?.fullName || '',
              e.personal?.gender || '',
              e.employment?.employeeCategory || '',
              `${e.mda?.code || ''} • ${e.dept?.departmentName || ''}`,
              e.grade?.gradeName || '',
              e.employment?.currentEmploymentStatus || '',
            ]),
          },
          rowEmployeeIds: enrichedEmployees.map((e) => e.emp.id),
        };
      }

      // REP-06: Age Demographics & Cohort Analysis
      case 'age_demographics': {
        const cohorts = [
          { label: 'Under 25 Years', min: 0, max: 24 },
          { label: '25 – 29 Years', min: 25, max: 29 },
          { label: '30 – 39 Years', min: 30, max: 39 },
          { label: '40 – 49 Years', min: 40, max: 49 },
          { label: '50 – 59 Years (Pre-Retirement)', min: 50, max: 59 },
          { label: '60+ Years (Statutory Exit)', min: 60, max: 120 },
        ];
        const total = enrichedEmployees.length || 1;
        const avgAge = enrichedEmployees.length
          ? (enrichedEmployees.reduce((s, e) => s + e.age, 0) / enrichedEmployees.length).toFixed(1)
          : '0.0';
        const cohortRows = cohorts.map((c) => {
          const group = enrichedEmployees.filter((e) => e.age >= c.min && e.age <= c.max);
          const m = group.filter((e) => e.personal?.gender === 'Male').length;
          const f = group.filter((e) => e.personal?.gender === 'Female').length;
          const avgServ = group.length
            ? (group.reduce((s, e) => s + e.yrsService, 0) / group.length).toFixed(1)
            : '0.0';
          return [
            c.label,
            group.length,
            `${((group.length / total) * 100).toFixed(1)}%`,
            `${m} M / ${f} F`,
            `${avgServ} Yrs`,
          ];
        });
        return {
          kpis: [
            { label: 'Workforce Sample', value: `${enrichedEmployees.length} Officers` },
            { label: 'Mean Civil Service Age', value: `${avgAge} Years` },
            { label: 'Cohort 50–59 Yrs', value: `${enrichedEmployees.filter((e) => e.age >= 50 && e.age <= 59).length} Officers` },
            { label: 'Under 35 Yrs Talent', value: `${enrichedEmployees.filter((e) => e.age < 35).length} Officers` },
          ],
          tabular: {
            headers: ['Age Cohort Bracket', 'Headcount', 'Share (%)', 'Gender Split', 'Avg Years of Service'],
            rows: cohortRows,
            summaryRow: ['TOTAL WORKFORCE', enrichedEmployees.length, '100.0%', '', `${avgAge} Avg Age`],
          },
          secondaryTitle: 'Individual Officer Age & Tenure Profile',
          secondaryTabular: {
            headers: ['Staff ID', 'Officer Name', 'Date of Birth', 'Current Age', '1st Appt Date', 'Years of Service', 'MDA / Department', 'Grade Title'],
            rows: [...enrichedEmployees]
              .sort((a, b) => b.age - a.age)
              .map((e) => [
                e.emp.staffId,
                e.personal?.fullName || '',
                e.personal?.dateOfBirth || '',
                `${e.age} Yrs`,
                e.employment?.dateOfFirstAppointment || '',
                `${e.yrsService.toFixed(1)} Yrs`,
                [e.mda?.name, e.dept?.departmentName].filter(Boolean).join(' — '),
                e.grade?.gradeName || '',
              ]),
          },
        };
      }

      // REP-07: Staff Qualifications, Memberships, Capabilities & Skills Register
      case 'qualifications': {
        const qualRows: (string | number)[][] = [];
        let verifiedCount = 0;
        let postgradCount = 0;
        let skillsCount = 0;
        enrichedEmployees.forEach((e) => {
          skillsCount += e.skills.length;
          const memberSummary = e.memberships.map((m) => `${m.professionalBody} (${m.membershipCategory})`).join('; ') || 'None';
          const skillsSummary = e.skills.map((s) => `${s.skillName} [${s.category}]`).join(', ') || 'None';
          const capsSummary = e.capabilities.map((c) => c.capability).join('; ') || 'None';

          if (e.qualifications.length === 0) {
            qualRows.push([
              e.emp.staffId,
              e.personal?.fullName || '',
              `${e.mda?.name || ''} • ${e.grade?.gradeName || ''}`,
              'On File (Pending Entry)',
              '—',
              'Pending',
              memberSummary,
              skillsSummary,
              capsSummary,
            ]);
          } else {
            e.qualifications.forEach((q) => {
              if (q.verificationStatus === 'Verified') verifiedCount++;
              if (q.qualificationLevel === 'Master' || q.qualificationLevel === 'PhD' || q.qualificationLevel === 'Doctorate') {
                postgradCount++;
              }
              qualRows.push([
                e.emp.staffId,
                e.personal?.fullName || '',
                `${e.mda?.name || ''} • ${e.grade?.gradeName || ''}`,
                `${q.qualificationLevel}: ${q.qualificationTitle}`,
                `${q.institutionName} (${q.yearObtained})`,
                q.verificationStatus,
                memberSummary,
                skillsSummary,
                capsSummary,
              ]);
            });
          }
        });
        return {
          kpis: [
            { label: 'Qualification Entries', value: `${qualRows.length}` },
            { label: 'Verified Credentials', value: `${verifiedCount}` },
            { label: 'Postgraduate (MSc/PhD)', value: `${postgradCount}` },
            { label: 'Verified Staff Skills', value: `${skillsCount}` },
          ],
          tabular: {
            headers: ['Staff ID', 'Officer Name', 'MDA & Grade', 'Academic Qualification', 'Awarding Institution & Year', 'Verification', 'Professional Memberships', 'Possessed Skills', 'Training Capabilities'],
            rows: qualRows,
          },
        };
      }

      // REP-08: Staff Distribution Across MDAs
      case 'mda_distribution': {
        const filteredMdas = mdas.filter((m) => {
          if (selectedMdaId !== 'ALL' && m.id.toString() !== selectedMdaId) return false;
          if (qLower) return m.name.toLowerCase().includes(qLower) || m.code.toLowerCase().includes(qLower);
          return true;
        });
        const totalAll = enrichedEmployees.length || 1;
        const rows = filteredMdas.map((mda) => {
          const mdaEmps = enrichedEmployees.filter((e) => e.employment?.currentMdaId === mda.id);
          const mdaDepts = departments.filter((d) => d.mdaId === mda.id);
          const mdaDeptIds = new Set(mdaDepts.map((d) => d.id));
          const quota = establishment
            .filter((est) => mdaDeptIds.has(est.departmentId))
            .reduce((s, est) => s + est.approvedCadreQuota, 0);
          const male = mdaEmps.filter((e) => e.personal?.gender === 'Male').length;
          const female = mdaEmps.filter((e) => e.personal?.gender === 'Female').length;
          const head = mda.headEmployeeId ? db.getEmployeePersonalInfo(mda.headEmployeeId)?.fullName : 'Vacant';
          const density = quota > 0 ? `${((mdaEmps.length / quota) * 100).toFixed(1)}%` : 'N/A';
          return [
            mda.code,
            mda.name,
            mda.mdaType,
            mdaDepts.length,
            head || 'Vacant',
            mdaEmps.length,
            `${((mdaEmps.length / totalAll) * 100).toFixed(1)}%`,
            `${male} M / ${female} F`,
            quota,
            density,
          ];
        });
        return {
          kpis: [
            { label: 'MDAs Reported', value: `${filteredMdas.length}` },
            { label: 'Total Deployed Staff', value: `${enrichedEmployees.length}` },
            { label: 'Directorates / Units', value: `${rows.reduce((s, r) => s + Number(r[3]), 0)}` },
            { label: 'Total Est. Ceiling', value: `${rows.reduce((s, r) => s + Number(r[8]), 0)}` },
          ],
          tabular: {
            headers: ['MDA Code', 'Ministry / Department / Agency', 'Classification', 'Depts', 'Head of MDA', 'In-Post Staff', 'Share (%)', 'Gender Split', 'Approved Quota', 'Fill Rate'],
            rows,
            summaryRow: ['TOTAL', `${filteredMdas.length} Institutions`, '', rows.reduce((s, r) => s + Number(r[3]), 0), '', enrichedEmployees.length, '100.0%', '', rows.reduce((s, r) => s + Number(r[8]), 0), ''],
          },
        };
      }

      // REP-09: Staff Movements & Postings History (Workflow Directives + Immutable Ledger)
      case 'movement_history': {
        const filteredMovs = movements.filter((m) => {
          if (!isWithinDateRange(m.effectiveDate)) return false;
          if (!matchesStaffDimensions(m.employeeId)) return false;
          if (qLower) {
            const p = db.getEmployeePersonalInfo(m.employeeId);
            const emp = employees.find((e) => e.id === m.employeeId);
            const matchText =
              m.movementReferenceNumber.toLowerCase().includes(qLower) ||
              m.movementType.toLowerCase().includes(qLower) ||
              (p?.fullName || '').toLowerCase().includes(qLower) ||
              (emp?.staffId || '').toLowerCase().includes(qLower);
            if (!matchText) return false;
          }
          return true;
        });

        const filteredLedger = movementHistory.filter((h) => {
          if (!isWithinDateRange(h.effectiveDate)) return false;
          if (!matchesStaffDimensions(h.employeeId)) return false;
          if (qLower) {
            const p = db.getEmployeePersonalInfo(h.employeeId);
            const matchText =
              h.movementReferenceNumber.toLowerCase().includes(qLower) ||
              h.movementType.toLowerCase().includes(qLower) ||
              (p?.fullName || '').toLowerCase().includes(qLower) ||
              h.departmentNameTo.toLowerCase().includes(qLower);
            if (!matchText) return false;
          }
          return true;
        });

        return {
          kpis: [
            { label: 'Posting Directives', value: `${filteredMovs.length}` },
            { label: 'Implemented Moves', value: `${filteredMovs.filter((m) => m.workflowStatus === 'Implemented').length}` },
            { label: 'Pending Approval', value: `${filteredMovs.filter((m) => ['Draft', 'Submitted', 'Under Review'].includes(m.workflowStatus)).length}` },
            { label: 'Immutable Ledger Entries', value: `${filteredLedger.length}` },
          ],
          tabular: {
            headers: ['Movement Ref', 'Staff ID', 'Officer Name', 'Movement Type', 'From Posting', 'To Posting', 'Effective Date', 'Workflow Status'],
            rows: filteredMovs.map((m) => {
              const emp = employees.find((e) => e.id === m.employeeId);
              const p = emp ? db.getEmployeePersonalInfo(emp.id) : null;
              const fromMda = mdas.find((mda) => mda.id === m.previousMdaId);
              const toMda = mdas.find((mda) => mda.id === m.newMdaId);
              const fromDept = departments.find((d) => d.id === m.previousDepartmentId);
              const toDept = departments.find((d) => d.id === m.newDepartmentId);
              const fromGrade = grades.find((g) => g.id === m.previousGradeId);
              return [
                m.movementReferenceNumber,
                emp?.staffId || 'N/A',
                p?.fullName || 'N/A',
                m.movementType,
                `${fromMda?.name || 'N/A'} (${fromGrade?.gradeName || 'N/A'}) • ${fromDept?.departmentName || 'N/A'}`,
                `${toMda?.name || 'N/A'} • ${toDept?.departmentName || 'N/A'}`,
                m.effectiveDate,
                m.workflowStatus,
              ];
            }),
          },
          secondaryTitle: 'Immutable Historical Movement Archive (Zero-Overwrite Ledger)',
          secondaryTabular: {
            headers: ['Ref Number', 'Officer Name', 'Type', 'Origin (MDA • Grade • Dept)', 'Destination (MDA • Dept)', 'Effective Date', 'Approved By'],
            rows: filteredLedger.map((h) => {
              const p = db.getEmployeePersonalInfo(h.employeeId);
              return [
                h.movementReferenceNumber,
                p?.fullName || `Emp #${h.employeeId}`,
                h.movementType,
                `${h.mdaNameFrom} (${h.gradeNameFrom}) • ${h.departmentNameFrom}`,
                `${h.mdaNameTo} • ${h.departmentNameTo}`,
                h.effectiveDate,
                h.approvedByOfficerName,
              ];
            }),
          },
        };
      }

      // REP-10: Promotion History & Career Progression
      case 'promotion_progression': {
        const filteredProms = promotions.filter((pr) => {
          if (!isWithinDateRange(pr.recommendationDate)) return false;
          if (!matchesStaffDimensions(pr.employeeId)) return false;
          if (qLower) {
            const p = db.getEmployeePersonalInfo(pr.employeeId);
            const emp = employees.find((e) => e.id === pr.employeeId);
            if (
              !(p?.fullName || '').toLowerCase().includes(qLower) &&
              !(emp?.staffId || '').toLowerCase().includes(qLower) &&
              !pr.boardReviewNotes.toLowerCase().includes(qLower)
            ) {
              return false;
            }
          }
          return true;
        });

        const eligList = enrichedEmployees.map((row) => ({
          row,
          evalRes: db.evaluatePromotionEligibility(row.emp.id),
        }));

        return {
          kpis: [
            { label: 'Board Recommendations', value: `${filteredProms.length}` },
            { label: 'Executed Promotions', value: `${filteredProms.filter((p) => p.status === 'Implemented').length}` },
            { label: 'Eligible Now', value: `${eligList.filter((x) => x.evalRes.isEligible).length}` },
            { label: 'Competitive Senior Track', value: `${eligList.filter((x) => x.evalRes.progressionType === 'Competitive Senior Promotion').length}` },
          ],
          tabular: {
            headers: ['Staff ID', 'Officer Name', 'Current Grade', 'Recommended Grade', 'Progression Stream', 'Yrs in Grade', 'Merit / SPAS Score', 'Conduct', 'Rec. Date', 'Board Status'],
            rows: filteredProms.map((pr) => {
              const emp = employees.find((e) => e.id === pr.employeeId);
              const p = db.getEmployeePersonalInfo(pr.employeeId);
              const curG = grades.find((g) => g.id === pr.currentGradeId);
              const recG = grades.find((g) => g.id === pr.recommendedGradeId);
              return [
                emp?.staffId || 'N/A',
                p?.fullName || 'N/A',
                curG?.gradeName || 'N/A',
                recG?.gradeName || 'N/A',
                pr.progressionType || 'Standard Progression',
                `${pr.yearsInCurrentGrade.toFixed(1)} yrs`,
                `${pr.competitiveExamScore ? `Exam ${pr.competitiveExamScore}% / ` : ''}SPAS ${pr.performanceAppraisalScore || 85}%`,
                pr.conductStatus || 'Cleared',
                pr.recommendationDate,
                pr.status,
              ];
            }),
          },
          secondaryTitle: 'Workforce Career Progression Eligibility Matrix (3-Yr Automatic / 5-Yr Competitive Merit)',
          secondaryTabular: {
            headers: ['Staff ID', 'Officer Name', 'MDA / Department', 'Current Grade', 'Years in Grade', 'Min Req.', 'Progression Stream', 'SPAS Appraisal', 'Projected Next Grade', 'Eligibility Status', 'First Grade', 'Current Promotion Date'],
            rows: eligList.map(({ row, evalRes }) => [
              row.emp.staffId,
              row.personal?.fullName || '',
              [row.mda?.name, row.dept?.departmentName].filter(Boolean).join(' — '),
              row.grade?.gradeName || '',
              `${evalRes.yearsInGrade.toFixed(1)} yrs`,
              `${evalRes.requiredYears} yrs`,
              evalRes.progressionType,
              `${evalRes.performanceScore}% (${evalRes.performanceRating})`,
              evalRes.suggestedTargetGrade ? evalRes.suggestedTargetGrade.gradeName : 'Peak Grade',
              evalRes.isEligible ? 'Eligible' : !evalRes.hasSufficientTimeInGrade ? 'Maturing' : 'Hold',
              row.firstGrade?.gradeName || 'N/A',
              row.employment?.currentPromotionDate || 'N/A',
            ]),
          },
        };
      }

      // REP-11: Recruitment & Candidate Pipeline Report
      case 'recruitment_applicants': {
        const filteredApps = applicants.filter((a) => {
          if (!isWithinDateRange(a.applicationDate)) return false;
          if (selectedMdaId !== 'ALL' && a.mdaId.toString() !== selectedMdaId) return false;
          if (selectedDepartmentId !== 'ALL' && a.departmentId.toString() !== selectedDepartmentId) return false;
          if (selectedGradeId !== 'ALL' && a.gradeId.toString() !== selectedGradeId) return false;
          if (selectedCategory !== 'ALL' && a.cadreCategory !== selectedCategory) return false;
          if (qLower) {
            const full = `${a.firstName} ${a.otherNames || ''} ${a.surname}`.toLowerCase();
            if (
              !full.includes(qLower) &&
              !a.applicantNumber.toLowerCase().includes(qLower) &&
              !a.vacancyPositionTitle.toLowerCase().includes(qLower)
            ) {
              return false;
            }
          }
          return true;
        });

        const avgScore = filteredApps.filter((a) => typeof a.interviewScore === 'number');
        return {
          kpis: [
            { label: 'Total Candidates', value: `${filteredApps.length}` },
            { label: 'Selected / Appointed', value: `${filteredApps.filter((a) => a.status === 'Selected' || a.status === 'Appointed').length}` },
            { label: 'Shortlisted / Interviewed', value: `${filteredApps.filter((a) => a.status === 'Shortlisted' || a.status === 'Interviewed').length}` },
            {
              label: 'Avg Interview Score',
              value: avgScore.length
                ? `${(avgScore.reduce((s, a) => s + (a.interviewScore || 0), 0) / avgScore.length).toFixed(1)}%`
                : 'N/A',
            },
          ],
          tabular: {
            headers: ['Applicant No', 'Candidate Full Name', 'Gender', 'Applied Position', 'Target Grade', 'Hiring MDA / Dept', 'Cadre', 'Qualification & Exp.', 'Interview Score', 'App. Date', 'Status'],
            rows: filteredApps.map((a) => {
              const mda = mdas.find((m) => m.id === a.mdaId);
              const dept = departments.find((d) => d.id === a.departmentId);
              const grade = grades.find((g) => g.id === a.gradeId);
              const full = [a.firstName, a.otherNames, a.surname].filter(Boolean).join(' ');
              return [
                a.applicantNumber,
                full,
                a.gender,
                a.vacancyPositionTitle,
                grade?.gradeName || '',
                `${mda?.code || ''} • ${dept?.departmentName || ''}`,
                a.cadreCategory,
                `${a.highestQualification} (${a.yearsOfExperience}y exp)`,
                a.interviewScore !== undefined ? `${a.interviewScore}%` : 'Pending',
                a.applicationDate,
                a.status,
              ];
            }),
          },
        };
      }

      // REP-12: Retirement Horizon Forecast
      case 'retirement_forecast': {
        const list = [...enrichedEmployees]
          .filter((e) =>
            dateFrom || dateTo ? isWithinDateRange(e.employment?.statutoryRetirementDate) : true
          )
          .sort(
            (a, b) =>
              new Date(a.employment?.statutoryRetirementDate || '').getTime() -
              new Date(b.employment?.statutoryRetirementDate || '').getTime()
          );

        const within12 = list.filter((r) => {
          const m = r.employment?.statutoryRetirementDate
            ? db.calculateMonthsToRetirement(r.employment.statutoryRetirementDate)
            : 999;
          return m <= 12;
        }).length;

        const within36 = list.filter((r) => {
          const m = r.employment?.statutoryRetirementDate
            ? db.calculateMonthsToRetirement(r.employment.statutoryRetirementDate)
            : 999;
          return m > 12 && m <= 36;
        }).length;

        return {
          kpis: [
            { label: 'Officers Tracked', value: `${list.length}` },
            { label: 'Retiring ≤ 12 Months', value: `${within12} Immediate` },
            { label: 'Retiring 13–36 Months', value: `${within36} Medium-Term` },
            { label: 'Policy Threshold', value: `${db.getNumericSetting('STATUTORY_RETIREMENT_AGE', 60)} Yrs / ${db.getNumericSetting('STATUTORY_SERVICE_YEARS', 35)} Yrs Service` },
          ],
          tabular: {
            headers: ['Staff ID', 'Officer Name', 'Current Age', 'Years of Service', 'MDA', 'Grade Title', 'Statutory Retirement Date', 'Months Remaining', 'Urgency Band'],
            rows: list.map((row) => {
              const months = row.employment?.statutoryRetirementDate
                ? db.calculateMonthsToRetirement(row.employment.statutoryRetirementDate)
                : 999;
              const urgency =
                months <= 6
                  ? 'Critical (≤ 6 Mos)'
                  : months <= 12
                  ? 'Immediate (≤ 12 Mos)'
                  : months <= 36
                  ? 'Medium-Term (1–3 Yrs)'
                  : 'Long-Term (> 3 Yrs)';
              return [
                row.emp.staffId,
                row.personal?.fullName || '',
                `${row.age} Yrs`,
                `${row.yrsService.toFixed(1)} Yrs`,
                row.mda?.name || '',
                row.grade?.gradeName || '',
                row.employment?.statutoryRetirementDate || '',
                `${months} Months`,
                urgency,
              ];
            }),
          },
          rowEmployeeIds: list.map((e) => e.emp.id),
        };
      }

      // REP-13: Annual & Statutory Leave Register
      case 'leave_register': {
        const filteredApps = leaveApps.filter((a) => {
          if (!isWithinDateRange(a.startDate)) return false;
          if (!matchesStaffDimensions(a.employeeId)) return false;
          if (qLower) {
            const p = db.getEmployeePersonalInfo(a.employeeId);
            const lt = leaveTypes.find((t) => t.id === a.leaveTypeId);
            if (
              !(p?.fullName || '').toLowerCase().includes(qLower) &&
              !a.leaveReferenceNumber.toLowerCase().includes(qLower) &&
              !(lt?.leaveName || '').toLowerCase().includes(qLower)
            ) {
              return false;
            }
          }
          return true;
        });

        const filteredBalances = leaveBalances.filter((b) => matchesStaffDimensions(b.employeeId));
        return {
          kpis: [
            { label: 'Leave Applications', value: `${filteredApps.length}` },
            { label: 'Approved / Active Days', value: `${filteredApps.filter((a) => a.workflowStatus === 'Approved' || a.workflowStatus === 'Resumed').reduce((s, a) => s + a.daysRequested, 0)} Days` },
            { label: 'Pending Review', value: `${filteredApps.filter((a) => ['Submitted', 'Supervisor Recommended', 'HR Reviewed'].includes(a.workflowStatus)).length}` },
            { label: 'Avg Available Balance', value: filteredBalances.length ? `${(filteredBalances.reduce((s, b) => s + b.availableDays, 0) / filteredBalances.length).toFixed(1)} Days` : '0 Days' },
          ],
          tabular: {
            headers: ['Leave Ref', 'Staff ID', 'Officer Name', 'MDA', 'Leave Category', 'Start Date', 'End Date', 'Days Requested', 'Relief Officer', 'Workflow Status'],
            rows: filteredApps.map((a) => {
              const emp = employees.find((e) => e.id === a.employeeId);
              const p = db.getEmployeePersonalInfo(a.employeeId);
              const empInfo = db.getEmployeeEmploymentInfo(a.employeeId);
              const dept = departments.find((d) => d.id === empInfo?.currentDepartmentId);
              const mda = mdas.find((m) => m.id === (empInfo?.currentMdaId || dept?.mdaId));
              const lt = leaveTypes.find((t) => t.id === a.leaveTypeId);
              const relief = a.handoverOfficerEmployeeId ? db.getEmployeePersonalInfo(a.handoverOfficerEmployeeId)?.fullName : 'None Specified';
              return [
                a.leaveReferenceNumber,
                emp?.staffId || '',
                p?.fullName || '',
                mda?.name || '',
                lt?.leaveName || '',
                a.startDate,
                a.endDate,
                a.daysRequested,
                relief || 'None Specified',
                a.workflowStatus,
              ];
            }),
          },
          secondaryTitle: 'Annual Leave Entitlement & Balance Ledger',
          secondaryTabular: {
            headers: ['Staff ID', 'Officer Name', 'Year', 'Leave Type', 'Annual Entitlement', 'Brought Forward', 'Days Taken', 'Available Balance'],
            rows: filteredBalances.map((b) => {
              const emp = employees.find((e) => e.id === b.employeeId);
              const p = db.getEmployeePersonalInfo(b.employeeId);
              const lt = leaveTypes.find((t) => t.id === b.leaveTypeId);
              return [
                emp?.staffId || '',
                p?.fullName || '',
                b.calendarYear,
                lt?.leaveName || 'Annual Leave',
                `${b.annualEntitlementDays} Days`,
                `${b.broughtForwardDays} Days`,
                `${b.daysTaken} Days`,
                `${b.availableDays} Days`,
              ];
            }),
          },
        };
      }

      // REP-14: Training & Capacity Building Summary (Programs + Nominations + Staff Capabilities)
      case 'training_certifications': {
        const filteredProgs = trainingProgs.filter((prog) => {
          if (!isWithinDateRange(prog.startDate)) return false;
          if (qLower) {
            return (
              prog.title.toLowerCase().includes(qLower) ||
              prog.programCode.toLowerCase().includes(qLower) ||
              prog.category.toLowerCase().includes(qLower) ||
              prog.institutionName.toLowerCase().includes(qLower)
            );
          }
          return true;
        });

        const filteredNoms = trainingNoms.filter((nom) => {
          if (!matchesStaffDimensions(nom.employeeId)) return false;
          if (!isWithinDateRange(nom.nominationDate)) return false;
          return true;
        });

        const totalSpend = filteredNoms.reduce((sum, n) => {
          const p = trainingProgs.find((pr) => pr.id === n.trainingProgramId);
          return sum + (p?.costGhs || 0);
        }, 0);

        return {
          kpis: [
            { label: 'Training Programs', value: `${filteredProgs.length}` },
            { label: 'Nominated Officers', value: `${filteredNoms.length}` },
            { label: 'Certified Graduates', value: `${filteredNoms.filter((n) => n.status === 'Certified' || n.status === 'Completed').length}` },
            { label: 'Committed Training Spend', value: `${currencyCode} ${totalSpend.toLocaleString()}` },
          ],
          tabular: {
            headers: ['Program Code', 'Course / Program Title', 'Training Category', 'Institution & Location', 'Dates (Duration)', 'Cost / Officer', 'Sponsor', 'Nominees', 'Status'],
            rows: filteredProgs.map((prog) => {
              const count = filteredNoms.filter((n) => n.trainingProgramId === prog.id).length;
              return [
                prog.programCode,
                prog.title,
                prog.category,
                `${prog.institutionName} (${prog.location})`,
                `${prog.startDate} to ${prog.endDate} (${prog.durationDays}d)`,
                `${currencyCode} ${prog.costGhs.toLocaleString()}`,
                prog.sponsoredBy,
                `${count} Officers`,
                prog.status,
              ];
            }),
          },
          secondaryTitle: 'Officer Training Nominations & Certification Ledger',
          secondaryTabular: {
            headers: ['Staff ID', 'Officer Name', 'MDA / Department', 'Program Title', 'Category', 'Nomination Date', 'Score', 'Certificate No.', 'Status'],
            rows: filteredNoms.map((nom) => {
              const emp = employees.find((e) => e.id === nom.employeeId);
              const p = db.getEmployeePersonalInfo(nom.employeeId);
              const empInfo = db.getEmployeeEmploymentInfo(nom.employeeId);
              const dept = departments.find((d) => d.id === empInfo?.currentDepartmentId);
              const mda = mdas.find((m) => m.id === empInfo?.currentMdaId);
              const prog = trainingProgs.find((pr) => pr.id === nom.trainingProgramId);
              return [
                emp?.staffId || '',
                p?.fullName || '',
                [mda?.name, dept?.departmentName].filter(Boolean).join(' — '),
                prog?.title || '',
                prog?.category || '',
                nom.nominationDate,
                nom.evaluationScore !== undefined ? `${nom.evaluationScore}%` : 'Pending',
                nom.certificateNumber || '—',
                nom.status,
              ];
            }),
          },
        };
      }

      // REP-15: Annual Performance Appraisal Roster
      case 'performance_appraisal': {
        const filteredAppr = appraisals.filter((ap) => {
          if (!isWithinDateRange(ap.appraisalPeriodEnd)) return false;
          if (!matchesStaffDimensions(ap.employeeId)) return false;
          if (qLower) {
            const p = db.getEmployeePersonalInfo(ap.employeeId);
            if (
              !(p?.fullName || '').toLowerCase().includes(qLower) &&
              !ap.appraisalCycle.toLowerCase().includes(qLower) &&
              !ap.finalRating.toLowerCase().includes(qLower)
            ) {
              return false;
            }
          }
          return true;
        });
        const avgScore = filteredAppr.length
          ? (filteredAppr.reduce((s, a) => s + a.overallScorePercentage, 0) / filteredAppr.length).toFixed(1)
          : '0.0';
        return {
          kpis: [
            { label: 'Appraisals Filed', value: `${filteredAppr.length}` },
            { label: 'Mean SPAS Score', value: `${avgScore}%` },
            { label: 'Exceeds / Outstanding', value: `${filteredAppr.filter((a) => a.finalRating === 'Outstanding' || a.finalRating === 'Exceeds Expectations').length}` },
            { label: 'Finalized Cycles', value: `${filteredAppr.filter((a) => a.status === 'Completed' || a.status === 'HR Finalized').length}` },
          ],
          tabular: {
            headers: ['Appraisal Cycle', 'Staff ID', 'Officer Name', 'MDA & Grade', 'Supervisor', 'Period', 'Self Score', 'Supervisor Score', 'Overall %', 'Final Rating', 'Status'],
            rows: filteredAppr.map((ap) => {
              const emp = employees.find((e) => e.id === ap.employeeId);
              const p = db.getEmployeePersonalInfo(ap.employeeId);
              const empInfo = db.getEmployeeEmploymentInfo(ap.employeeId);
              const dept = departments.find((d) => d.id === empInfo?.currentDepartmentId);
              const mda = mdas.find((m) => m.id === (empInfo?.currentMdaId || dept?.mdaId));
              const grade = grades.find((g) => g.id === empInfo?.currentGradeId);
              const sup = db.getEmployeePersonalInfo(ap.supervisorEmployeeId);
              return [
                ap.appraisalCycle,
                emp?.staffId || '',
                p?.fullName || '',
                `${mda?.name || ''} (${grade?.gradeName || ''})`,
                sup?.fullName || 'Directorate Head',
                `${ap.appraisalPeriodStart} to ${ap.appraisalPeriodEnd}`,
                `${ap.selfAssessmentScore}%`,
                `${ap.supervisorScore}%`,
                `${ap.overallScorePercentage}%`,
                ap.finalRating,
                ap.status,
              ];
            }),
          },
        };
      }

      // REP-16: Single Spine Payroll & Wage Bill Summary
      case 'payroll_summary': {
        const filteredRuns = payrollRuns.filter((r) => {
          if (qLower && !r.periodLabel.toLowerCase().includes(qLower) && !r.status.toLowerCase().includes(qLower)) {
            return false;
          }
          return true;
        });

        const latestRunId = filteredRuns[0]?.id;
        const filteredSlips = payslips.filter((sl) => {
          if (latestRunId && sl.payrollRunId !== latestRunId) return false;
          if (!matchesStaffDimensions(sl.employeeId)) return false;
          if (qLower) {
            return (
              sl.employeeName.toLowerCase().includes(qLower) ||
              sl.staffId.toLowerCase().includes(qLower) ||
              sl.departmentName.toLowerCase().includes(qLower)
            );
          }
          return true;
        });

        const totalGross = filteredRuns.reduce((s, r) => s + r.totalGrossGhs, 0);
        const totalNet = filteredRuns.reduce((s, r) => s + r.totalNetGhs, 0);

        return {
          kpis: [
            { label: 'Payroll Cycles Processed', value: `${filteredRuns.length}` },
            { label: 'Cumulative Gross Wage Bill', value: `${currencyCode} ${totalGross.toLocaleString('en-GH', { minimumFractionDigits: 2 })}` },
            { label: 'Cumulative Net Disbursed', value: `${currencyCode} ${totalNet.toLocaleString('en-GH', { minimumFractionDigits: 2 })}` },
            { label: 'Payslips in Latest Cycle', value: `${filteredSlips.length}` },
          ],
          tabular: {
            headers: ['Payroll Period', 'Staff Count', `Basic Wage (${currencyCode})`, `Allowances (${currencyCode})`, `Gross Wage Bill (${currencyCode})`, `Deductions (${currencyCode})`, `Net Disbursement (${currencyCode})`, 'Status'],
            rows: filteredRuns.map((run) => [
              run.periodLabel,
              run.totalStaffCount,
              run.totalBasicGhs.toLocaleString('en-GH', { minimumFractionDigits: 2 }),
              run.totalAllowancesGhs.toLocaleString('en-GH', { minimumFractionDigits: 2 }),
              run.totalGrossGhs.toLocaleString('en-GH', { minimumFractionDigits: 2 }),
              run.totalDeductionsGhs.toLocaleString('en-GH', { minimumFractionDigits: 2 }),
              run.totalNetGhs.toLocaleString('en-GH', { minimumFractionDigits: 2 }),
              run.status,
            ]),
          },
          secondaryTitle: 'Officer Payslip Remittance Schedule (Latest Active Run)',
          secondaryTabular: {
            headers: ['Staff ID', 'Officer Name', 'MDA / Department', 'Grade Title', 'Step', 'Basic', 'Allowances', 'Gross', 'SSNIT + PAYE', 'Net Salary', 'Bank'],
            rows: filteredSlips.map((sl) => [
              sl.staffId,
              sl.employeeName,
              [
                mdas.find((m) => m.id === db.getEmployeeEmploymentInfo(sl.employeeId)?.currentMdaId)?.name,
                sl.departmentName,
              ].filter(Boolean).join(' — '),
              sl.gradeName,
              `Step ${sl.salaryStep}`,
              sl.basicSalaryGhs.toLocaleString('en-GH', { minimumFractionDigits: 2 }),
              sl.totalAllowancesGhs.toLocaleString('en-GH', { minimumFractionDigits: 2 }),
              sl.grossSalaryGhs.toLocaleString('en-GH', { minimumFractionDigits: 2 }),
              (sl.ssnitDeductionGhs + sl.payeTaxGhs).toLocaleString('en-GH', { minimumFractionDigits: 2 }),
              sl.netSalaryGhs.toLocaleString('en-GH', { minimumFractionDigits: 2 }),
              sl.bankName,
            ]),
          },
        };
      }

      // REP-17: Staff Establishment & Cadre Quota Register
      case 'establishment_register': {
        const filteredEst = establishment.filter((est) => {
          const dept = departments.find((d) => d.id === est.departmentId);
          const mda = mdas.find((item) => item.id === dept?.mdaId);
          if (selectedMdaId !== 'ALL' && dept?.mdaId.toString() !== selectedMdaId) return false;
          if (selectedDepartmentId !== 'ALL' && est.departmentId.toString() !== selectedDepartmentId) return false;
          if (selectedGradeId !== 'ALL' && est.gradeId.toString() !== selectedGradeId) return false;
          if (qLower) {
            return (
              est.positionCode.toLowerCase().includes(qLower) ||
              est.positionTitle.toLowerCase().includes(qLower) ||
              (mda?.name || '').toLowerCase().includes(qLower) ||
              (dept?.departmentName || '').toLowerCase().includes(qLower)
            );
          }
          return true;
        });

        let totalQuota = 0;
        let totalInPost = 0;
        const rows = filteredEst.map((est) => {
          const d = departments.find((dept) => dept.id === est.departmentId);
          const m = mdas.find((mda) => mda.id === d?.mdaId);
          const g = grades.find((gr) => gr.id === est.gradeId);
          const inPost = employees.filter((e) => {
            const info = db.getEmployeeEmploymentInfo(e.id);
            return (
              e.isActive &&
              info?.currentEmploymentStatus !== 'Separated' &&
              info?.currentEmploymentStatus !== 'Retired' &&
              info?.currentDepartmentId === est.departmentId &&
              info?.currentGradeId === est.gradeId
            );
          }).length;
          const variance = est.approvedCadreQuota - inPost;
          totalQuota += est.approvedCadreQuota;
          totalInPost += inPost;
          const util = est.approvedCadreQuota > 0 ? `${((inPost / est.approvedCadreQuota) * 100).toFixed(0)}%` : '0%';
          return [
            est.positionCode,
            est.positionTitle,
            m?.name || '',
            g?.gradeName || '',
            est.approvedCadreQuota,
            inPost,
            variance,
            util,
            est.status,
          ];
        });

        return {
          kpis: [
            { label: 'Establishment Posts', value: `${filteredEst.length}` },
            { label: 'Authorized Quota', value: `${totalQuota} Slots` },
            { label: 'Active In-Post', value: `${totalInPost} Staff` },
            { label: 'Net Vacancies', value: `${totalQuota - totalInPost} Slots` },
          ],
          tabular: {
            headers: ['Position Code', 'Approved Position Title', 'MDA', 'Grade Title', 'Approved Quota', 'In-Post', 'Variance', 'Utilization', 'Status'],
            rows,
            summaryRow: [
              'TOTAL',
              `${filteredEst.length} Establishment Lines`,
              '',
              '',
              totalQuota,
              totalInPost,
              totalQuota - totalInPost,
              totalQuota > 0 ? `${((totalInPost / totalQuota) * 100).toFixed(1)}%` : '0%',
              '',
            ],
          },
        };
      }

      // REP-18: Vacancy & Staffing Variance Analysis
      case 'vacancy_analysis': {
        const filteredEst = establishment.filter((est) => {
          const dept = departments.find((d) => d.id === est.departmentId);
          if (selectedMdaId !== 'ALL' && dept?.mdaId.toString() !== selectedMdaId) return false;
          if (selectedDepartmentId !== 'ALL' && est.departmentId.toString() !== selectedDepartmentId) return false;
          if (selectedGradeId !== 'ALL' && est.gradeId.toString() !== selectedGradeId) return false;
          if (qLower) {
            return (
              est.positionTitle.toLowerCase().includes(qLower) ||
              (dept?.departmentName || '').toLowerCase().includes(qLower)
            );
          }
          return true;
        });

        let vacantSlots = 0;
        let overEstablished = 0;
        let criticalDepts = 0;
        const rows = filteredEst.map((est) => {
          const d = departments.find((dept) => dept.id === est.departmentId);
          const m = mdas.find((mda) => mda.id === d?.mdaId);
          const g = grades.find((gr) => gr.id === est.gradeId);
          const inPost = employees.filter((e) => {
            const info = db.getEmployeeEmploymentInfo(e.id);
            return (
              e.isActive &&
              info?.currentEmploymentStatus !== 'Separated' &&
              info?.currentEmploymentStatus !== 'Retired' &&
              info?.currentDepartmentId === est.departmentId &&
              info?.currentGradeId === est.gradeId
            );
          }).length;
          const variance = est.approvedCadreQuota - inPost;
          if (variance > 0) vacantSlots += variance;
          if (variance < 0) overEstablished += Math.abs(variance);
          const gapPct = est.approvedCadreQuota > 0 ? (variance / est.approvedCadreQuota) * 100 : 0;
          if (gapPct >= 50) criticalDepts++;
          const action =
            variance > 0
              ? gapPct >= 50
                ? 'Priority Recruitment Needed'
                : 'Open Vacancy for Posting'
              : variance < 0
              ? 'Supernumerary / Redeploy Excess'
              : 'Optimal Capacity';
          return [
            m?.name || '',
            d?.departmentName || '',
            est.positionTitle,
            g?.gradeName || '',
            est.approvedCadreQuota,
            inPost,
            variance > 0 ? `${variance} Vacant` : variance < 0 ? `${Math.abs(variance)} Over-Quota` : '0 (Full)',
            `${gapPct.toFixed(0)}%`,
            action,
          ];
        });

        return {
          kpis: [
            { label: 'Total Unfilled Vacancies', value: `${vacantSlots} Positions` },
            { label: 'Critical Understaffed Posts', value: `${criticalDepts}` },
            { label: 'Over-Quota Excess', value: `${overEstablished} Staff` },
            { label: 'Posts Evaluated', value: `${filteredEst.length}` },
          ],
          tabular: {
            headers: ['MDA', 'Department', 'Position Title', 'Grade Title', 'Authorized', 'In-Post', 'Staffing Variance', 'Vacancy Gap %', 'HR Action Recommendation'],
            rows,
          },
        };
      }

      // REP-19: Separation Records & Exit Clearances
      case 'separation_exit': {
        const filteredSep = separations.filter((sep) => {
          if (!isWithinDateRange(sep.effectiveDate)) return false;
          if (!matchesStaffDimensions(sep.employeeId)) return false;
          if (qLower) {
            const p = db.getEmployeePersonalInfo(sep.employeeId);
            if (
              !(p?.fullName || '').toLowerCase().includes(qLower) &&
              !sep.separationReference.toLowerCase().includes(qLower) &&
              !sep.separationType.toLowerCase().includes(qLower)
            ) {
              return false;
            }
          }
          return true;
        });

        const totalGratuity = filteredSep.reduce((s, r) => s + (r.gratuityEstimatedGhs || 0), 0);
        return {
          kpis: [
            { label: 'Separation Dockets', value: `${filteredSep.length}` },
            { label: 'Executed Exits', value: `${filteredSep.filter((s) => s.status === 'Separation Executed').length}` },
            { label: 'Clearance Pending', value: `${filteredSep.filter((s) => s.status !== 'Separation Executed').length}` },
            { label: 'Estimated Gratuities', value: `${currencyCode} ${totalGratuity.toLocaleString()}` },
          ],
          tabular: {
            headers: ['Separation Ref', 'Staff ID', 'Officer Name', 'MDA & Grade', 'Exit Type', 'Effective Date', 'Service Yrs', `Est. Gratuity (${currencyCode})`, 'Clearance Progress', 'Workflow Status'],
            rows: filteredSep.map((sep) => {
              const emp = employees.find((e) => e.id === sep.employeeId);
              const p = db.getEmployeePersonalInfo(sep.employeeId);
              const empInfo = db.getEmployeeEmploymentInfo(sep.employeeId);
              const dept = departments.find((d) => d.id === empInfo?.currentDepartmentId);
              const mda = mdas.find((m) => m.id === (empInfo?.currentMdaId || dept?.mdaId));
              const grade = grades.find((g) => g.id === empInfo?.currentGradeId);
              const items = db.getClearanceItems(sep.id);
              const cleared = items.filter((i) => i.isCleared).length;
              return [
                sep.separationReference,
                emp?.staffId || '',
                p?.fullName || '',
                `${mda?.name || ''} (${grade?.gradeName || ''})`,
                sep.separationType,
                sep.effectiveDate,
                `${sep.yearsOfServiceAtSeparation} Yrs`,
                (sep.gratuityEstimatedGhs || 0).toLocaleString(),
                `${cleared} / ${items.length || 6} Units`,
                sep.status,
              ];
            }),
          },
        };
      }

      // REP-20: Disciplinary Cases & Statutory Sanctions Docket
      case 'disciplinary_docket': {
        const filteredDisc = disciplinary.filter((c) => {
          if (!isWithinDateRange(c.incidentDate)) return false;
          if (!matchesStaffDimensions(c.employeeId)) return false;
          if (qLower) {
            const p = db.getEmployeePersonalInfo(c.employeeId);
            if (
              !(p?.fullName || '').toLowerCase().includes(qLower) &&
              !c.caseReference.toLowerCase().includes(qLower) &&
              !c.natureOfOffence.toLowerCase().includes(qLower)
            ) {
              return false;
            }
          }
          return true;
        });

        return {
          kpis: [
            { label: 'Disciplinary Dockets', value: `${filteredDisc.length}` },
            { label: 'Active Inquiries', value: `${filteredDisc.filter((c) => ['Reported', 'Under Investigation', 'Committee Hearing'].includes(c.caseStatus)).length}` },
            { label: 'Sanctions Imposed', value: `${filteredDisc.filter((c) => c.caseStatus === 'Sanction Imposed').length}` },
            { label: 'Classified Dockets', value: `${filteredDisc.filter((c) => c.isConfidential).length}` },
          ],
          tabular: {
            headers: ['Case Ref', 'Staff ID', 'Officer Name', 'MDA / Department', 'Incident Date', 'Nature of Offence', 'Hearing Date', 'Outcome', 'Sanction Recommended', 'Case Status'],
            rows: filteredDisc.map((c) => {
              const emp = employees.find((e) => e.id === c.employeeId);
              const p = db.getEmployeePersonalInfo(c.employeeId);
              const empInfo = db.getEmployeeEmploymentInfo(c.employeeId);
              const dept = departments.find((d) => d.id === empInfo?.currentDepartmentId);
              const mda = mdas.find((m) => m.id === empInfo?.currentMdaId);
              return [
                c.caseReference,
                emp?.staffId || '',
                p?.fullName || '',
                [mda?.name, dept?.departmentName].filter(Boolean).join(' — '),
                c.incidentDate,
                c.natureOfOffence,
                c.hearingDate || 'Pending',
                c.outcome,
                c.sanctionRecommended || 'Pending Determination',
                c.caseStatus,
              ];
            }),
          },
        };
      }
    }
  }, [
    activeReportId,
    enrichedEmployees,
    scopedDepartments,
    departments,
    mdas,
    grades,
    establishment,
    employees,
    movements,
    movementHistory,
    promotions,
    applicants,
    leaveTypes,
    leaveBalances,
    leaveApps,
    trainingProgs,
    trainingNoms,
    appraisals,
    payrollRuns,
    payslips,
    separations,
    disciplinary,
    searchTerm,
    dateFrom,
    dateTo,
    selectedMdaId,
    selectedDepartmentId,
    selectedGradeId,
    selectedCategory,
    selectedStatus,
    currencyCode,
  ]);

  // Employee Personal History Report Data (Section 18 #20)
  const personalHistoryReport = useMemo(() => {
    if (!canPersonalHistoryReport || !personalHistoryEmployeeId) return null;
    const emp = db.getEmployeeById(personalHistoryEmployeeId);
    const personal = db.getEmployeePersonalInfo(personalHistoryEmployeeId);
    const employment = db.getEmployeeEmploymentInfo(personalHistoryEmployeeId);
    if (!emp || !personal || !employment) return null;

    const mda = mdas.find((m) => m.id === employment.currentMdaId);
    const dept = departments.find((d) => d.id === employment.currentDepartmentId);
    const unit = units.find((u) => u.id === employment.currentUnitId);
    const grade = grades.find((g) => g.id === employment.currentGradeId);
    const firstGrade = grades.find((g) => g.id === employment.firstGradeId);
    const quals = db.getEmployeeQualifications(personalHistoryEmployeeId);
    const mems = db.getEmployeeMemberships(personalHistoryEmployeeId);
    const prior = db.getPriorEmploymentHistory(personalHistoryEmployeeId);
    const caps = db.getTrainingCapabilities(personalHistoryEmployeeId);
    const skills = db.getEmployeeSkills(personalHistoryEmployeeId);
    const empMovHistory = db.getStaffMovementHistory(personalHistoryEmployeeId);
    const empProms = promotions.filter((p) => p.employeeId === personalHistoryEmployeeId);
    const empLeaveBals = db.getLeaveBalances(personalHistoryEmployeeId);
    const empLeaveApps = db.getLeaveApplications(personalHistoryEmployeeId);
    const empTraining = db.getTrainingNominations(undefined, personalHistoryEmployeeId);
    const empAppr = db.getPerformanceAppraisals(personalHistoryEmployeeId);
    const empDisc = canDisciplinaryReport ? db.getDisciplinaryCases(personalHistoryEmployeeId) : [];
    const empSep = db.getSeparationRecords(personalHistoryEmployeeId);

    const sections: PersonalHistorySection[] = [
      {
        title: '1. Biographical & Identification Profile',
        headers: ['Field', 'Recorded Value', 'Field', 'Recorded Value'],
        rows: [
          ['Staff ID', emp.staffId, 'Full Name', personal.fullName],
          ['Date of Birth', `${personal.dateOfBirth} (Age ${db.calculateAge(personal.dateOfBirth)})`, 'Gender / Marital', `${personal.gender} • ${personal.maritalStatus}`],
          ['Ghana Card (NIA)', personal.nationalIdentificationNumber || 'N/A', 'Nationality', personal.nationality],
          ['Telephone', personal.telephoneNumber, 'Official Email', personal.emailAddress],
          ['Other Contact(s)', (personal.otherContacts || []).join('; ') || 'N/A', 'Emergency Contact', `${personal.emergencyContactName} (${personal.emergencyContactPhone})`],
          ['Residential Address', personal.residentialAddress, 'Next of Kin', `${personal.nextOfKinName} (${personal.nextOfKinRelationship})`],
        ],
      },
      {
        title: '2. Current Substantive Appointment & Placement',
        headers: ['Attribute', 'Detail', 'Attribute', 'Detail'],
        rows: [
          ['MDA', mda?.name || '', 'Department / Unit', `${dept?.departmentName || ''}${unit ? ` / ${unit.unitName}` : ''}`],
          ['Position Title', employment.currentPositionTitle, 'Grade Title', grade?.gradeName || ''],
          ['Cadre Category', employment.employeeCategory, 'Employment Type', employment.employmentType],
          ['1st Appointment Date', employment.dateOfFirstAppointment, 'Assumption of Duty', employment.dateOfAssumptionOfDuty],
          ['First Grade (Entry)', firstGrade?.gradeName || 'N/A', 'Current Promotion Date', employment.currentPromotionDate || 'N/A'],
          ['Date Assigned Grade', employment.dateAssignedCurrentGrade, 'Previous Posting', employment.previousPosting || 'N/A'],
          ['Statutory Retirement', employment.statutoryRetirementDate, 'Current Status', employment.currentEmploymentStatus],
        ],
      },
      {
        title: '3. Academic Qualifications',
        headers: ['Level', 'Qualification & Course of Study', 'Institution', 'Year Obtained', 'Status'],
        rows: quals.map((q) => [
          q.qualificationLevel,
          `${q.qualificationTitle} (${q.courseOfStudy})`,
          q.institutionName,
          q.yearObtained,
          q.verificationStatus,
        ]),
      },
      {
        title: '4. Professional Memberships',
        headers: ['Professional Body', 'Membership Number', 'Category', 'Registration Date', 'Expiry Date', 'Status'],
        rows: mems.map((m) => [
          m.professionalBody,
          m.membershipNumber,
          m.membershipCategory,
          m.registrationDate,
          m.expiryDate || 'N/A',
          m.membershipStatus,
        ]),
      },
      {
        title: '5. Role-Related Training Capabilities & Possessed Skills',
        headers: ['Dimension', 'Title / Skill Name', 'Category / Context', 'Evidence / Detail'],
        rows: [
          ...caps.map((c) => ['Training Capability', c.capability, 'Role Capability', `Updated ${c.updatedAt.slice(0, 10)}`]),
          ...skills.map((s) => ['Possessed Skill', s.skillName, s.category, s.evidence || 'Verified by HR']),
        ],
      },
      {
        title: '6. Prior Employment & Immutable Movement Ledger',
        headers: ['Effective / Period', 'Type / Organization', 'From Posting / Role', 'To Posting / Grade', 'Reference / Reason'],
        rows: [
          ...prior.map((pr) => [`${pr.startDate} to ${pr.endDate}`, pr.organizationName, pr.positionTitle, pr.gradeRank || 'N/A', pr.reasonForLeaving || 'Prior Service']),
          ...empMovHistory.map((mh) => [mh.effectiveDate, mh.movementType, `${mh.mdaNameFrom} (${mh.gradeNameFrom}) • ${mh.departmentNameFrom}`, `${mh.mdaNameTo} • ${mh.departmentNameTo}`, mh.movementReferenceNumber]),
        ],
      },
      {
        title: '7. Promotions, Training, Leave & Performance Appraisals',
        headers: ['Module', 'Reference / Cycle', 'Details', 'Score / Balance', 'Status'],
        rows: [
          ...empProms.map((pr) => ['Promotion', pr.recommendationDate, `${grades.find((g) => g.id === pr.currentGradeId)?.gradeName || ''} -> ${grades.find((g) => g.id === pr.recommendedGradeId)?.gradeName || ''}`, `${pr.yearsInCurrentGrade.toFixed(1)} yrs in grade`, pr.status]),
          ...empTraining.map((tn) => {
            const prog = trainingProgs.find((tp) => tp.id === tn.trainingProgramId);
            return ['Training', prog?.programCode || '', prog?.title || '', tn.evaluationScore ? `${tn.evaluationScore}%` : '—', tn.status];
          }),
          ...empLeaveBals.map((lb) => ['Leave Balance', `${lb.calendarYear}`, leaveTypes.find((lt) => lt.id === lb.leaveTypeId)?.leaveName || 'Annual Leave', `${lb.availableDays} days left (${lb.daysTaken} taken)`, 'Active']),
          ...empLeaveApps.map((la) => ['Leave Application', la.leaveReferenceNumber, `${la.startDate} to ${la.endDate} (${la.daysRequested}d)`, la.reason, la.workflowStatus]),
          ...empAppr.map((ap) => ['Appraisal', ap.appraisalCycle, ap.kpiTargetsSummary.slice(0, 60), `${ap.overallScorePercentage}% (${ap.finalRating})`, ap.status]),
          ...empDisc.map((dc) => ['Disciplinary', dc.caseReference, dc.natureOfOffence, dc.sanctionRecommended || 'Pending', dc.caseStatus]),
          ...empSep.map((sr) => ['Separation', sr.separationReference, sr.separationType, `Effective ${sr.effectiveDate}`, sr.status]),
        ],
      },
    ];

    return {
      emp,
      personal,
      employment,
      mda,
      dept,
      grade,
      sections,
    };
  }, [canPersonalHistoryReport, canDisciplinaryReport, personalHistoryEmployeeId, mdas, departments, units, grades, promotions, trainingProgs, leaveTypes]);

  const buildExportMeta = (): ReportExportMeta => {
    if (personalHistoryReport) {
      return {
        reportCode: 'REP-20-PHR',
        reportTitle: `Employee Personal History Report — ${personalHistoryReport.personal.fullName} (${personalHistoryReport.emp.staffId})`,
        reportDescription: 'Comprehensive statutory civil service personal history dossier extract.',
        institutionName,
        institutionCountry,
        reportingPeriod: reportingPeriodLabel,
        generatedAt: `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}`,
        generatedBy: currentUser?.fullName || currentUser?.username || 'HR Administrator',
        appliedFiltersSummary: `Staff ID: ${personalHistoryReport.emp.staffId} | Department: ${personalHistoryReport.dept?.departmentName || ''}`,
      };
    }

    return {
      reportCode: currentReport.code,
      reportTitle: currentReport.title,
      reportDescription: currentReport.description,
      institutionName,
      institutionCountry,
      reportingPeriod: reportingPeriodLabel,
      generatedAt: `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}`,
      generatedBy: currentUser?.fullName || currentUser?.username || 'HR Administrator',
      appliedFiltersSummary,
      kpis: builtReport.kpis,
    };
  };

  const handlePrint = () => {
    notificationServiceBridgePrint();
    void printPage();
  };

  const notificationServiceBridgePrint = () => {
    const title = personalHistoryReport
      ? `Personal History Report (${personalHistoryReport.emp.staffId})`
      : `${currentReport.code} — ${currentReport.title}`;
    notifications.success('Print Job Prepared', `Sent ${title} to the system print dialog.`, {
      module: 'Statutory Reporting',
      actor: currentUser?.username,
    });
  };

  const handleExportCsv = () => {
    try {
      const meta = buildExportMeta();
      const dateStamp = new Date().toISOString().slice(0, 10);
      if (personalHistoryReport) {
        const flatRows: (string | number)[][] = [];
        personalHistoryReport.sections.forEach((sec) => {
          flatRows.push([`--- ${sec.title} ---`]);
          flatRows.push(sec.headers);
          sec.rows.forEach((r) => flatRows.push(r));
          flatRows.push([]);
        });
        exportReportToCsv(meta, { headers: ['Section / Field', 'Value 1', 'Value 2', 'Value 3', 'Value 4', 'Value 5'], rows: flatRows }, `PHR_${personalHistoryReport.emp.staffId}_${dateStamp}.csv`);
        notifications.success('CSV Report Exported', `Exported Personal History CSV for ${personalHistoryReport.emp.staffId}.`, {
          module: 'Statutory Reporting',
          actor: currentUser?.username,
        });
        return;
      }
      exportReportToCsv(meta, builtReport.tabular, `${currentReport.code}_${selectedReportId}_${dateStamp}.csv`);
      notifications.success('CSV Report Exported', `Downloaded ${currentReport.code} (${currentReport.title}) as CSV.`, {
        module: 'Statutory Reporting',
        actor: currentUser?.username,
      });
    } catch (err: any) {
      notifications.error('CSV Export Failed', err?.message || 'Unable to generate CSV report.', {
        module: 'Statutory Reporting',
        actor: currentUser?.username,
      });
    }
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const meta = buildExportMeta();
      const dateStamp = new Date().toISOString().slice(0, 10);
      if (personalHistoryReport) {
        const flatRows: (string | number)[][] = [];
        personalHistoryReport.sections.forEach((sec) => {
          flatRows.push([sec.title, ...sec.headers.slice(1)]);
          sec.rows.forEach((r) => flatRows.push(r));
          flatRows.push([]);
        });
        await exportReportToExcel(
          meta,
          { headers: ['Section / Item', 'Detail A', 'Detail B', 'Detail C', 'Detail D', 'Detail E'], rows: flatRows },
          `PHR_${personalHistoryReport.emp.staffId}_${dateStamp}.xlsx`
        );
        notifications.success('Excel Workbook Exported', `Generated Personal History Excel workbook for ${personalHistoryReport.emp.staffId}.`, {
          module: 'Statutory Reporting',
          actor: currentUser?.username,
        });
      } else {
        await exportReportToExcel(meta, builtReport.tabular, `${currentReport.code}_${selectedReportId}_${dateStamp}.xlsx`);
        notifications.success('Excel Workbook Exported', `Generated ${currentReport.code} (${currentReport.title}) .xlsx workbook.`, {
          module: 'Statutory Reporting',
          actor: currentUser?.username,
        });
      }
    } catch (err: any) {
      notifications.error('Excel Export Failed', err?.message || 'Unable to generate Excel workbook.', {
        module: 'Statutory Reporting',
        actor: currentUser?.username,
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const meta = buildExportMeta();
      const dateStamp = new Date().toISOString().slice(0, 10);
      if (personalHistoryReport) {
        await exportPersonalHistoryToPdf(
          meta,
          personalHistoryReport.sections,
          `PHR_${personalHistoryReport.emp.staffId}_${dateStamp}.pdf`
        );
        notifications.success('PDF Report Exported', `Generated Personal History PDF for ${personalHistoryReport.emp.staffId}.`, {
          module: 'Statutory Reporting',
          actor: currentUser?.username,
        });
        return;
      }
      await exportReportToPdf(meta, builtReport.tabular, `${currentReport.code}_${selectedReportId}_${dateStamp}.pdf`);
      notifications.success('PDF Report Exported', `Generated ${currentReport.code} (${currentReport.title}) PDF document.`, {
        module: 'Statutory Reporting',
        actor: currentUser?.username,
      });
    } catch (err: any) {
      notifications.error('PDF Export Failed', err?.message || 'Unable to generate PDF document.', {
        module: 'Statutory Reporting',
        actor: currentUser?.username,
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Estimate printed page count for preview metadata
  const estimatedPageCount = useMemo(() => {
    if (personalHistoryReport) return 2;
    const rowCount = builtReport.tabular.rows.length + (builtReport.secondaryTabular?.rows.length || 0);
    return Math.max(1, Math.ceil(rowCount / 22));
  }, [builtReport, personalHistoryReport]);

  return (
    <div className="flex h-full bg-slate-100 overflow-hidden text-slate-800 text-xs">
      {/* LEFT NAVIGATION: Statutory 20 Civil Service Reports Menu (Headings preserved) */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 no-print">
        {/* Header */}
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded bg-blue-100 text-blue-700 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-xs">Statutory Reports</div>
              <div className="text-[10px] text-slate-500">{visibleReports.length} Authorized Standards</div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-mono font-bold">
            v2.4
          </span>
        </div>

        {/* Report List with Categories */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {(['Establishment & Staff', 'Career & Movements', 'Services & Leave', 'Compensation & Exits'] as const).map(
            (category) => {
              const categoryReports = visibleReports.filter((r) => r.category === category);
              if (categoryReports.length === 0) return null;
              return (
                <div key={category} className="space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {category}
                  </div>
                  {categoryReports.map((report) => {
                    const Icon = report.icon;
                    const isSelected = !personalHistoryEmployeeId && activeReportId === report.id;
                    return (
                      <button
                        key={report.id}
                        onClick={() => {
                          setPersonalHistoryEmployeeId(null);
                          setSelectedReportId(report.id);
                        }}
                        className={`w-full text-left p-2 rounded flex items-start space-x-2.5 transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-900 border border-blue-200 shadow-xs'
                            : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold truncate">{report.title}</span>
                            <span className="text-[9px] font-mono text-slate-400 ml-1">{report.code}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{report.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* RIGHT MAIN: Report Filter Bar, Export Actions, Document Letterhead & Live Report Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Action & Multi-Dimensional Filter Toolbar */}
        <div className="p-3 bg-white border-b border-slate-200 space-y-2 no-print shrink-0 shadow-xs">
          {/* Row 1: Search, Date Range, Period Preset, Export Suite */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              {/* Search */}
              <div className="relative min-w-[190px] flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search officer, Staff ID, grade, ref..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 rounded border border-slate-300 bg-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Reporting Period Preset + Custom Date From/To */}
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded px-2 h-8">
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <SearchableSelect
                  value={periodPreset}
                  onChange={(val) => handleApplyPeriodPreset(val as any)}
                  options={[
                    { value: 'ALL', label: 'All Dates' },
                    { value: 'FY2026', label: 'FY 2026' },
                    { value: 'THIS_QUARTER', label: 'Q4 2026' },
                    { value: 'THIS_MONTH', label: 'Nov 2026' },
                    { value: 'CUSTOM', label: 'Custom Range' },
                  ]}
                  placeholder="Period"
                  searchPlaceholder="Filter periods..."
                  buttonClassName="bg-transparent border-none shadow-none h-7 px-1 text-xs font-semibold text-slate-700 w-32"
                />
                <span className="text-slate-300">|</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setPeriodPreset('CUSTOM');
                    setDateFrom(e.target.value);
                  }}
                  aria-label="Date From"
                  className="bg-transparent text-[11px] font-mono text-slate-700 focus:outline-hidden w-[108px]"
                />
                <span className="text-slate-400 text-[10px]">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setPeriodPreset('CUSTOM');
                    setDateTo(e.target.value);
                  }}
                  aria-label="Date To"
                  className="bg-transparent text-[11px] font-mono text-slate-700 focus:outline-hidden w-[108px]"
                />
              </div>

              {/* Employee Personal History Report Trigger */}
              {canPersonalHistoryReport && (
                <div className="min-w-[205px]">
                  <SearchableSelect
                    value={personalHistoryEmployeeId ? personalHistoryEmployeeId.toString() : ''}
                    onChange={(val) => setPersonalHistoryEmployeeId(val ? Number(val) : null)}
                    options={[
                      { value: '', label: 'Personal History Report...' },
                      ...employees.map((e) => {
                        const p = db.getEmployeePersonalInfo(e.id);
                        return {
                          value: e.id.toString(),
                          label: `${e.staffId} — ${p?.fullName || 'Officer'}`,
                        };
                      }),
                    ]}
                    placeholder="Personal History Report..."
                    searchPlaceholder="Find officer for Personal History..."
                  />
                </div>
              )}
            </div>

            {/* Export Buttons: Excel (.xlsx), PDF (.pdf), CSV, Print */}
            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExportingExcel}
                className="h-8 px-2.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center space-x-1.5 shadow-xs transition-colors disabled:opacity-60"
                title="Download formatted Microsoft Excel (.xlsx) workbook"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{isExportingExcel ? 'Building...' : 'Excel (.xlsx)'}</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="h-8 px-2.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center space-x-1.5 shadow-xs transition-colors disabled:opacity-60"
                title="Download paginated official PDF with institutional letterhead and page numbers"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>{isExportingPdf ? 'Building...' : 'Export PDF'}</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="h-8 px-2.5 rounded bg-slate-700 hover:bg-slate-800 text-white font-semibold flex items-center space-x-1.5 shadow-xs transition-colors"
                title="Download UTF-8 CSV file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="h-8 px-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center space-x-1.5 shadow-xs transition-colors"
                title="Print official letterhead report"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Row 2: MDA, Department, Grade (Position Title Only), Cadre, Employee Status */}
          <div className="flex flex-wrap items-center gap-2">
            {/* MDA filter */}
            <div className="min-w-[165px] flex-1 max-w-[230px]">
              <SearchableSelect
                value={selectedMdaId}
                onChange={(val) => {
                  setSelectedMdaId(val);
                  setSelectedDepartmentId('ALL');
                }}
                options={[
                  { value: 'ALL', label: 'All MDAs' },
                  ...mdas.map((m) => ({
                    value: m.id.toString(),
                    label: `${m.code} - ${m.name}`,
                  })),
                ]}
                placeholder="All MDAs"
                searchPlaceholder="Filter MDAs..."
              />
            </div>

            {/* Department filter */}
            <div className="min-w-[175px] flex-1 max-w-[240px]">
              <SearchableSelect
                value={selectedDepartmentId}
                onChange={(val) => setSelectedDepartmentId(val)}
                options={[
                  { value: 'ALL', label: 'All Departments' },
                  ...scopedDepartments.map((d) => ({
                    value: d.id.toString(),
                    label: d.departmentName,
                  })),
                ]}
                placeholder="All Departments"
                searchPlaceholder="Filter departments..."
              />
            </div>

            {/* Grade filter (Position Titles Only — Zero Grade Codes) */}
            <div className="min-w-[175px] flex-1 max-w-[230px]">
              <SearchableSelect
                value={selectedGradeId}
                onChange={(val) => setSelectedGradeId(val)}
                options={[
                  { value: 'ALL', label: 'All Position Grades' },
                  ...grades.map((g) => ({
                    value: g.id.toString(),
                    label: g.gradeName,
                  })),
                ]}
                placeholder="All Position Grades"
                searchPlaceholder="Filter position titles..."
              />
            </div>

            {/* Cadre filter */}
            <div className="min-w-[140px]">
              <SearchableSelect
                value={selectedCategory}
                onChange={(val) => setSelectedCategory(val)}
                options={[
                  { value: 'ALL', label: 'All Cadres' },
                  { value: 'Professional', label: 'Professional' },
                  { value: 'Sub-Professional', label: 'Sub-Professional' },
                  { value: 'Technical', label: 'Technical' },
                  { value: 'Executive', label: 'Executive' },
                  { value: 'Administrative', label: 'Administrative' },
                ]}
                placeholder="All Cadres"
                searchPlaceholder="Filter cadres..."
              />
            </div>

            {/* Employee Status filter */}
            <div className="min-w-[155px]">
              <SearchableSelect
                value={selectedStatus}
                onChange={(val) => setSelectedStatus(val)}
                options={[
                  { value: 'ALL', label: 'All Employee Statuses' },
                  { value: 'ACTIVE_ONLY', label: 'Active Workforce Only' },
                  { value: 'Active', label: 'Active' },
                  { value: 'On Probation', label: 'On Probation' },
                  { value: 'On Secondment', label: 'On Secondment' },
                  { value: 'On Study Leave', label: 'On Study Leave' },
                  { value: 'Interdicted', label: 'Interdicted' },
                  { value: 'Suspended', label: 'Suspended' },
                  { value: 'Separated', label: 'Separated' },
                  { value: 'Retired', label: 'Retired' },
                ]}
                placeholder="All Employee Statuses"
                searchPlaceholder="Filter status..."
              />
            </div>

            {(searchTerm || dateFrom || dateTo || selectedMdaId !== 'ALL' || selectedDepartmentId !== 'ALL' || selectedGradeId !== 'ALL' || selectedCategory !== 'ALL' || selectedStatus !== 'ALL') && (
              <button
                type="button"
                onClick={resetFilters}
                className="h-8 px-2.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 font-semibold flex items-center space-x-1 transition-colors"
                title="Reset all report filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Printable Civil Service Report Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:p-0 print:overflow-visible">
          <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 p-6 sm:p-8 print:border-none print:shadow-none print:p-2">
            {/* CIVIL SERVICE OFFICIAL LETTERHEAD */}
            <div className="border-b-2 border-slate-900 pb-4 mb-5 text-center">
              <div className="flex justify-center mb-2">
                <BrandCrest
                  sizeClass="w-14 h-14"
                  className="border-2 border-slate-900 bg-white shadow-xs"
                />
              </div>
              <h1 className="text-base sm:text-lg font-black tracking-widest uppercase text-slate-900 font-serif">
                {institutionCountry}
              </h1>
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-900">
                {institutionName}
              </h2>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">
                Civil Service Human Resource Information System (HRMIS) • Statutory Gazette Record
              </p>

              <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-start justify-between text-left text-[11px] text-slate-700 gap-3">
                <div className="max-w-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">
                    {personalHistoryReport ? 'Statutory Personal Dossier Extract' : 'Statutory Report Title'}
                  </div>
                  <div className="font-bold text-slate-900 text-sm">
                    {personalHistoryReport
                      ? `Employee Personal History Report — ${personalHistoryReport.personal.fullName}`
                      : currentReport.title}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {personalHistoryReport
                      ? `Staff ID: ${personalHistoryReport.emp.staffId} • ${personalHistoryReport.dept?.departmentName || ''} • ${personalHistoryReport.grade?.gradeName || ''}`
                      : currentReport.description}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    <span className="font-semibold text-slate-600">Scope:</span> {appliedFiltersSummary}
                  </div>
                </div>

                <div className="text-right font-mono text-[10px] space-y-0.5 shrink-0">
                  <div>
                    <span className="text-slate-400">Statutory Ref:</span>{' '}
                    <span className="font-bold text-slate-800">
                      {personalHistoryReport ? `PHR-${personalHistoryReport.emp.staffId}` : `${currentReport.code} / 2026-REG`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Reporting Period:</span>{' '}
                    <span className="font-bold text-slate-800">{reportingPeriodLabel}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Generated On:</span>{' '}
                    <span className="font-bold text-slate-800">
                      {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Prepared By:</span>{' '}
                    <span className="font-bold text-slate-800">{currentUser?.fullName || currentUser?.username || 'System Admin'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PERSONAL HISTORY REPORT VIEW (SECTION 18 #20) */}
            {personalHistoryReport ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-3 py-2 no-print">
                  <div className="flex items-center space-x-2 text-blue-900 font-semibold">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>Viewing Employee Personal History Report ({personalHistoryReport.emp.staffId})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {onSelectEmployee && (
                      <button
                        type="button"
                        onClick={() => onSelectEmployee(personalHistoryReport.emp.id)}
                        className="px-2.5 py-1 rounded bg-white border border-blue-300 text-blue-700 font-semibold hover:bg-blue-100 text-[11px]"
                      >
                        Open Full Staff Dossier
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPersonalHistoryEmployeeId(null)}
                      className="px-2.5 py-1 rounded bg-slate-800 text-white font-semibold hover:bg-slate-900 flex items-center space-x-1 text-[11px]"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Return to {currentReport.code}</span>
                    </button>
                  </div>
                </div>

                {personalHistoryReport.sections.map((sec) => (
                  <div key={sec.title} className="space-y-1.5">
                    <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider border-b border-slate-200 pb-1">
                      {sec.title}
                    </h3>
                    <div className="overflow-x-auto border border-slate-200 rounded">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold uppercase tracking-wider">
                            {sec.headers.map((h, i) => (
                              <th key={i} className="p-2 border-r last:border-r-0 border-slate-200">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {sec.rows.length === 0 ? (
                            <tr>
                              <td colSpan={sec.headers.length} className="p-3 text-center text-slate-400 italic">
                                No recorded entries on file for this section.
                              </td>
                            </tr>
                          ) : (
                            sec.rows.map((r, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-50">
                                {r.map((cell, cIdx) => (
                                  <td key={cIdx} className="p-2 border-r last:border-r-0 border-slate-200 text-slate-800">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* STANDARDIZED STATUTORY REPORT BODY (ALL 20 REPORTS) */
              <div className="space-y-5">
                {/* Summary KPI Strip */}
                {builtReport.kpis.length > 0 && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {builtReport.kpis.map((kpi) => (
                      <div key={kpi.label} className="p-2.5 rounded border border-slate-200 bg-slate-50/80">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {kpi.label}
                        </div>
                        <div className="text-sm font-bold text-slate-900 mt-0.5 truncate" title={kpi.value}>
                          {kpi.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Primary Report Table */}
                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold uppercase tracking-wider">
                        {builtReport.tabular.headers.map((header) => (
                          <th key={header} className="p-2 border-r last:border-r-0 border-slate-200 whitespace-nowrap">
                            {header}
                          </th>
                        ))}
                        {builtReport.rowEmployeeIds && (
                          <th className="p-2 text-right no-print whitespace-nowrap">Dossier</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {builtReport.tabular.rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={builtReport.tabular.headers.length + (builtReport.rowEmployeeIds ? 1 : 0)}
                            className="p-6 text-center text-slate-400 italic"
                          >
                            No statutory records match the selected filters and reporting period.
                          </td>
                        </tr>
                      ) : (
                        builtReport.tabular.rows.map((row, idx) => {
                          const empId = builtReport.rowEmployeeIds?.[idx];
                          return (
                            <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                              {row.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className={`p-2 border-r last:border-r-0 border-slate-200 ${
                                    cIdx === 0 ? 'font-mono font-semibold text-blue-800 whitespace-nowrap' : 'text-slate-800'
                                  }`}
                                >
                                  {cell}
                                </td>
                              ))}
                              {builtReport.rowEmployeeIds && (
                                <td className="p-2 text-right no-print whitespace-nowrap">
                                  {empId ? (
                                    <button
                                      type="button"
                                      onClick={() => setPersonalHistoryEmployeeId(empId)}
                                      className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[10px] border border-blue-200"
                                      title="Open Employee Personal History Report"
                                    >
                                      Personal History
                                    </button>
                                  ) : null}
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {builtReport.tabular.summaryRow && (
                      <tfoot>
                        <tr className="bg-slate-200/80 font-bold text-slate-900 border-t-2 border-slate-400">
                          {builtReport.tabular.summaryRow.map((val, idx) => (
                            <td key={idx} className="p-2 border-r last:border-r-0 border-slate-300">
                              {val}
                            </td>
                          ))}
                          {builtReport.rowEmployeeIds && <td className="no-print" />}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Optional Secondary / Supporting Register Table */}
                {builtReport.secondaryTabular && (
                  <div className="space-y-2 pt-2">
                    {builtReport.secondaryTitle && (
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        {builtReport.secondaryTitle}
                      </h3>
                    )}
                    <div className="overflow-x-auto border border-slate-200 rounded">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold uppercase tracking-wider">
                            {builtReport.secondaryTabular.headers.map((header) => (
                              <th key={header} className="p-2 border-r last:border-r-0 border-slate-200 whitespace-nowrap">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {builtReport.secondaryTabular.rows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={builtReport.secondaryTabular.headers.length}
                                className="p-4 text-center text-slate-400 italic"
                              >
                                No supporting entries recorded for the active filter scope.
                              </td>
                            </tr>
                          ) : (
                            builtReport.secondaryTabular.rows.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className={`p-2 border-r last:border-r-0 border-slate-200 ${
                                      cIdx === 0 ? 'font-mono font-semibold text-slate-900 whitespace-nowrap' : 'text-slate-700'
                                    }`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CIVIL SERVICE FORMAL SIGN-OFF & ATTESTATION BLOCK */}
            <div className="mt-10 pt-5 border-t-2 border-slate-300 grid grid-cols-3 gap-6 text-[10px] text-slate-700">
              <div className="space-y-4">
                <div className="font-bold uppercase tracking-wider text-slate-900">Prepared By:</div>
                <div className="h-9 border-b border-slate-400"></div>
                <div>
                  <div className="font-semibold">Assistant Director of HR / Nominal Roll Desk</div>
                  <div className="text-slate-500 font-mono">Date: ____________________</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="font-bold uppercase tracking-wider text-slate-900">Verified By:</div>
                <div className="h-9 border-b border-slate-400"></div>
                <div>
                  <div className="font-semibold">Director of Human Resources</div>
                  <div className="text-slate-500 font-mono">Date: ____________________</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="font-bold uppercase tracking-wider text-slate-900">Approved & Certified By:</div>
                <div className="h-9 border-b border-slate-400"></div>
                <div>
                  <div className="font-semibold">{institutionName}</div>
                  <div className="text-slate-500 font-mono">Official Seal & Gazette Stamp</div>
                </div>
              </div>
            </div>

            {/* Official Footer with Institutional Name, Classification & Page Numbering */}
            <div className="mt-8 flex items-center justify-between text-[9px] text-slate-500 font-mono border-t border-slate-200 pt-3">
              <span>
                {institutionName.toUpperCase()} • {institutionCountry.toUpperCase()} • CLASSIFICATION: OFFICIAL USE ONLY
              </span>
              <span className="font-bold text-slate-700">
                Page 1 of {estimatedPageCount}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
