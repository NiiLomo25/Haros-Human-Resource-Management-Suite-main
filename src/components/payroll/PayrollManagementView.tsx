/**
 * Haros HRMIS - Payroll and Compensation Module (Section 13)
 * Single Spine Salary Structure (SSSS), Steps 1-5, Configurable Allowances/Deductions,
 * Monthly Payroll Execution, Payslip Generation, Bank Payment Advice, and Confidentiality RBAC.
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Building2,
  Calendar,
  Lock,
  User,
  Users,
  Eye,
  Check,
  Printer,
  ChevronRight,
  Shield,
  Layers,
  ArrowRight,
  Sliders,
  Landmark,
  Percent,
  Edit2,
  Trash2,
} from 'lucide-react';
import { db } from '../../db/storage';
import { notificationService } from '../../services/notifications/notificationService';
import { useAuth } from '../../context/AuthContext';
import { BrandCrest } from '../common/BrandCrest';
import { useInstitutionInfo } from '../../hooks/useInstitutionInfo';
import {
  SalaryStructure,
  SalaryGradeStep,
  PayrollComponent,
  EmployeePayrollAssignment,
  PayrollRun,
  EmployeePayslip,
  Employee,
  Department,
  GradeLevel,
} from '../../types';
import { SearchableSelect } from '../common/SearchableSelect';
import { SlideOverPanel } from '../common/SlideOverPanel';
import { printPage } from '../../services/printService';

interface PayrollManagementViewProps {
  onSelectEmployee?: (empId: number) => void;
}

export const PayrollManagementView: React.FC<PayrollManagementViewProps> = ({
  onSelectEmployee,
}) => {
  const { currentUser, currentRole, hasPermission, canAccessModule } = useAuth();
  const { institutionName, institutionCountry } = useInstitutionInfo();
  const [dataVersion, setDataVersion] = useState(0);

  // Check Confidentiality & Route Permission (Section 13 & 19)
  const canAccessPayroll =
    canAccessModule('payroll') ||
    hasPermission('PAYROLL_MANAGE') ||
    hasPermission('PAYROLL_VIEW') ||
    hasPermission('CONFIDENTIAL_VIEW') ||
    hasPermission('ALL');

  // Navigation Sub-Tabs
  const [activeTab, setActiveTab] = useState<'runs' | 'structures' | 'components' | 'assignments'>('runs');

  // Data Fetching
  const payrollRuns = useMemo(() => db.getPayrollRuns(), [dataVersion]);
  const salaryStructures = useMemo(() => db.getSalaryStructures(), [dataVersion]);
  const salaryGradeSteps = useMemo(() => db.getSalaryGradeSteps(), [dataVersion]);
  const payrollComponents = useMemo(() => db.getPayrollComponents(), [dataVersion]);
  const payrollAssignments = useMemo(() => db.getEmployeePayrollAssignments(), [dataVersion]);
  const employees = useMemo(() => db.getEmployees(), [dataVersion]);
  const departments = useMemo(() => db.getDepartments(), []);
  const gradeLevels = useMemo(() => db.getGradeLevels(), []);

  // Filter / Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<number | null>(payrollRuns[0]?.id || null);
  const [previewPayslip, setPreviewPayslip] = useState<EmployeePayslip | null>(null);
  const lastPreviewPayslipRef = useRef<EmployeePayslip | null>(null);
  if (previewPayslip) lastPreviewPayslipRef.current = previewPayslip;
  const activePreviewPayslip = previewPayslip || lastPreviewPayslipRef.current;

  // Modals & Confirmation Drawers
  const [showNewRunModal, setShowNewRunModal] = useState(false);
  const [showNewComponentModal, setShowNewComponentModal] = useState(false);
  const [editingComponent, setEditingComponent] = useState<PayrollComponent | null>(null);
  const [deletingComponent, setDeletingComponent] = useState<PayrollComponent | null>(null);
  const [confirmRunAction, setConfirmRunAction] = useState<{
    run: PayrollRun;
    action: 'Approve' | 'Disburse' | 'Delete';
  } | null>(null);
  const [editingGradeSteps, setEditingGradeSteps] = useState<{
    grade: GradeLevel;
    steps: [number, number, number, number, number];
  } | null>(null);
  const [showEditAssignmentModal, setShowEditAssignmentModal] = useState<number | null>(null); // empId
  const lastEditAssignmentIdRef = useRef<number | null>(null);
  if (showEditAssignmentModal !== null) lastEditAssignmentIdRef.current = showEditAssignmentModal;
  const activeEditAssignmentId = showEditAssignmentModal !== null ? showEditAssignmentModal : lastEditAssignmentIdRef.current;

  // Selected Run Payslips
  const activeRunPayslips = useMemo(() => {
    if (!selectedRunId) return [];
    return db.getEmployeePayslips(selectedRunId);
  }, [selectedRunId, dataVersion]);

  const filteredPayslips = useMemo(() => {
    return activeRunPayslips.filter((p) => {
      const matchSearch =
        p.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.staffId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.departmentName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch;
    });
  }, [activeRunPayslips, searchTerm]);

  // Selected Run Object
  const currentRun = useMemo(() => {
    return payrollRuns.find((r) => r.id === selectedRunId) || payrollRuns[0];
  }, [payrollRuns, selectedRunId]);

  // Helper currency formatter
  const formatGhs = (val: number) => {
    return `GHS ${val.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 1. RBAC Confidentiality Barrier
  if (!canAccessPayroll) {
    return (
      <div className="p-8 max-w-4xl mx-auto my-12 bg-white rounded-xl border border-slate-200 shadow-sm text-center space-y-4">
        <div className="w-14 h-14 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Restricted Confidential Records: Payroll & Compensation</h2>
        <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
          Access to civil service compensation parameters, Single Spine salary structures, and individual employee payslips
          is restricted to Finance Officers, the HR Director, and authorized System Administrators under Section 13 and
          Section 19 of the Civil Service Master Regulations.
        </p>
        <div className="p-3 bg-slate-50 rounded-lg inline-block text-xs font-mono text-slate-700 border border-slate-200">
          Current Role: <span className="font-bold text-rose-700">{currentRole?.roleName}</span> ({currentUser?.username})
        </div>
        <div className="pt-2">
          <p className="text-[11px] text-slate-400">
            To view this module, switch to <strong>Finance Officer</strong> or <strong>System Administrator</strong> via the top-right profile switcher.
          </p>
        </div>
      </div>
    );
  }

  // --- Handlers ---
  const handleConfirmRunAction = () => {
    if (!confirmRunAction) return;
    const { run, action } = confirmRunAction;
    if (action === 'Approve') {
      db.updatePayrollRunStatus(
        run.id,
        'Approved',
        currentUser?.fullName || 'HR Director',
        currentUser?.username || 'admin'
      );
    } else if (action === 'Disburse') {
      db.updatePayrollRunStatus(
        run.id,
        'Disbursed',
        currentUser?.fullName || 'Finance Officer',
        currentUser?.username || 'admin'
      );
    } else if (action === 'Delete') {
      const res = db.deletePayrollRun(run.id, currentUser?.username || 'admin');
      if (!res.success) {
        notificationService.error('Delete Payroll Run Blocked', res.message, {
          module: 'Payroll & Compensation',
          actor: currentUser?.username,
        });
      } else {
        const remaining = db.getPayrollRuns();
        setSelectedRunId(remaining[0]?.id || null);
      }
    }
    setConfirmRunAction(null);
    setDataVersion((prev) => prev + 1);
  };

  const handleExportCsv = () => {
    if (!currentRun || activeRunPayslips.length === 0) return;
    const headers = [
      'Payslip Ref',
      'Staff ID',
      'Employee Name',
      'Department',
      'Grade',
      'Step',
      'Basic Salary (GHS)',
      'Total Allowances (GHS)',
      'Gross Salary (GHS)',
      'SSNIT 5.5% (GHS)',
      'PAYE Tax (GHS)',
      'Other Deductions (GHS)',
      'Total Deductions (GHS)',
      'Net Salary (GHS)',
      'Bank Name',
      'Account Number',
    ];

    const rows = activeRunPayslips.map((p) => [
      p.id,
      p.staffId,
      `"${p.employeeName}"`,
      `"${p.departmentName}"`,
      `"${p.gradeName}"`,
      p.salaryStep,
      p.basicSalaryGhs.toFixed(2),
      p.totalAllowancesGhs.toFixed(2),
      p.grossSalaryGhs.toFixed(2),
      p.ssnitDeductionGhs.toFixed(2),
      p.payeTaxGhs.toFixed(2),
      p.otherDeductionsGhs.toFixed(2),
      p.totalDeductionsGhs.toFixed(2),
      p.netSalaryGhs.toFixed(2),
      `"${p.bankName}"`,
      `'${p.bankAccountNumber}`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Civil_Service_Payroll_${currentRun.periodLabel.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notificationService.security(
      'Payroll Bank Advice Exported',
      `Exported ${activeRunPayslips.length} payslip disbursement row(s) for ${currentRun.periodLabel}.`,
      { module: 'Payroll & Compensation', actor: currentUser?.username }
    );
  };

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-5">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-xs">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900">Payroll & Compensation Management</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center">
                <Lock className="w-3 h-3 mr-1" />
                Confidential
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Single Spine Salary Structure (SSSS), allowance/deduction rules, monthly payroll processing & payslips (Section 13)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {hasPermission('PAYROLL_MANAGE') && (
            <button
              onClick={() => setShowNewRunModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Execute New Payroll Run</span>
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Bank Advice (CSV)</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-1 border-b border-slate-200 text-xs">
        <button
          onClick={() => setActiveTab('runs')}
          className={`px-4 py-2 font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'runs'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Monthly Payroll Runs ({payrollRuns.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'assignments'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Staff Salary & Bank Assignments ({payrollAssignments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('structures')}
          className={`px-4 py-2 font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'structures'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" />
          <span>Single Spine Structure & Steps</span>
        </button>

        <button
          onClick={() => setActiveTab('components')}
          className={`px-4 py-2 font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'components'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Percent className="w-3.5 h-3.5" />
          <span>Allowances & Deductions Rules ({payrollComponents.length})</span>
        </button>
      </div>

      {/* TAB 1: MONTHLY PAYROLL RUNS & PAYSLIPS */}
      {activeTab === 'runs' && (
        <div className="space-y-4">
          {/* Top Run Selector & Executive Statistics */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Run Selection Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Active Payroll Period
              </span>
              <SearchableSelect
                value={selectedRunId || ''}
                onChange={(val) => setSelectedRunId(Number(val))}
                options={payrollRuns.map((r) => ({
                  value: r.id.toString(),
                  label: `${r.periodLabel}`,
                  subLabel: `${r.status} • ${r.totalStaffCount} staff`,
                  badge: r.status,
                }))}
                placeholder="Select period..."
                searchPlaceholder="Filter payroll periods..."
                buttonClassName="h-9 px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-900 font-semibold"
              />

              {currentRun && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      currentRun.status === 'Disbursed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : currentRun.status === 'Approved'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {currentRun.status}
                  </span>
                </div>
              )}

              {/* Action Buttons based on status */}
              {currentRun && (
                <div className="pt-2 space-y-1.5">
                  {currentRun.status === 'Processed' && hasPermission('PAYROLL_MANAGE') && (
                    <>
                      <button
                        onClick={() => setConfirmRunAction({ run: currentRun, action: 'Approve' })}
                        className="w-full py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold transition-colors"
                      >
                        Authorize &amp; Ratify Run
                      </button>
                      <button
                        onClick={() => setConfirmRunAction({ run: currentRun, action: 'Delete' })}
                        className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold transition-colors flex items-center justify-center space-x-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Draft Batch</span>
                      </button>
                    </>
                  )}
                  {currentRun.status === 'Approved' && hasPermission('PAYROLL_MANAGE') && (
                    <button
                      onClick={() => setConfirmRunAction({ run: currentRun, action: 'Disburse' })}
                      className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold transition-colors"
                    >
                      Disburse Bank Payments
                    </button>
                  )}
                  {currentRun.status === 'Disbursed' && (
                    <div className="text-[11px] text-emerald-700 text-center font-medium bg-emerald-50 py-1 rounded">
                      Disbursed on {currentRun.approvedDate?.split('T')[0] || '2026-10-25'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Metrics cards */}
            {currentRun && (
              <>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Total Gross Wage Bill
                  </span>
                  <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
                    {formatGhs(currentRun.totalGrossGhs)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                    <span>Basic: {formatGhs(currentRun.totalBasicGhs)}</span>
                    <span className="text-emerald-700">+{formatGhs(currentRun.totalAllowancesGhs)} Allw</span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Total Statutory Deductions
                  </span>
                  <div className="text-xl font-extrabold text-rose-700 mt-1 font-mono">
                    {formatGhs(currentRun.totalDeductionsGhs)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    SSNIT Tier 1 & 2 + GRA PAYE Income Tax + Union Dues
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Total Net Bank Disbursement
                  </span>
                  <div className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">
                    {formatGhs(currentRun.totalNetGhs)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Across {currentRun.totalStaffCount} Active Civil Service Officers
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Payslips Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-800">
                  Employee Payslips for {currentRun?.periodLabel} ({filteredPayslips.length})
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search staff ID, name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1 text-xs rounded border border-slate-300 bg-white focus:outline-blue-600 w-48 sm:w-64"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Staff ID</th>
                    <th className="py-2.5 px-3">Officer Name</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Grade & Step</th>
                    <th className="py-2.5 px-3 text-right">Basic (GHS)</th>
                    <th className="py-2.5 px-3 text-right">Allowances</th>
                    <th className="py-2.5 px-3 text-right">Gross</th>
                    <th className="py-2.5 px-3 text-right">Deductions</th>
                    <th className="py-2.5 px-3 text-right font-bold text-emerald-800">Net Pay (GHS)</th>
                    <th className="py-2.5 px-3">Bank Details</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayslips.map((slip) => (
                    <tr key={slip.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{slip.staffId}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{slip.employeeName}</td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px] truncate max-w-[150px]">
                        {slip.departmentName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        <span className="font-medium">{slip.gradeName}</span> <span className="text-[11px] font-mono text-slate-500">/ Step {slip.salaryStep}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right text-slate-800">
                        {slip.basicSalaryGhs.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right text-emerald-700">
                        +{slip.totalAllowancesGhs.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right font-medium text-slate-900">
                        {slip.grossSalaryGhs.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right text-rose-700">
                        -{slip.totalDeductionsGhs.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right font-bold text-emerald-800 bg-emerald-50/50">
                        {slip.netSalaryGhs.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-600">
                        <span className="block font-medium truncate max-w-[130px]">{slip.bankName}</span>
                        <span className="font-mono text-[10px] text-slate-400">Acc: {slip.bankAccountNumber}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => setPreviewPayslip(slip)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 text-blue-700 font-semibold text-[11px] transition-colors"
                          >
                            Payslip
                          </button>
                          {onSelectEmployee && (
                            <button
                              onClick={() => onSelectEmployee(slip.employeeId)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-[11px]"
                            >
                              Dossier
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPayslips.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400">
                        No payslips found matching query for this payroll run.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STAFF SALARY & BANK ASSIGNMENTS */}
      {activeTab === 'assignments' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Staff Compensation & Banking Directives</h3>
              <p className="text-[11px] text-slate-500">
                Single Spine salary steps, bank account numbers, SSNIT numbers, and personalized components
              </p>
            </div>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Officer</th>
                  <th className="py-2.5 px-3">Substantive Grade</th>
                  <th className="py-2.5 px-3">Assigned Step</th>
                  <th className="py-2.5 px-3">Monthly Basic (GHS)</th>
                  <th className="py-2.5 px-3">SSNIT Number</th>
                  <th className="py-2.5 px-3">TIN</th>
                  <th className="py-2.5 px-3">Bank & Account Number</th>
                  <th className="py-2.5 px-3">Active Allowances</th>
                  {hasPermission('PAYROLL_MANAGE') && <th className="py-2.5 px-3 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => {
                  const personal = db.getEmployeePersonalInfo(emp.id);
                  const employment = db.getEmployeeEmploymentInfo(emp.id);
                  const asgn = db.getEmployeePayrollAssignment(emp.id);
                  const grade = gradeLevels.find((g) => g.id === employment?.currentGradeId);

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900 block">
                          {personal?.fullName || `${personal?.firstName} ${personal?.surname}`}
                        </span>
                        <span className="font-mono text-[10px] text-blue-700">{emp.staffId}</span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {grade?.gradeName}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-800">
                        Step {asgn?.salaryStep || 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {formatGhs(asgn?.basicSalaryMonthlyGhs || grade?.monthlyBaseGhs || 4500)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {asgn?.ssnitNumber || 'Pending SSNIT'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {asgn?.taxIdentificationNumber || 'Pending TIN'}
                      </td>
                      <td className="py-2.5 px-3 text-[11px]">
                        <span className="font-medium text-slate-900 block">{asgn?.bankName || 'GCB Bank'}</span>
                        <span className="font-mono text-slate-400">{asgn?.bankAccountNumber || 'Not set'}</span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-600">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                          {asgn?.allowanceComponentIds.length || 3} Allowances
                        </span>
                      </td>
                      {hasPermission('PAYROLL_MANAGE') && (
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => setShowEditAssignmentModal(emp.id)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 text-blue-700 font-semibold text-[11px]"
                          >
                            Modify
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SINGLE SPINE STRUCTURE (SSSS) & STEPS */}
      {activeTab === 'structures' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
            <h3 className="text-sm font-bold text-slate-900">Single Spine Salary Structure (Public Services 2026)</h3>
            <p className="text-xs text-slate-600">
              Approved salary scales mapped to Civil Service Grade Levels with 5 incremental steps per grade level.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Title / Cadre Level</th>
                    <th className="py-2.5 px-3 text-right">Step 1 (Entry)</th>
                    <th className="py-2.5 px-3 text-right">Step 2</th>
                    <th className="py-2.5 px-3 text-right">Step 3</th>
                    <th className="py-2.5 px-3 text-right">Step 4</th>
                    <th className="py-2.5 px-3 text-right">Step 5 (Ceiling)</th>
                    {hasPermission('PAYROLL_MANAGE') && (
                      <th className="py-2.5 px-3 text-center">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gradeLevels.map((g) => {
                    const steps = salaryGradeSteps.filter((s) => s.gradeLevelId === g.id);
                    const step1 = steps.find((s) => s.stepNumber === 1)?.basicSalaryMonthlyGhs || g.monthlyBaseGhs;
                    const step2 = steps.find((s) => s.stepNumber === 2)?.basicSalaryMonthlyGhs || Math.round(step1 * 1.045);
                    const step3 = steps.find((s) => s.stepNumber === 3)?.basicSalaryMonthlyGhs || Math.round(step1 * 1.09);
                    const step4 = steps.find((s) => s.stepNumber === 4)?.basicSalaryMonthlyGhs || Math.round(step1 * 1.14);
                    const step5 = steps.find((s) => s.stepNumber === 5)?.basicSalaryMonthlyGhs || Math.round(step1 * 1.19);

                    return (
                      <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-slate-900">{g.gradeName}</td>
                        <td className="py-2.5 px-3 font-mono text-right text-slate-800">{formatGhs(step1)}</td>
                        <td className="py-2.5 px-3 font-mono text-right text-slate-800">{formatGhs(step2)}</td>
                        <td className="py-2.5 px-3 font-mono text-right text-slate-800">{formatGhs(step3)}</td>
                        <td className="py-2.5 px-3 font-mono text-right text-slate-800">{formatGhs(step4)}</td>
                        <td className="py-2.5 px-3 font-mono text-right font-bold text-slate-900 bg-slate-50">
                          {formatGhs(step5)}
                        </td>
                        {hasPermission('PAYROLL_MANAGE') && (
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() =>
                                setEditingGradeSteps({
                                  grade: g,
                                  steps: [step1, step2, step3, step4, step5],
                                })
                              }
                              className="p-1.5 rounded bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors"
                              title={`Edit SSSS steps for ${g.gradeName}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ALLOWANCES & DEDUCTIONS RULES */}
      {activeTab === 'components' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Configurable Civil Service Allowances & Deductions</h3>
              <p className="text-xs text-slate-500">
                Rule engine for percentage and fixed parameters without hardcoding amounts
              </p>
            </div>
            {hasPermission('PAYROLL_MANAGE') && (
              <button
                onClick={() => setShowNewComponentModal(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Component Rule</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Allowances Column */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-600 mr-1.5"></span>
                Allowances ({payrollComponents.filter((c) => c.type === 'Allowance').length})
              </h4>

              {payrollComponents
                .filter((c) => c.type === 'Allowance')
                .map((comp) => (
                  <div key={comp.id} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 text-xs">{comp.name}</span>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                          {comp.calculationType === 'PercentageOfBasic' ? `${comp.rateOrAmount}% of Basic` : formatGhs(comp.rateOrAmount)}
                        </span>
                        {hasPermission('PAYROLL_MANAGE') && (
                          <>
                            <button
                              onClick={() => setEditingComponent(comp)}
                              className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                              title="Edit component rule"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingComponent(comp)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete component rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">{comp.description}</p>
                    <div className="flex items-center space-x-2 text-[10px] text-slate-400 pt-1">
                      <span>Code: <strong className="font-mono text-slate-600">{comp.componentCode}</strong></span>
                      <span>•</span>
                      <span>{comp.isTaxable ? 'Taxable' : 'Tax Exempt'}</span>
                      {comp.targetCadre && <span>• Cadre: {comp.targetCadre}</span>}
                    </div>
                  </div>
                ))}
            </div>

            {/* Deductions Column */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center">
                <span className="w-2 h-2 rounded-full bg-rose-600 mr-1.5"></span>
                Deductions ({payrollComponents.filter((c) => c.type === 'Deduction').length})
              </h4>

              {payrollComponents
                .filter((c) => c.type === 'Deduction')
                .map((comp) => {
                  const isCoreStatutory =
                    comp.componentCode === 'DED-SSNIT-TIER1' || comp.componentCode === 'DED-GRA-PAYE';
                  return (
                    <div key={comp.id} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 text-xs">{comp.name}</span>
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800">
                            {comp.calculationType === 'PercentageOfBasic' ? `${comp.rateOrAmount}% of Basic` : formatGhs(comp.rateOrAmount)}
                          </span>
                          {hasPermission('PAYROLL_MANAGE') && (
                            <>
                              <button
                                onClick={() => setEditingComponent(comp)}
                                className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                title="Edit deduction rule"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                disabled={isCoreStatutory}
                                onClick={() => !isCoreStatutory && setDeletingComponent(comp)}
                                className={`p-1 rounded transition-colors ${
                                  isCoreStatutory
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                }`}
                                title={
                                  isCoreStatutory
                                    ? 'Statutory core deduction cannot be deleted'
                                    : 'Delete deduction rule'
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500">{comp.description}</p>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 pt-1">
                        <span>Code: <strong className="font-mono text-slate-600">{comp.componentCode}</strong></span>
                        <span>•</span>
                        <span>{comp.isStatutory ? 'Statutory Requirement' : 'Voluntary / Associational'}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* DRAWER 1: PREVIEW CIVIL SERVICE PAYSLIP */}
      <SlideOverPanel
        isOpen={Boolean(previewPayslip)}
        onClose={() => setPreviewPayslip(null)}
        title="Official Civil Service Payslip Advice"
        subtitle={
          activePreviewPayslip
            ? `${activePreviewPayslip.employeeName} (${activePreviewPayslip.staffId}) • ${activePreviewPayslip.periodLabel}`
            : 'Payslip Advice'
        }
        icon={<FileText className="w-4 h-4" />}
        maxWidthClass="max-w-2xl"
        overlayClassName="bg-black/40"
      >
        {activePreviewPayslip && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Payslip Header */}
              <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
                <BrandCrest
                  sizeClass="w-12 h-12"
                  className="mx-auto mb-1.5 border border-[#C9A24D] bg-white"
                />
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500">{institutionCountry}</div>
                <h2 className="text-base font-extrabold text-slate-900">{institutionName}</h2>
                <div className="text-xs font-semibold text-emerald-800">Official Civil Service Payslip Advice</div>
                <div className="text-[11px] font-mono text-slate-600">Period: {activePreviewPayslip.periodLabel}</div>
              </div>

              {/* Officer Information Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Employee Name:</span>
                  <div className="font-bold text-slate-900">{activePreviewPayslip.employeeName}</div>
                  <div className="text-[11px] text-slate-500">Staff ID: {activePreviewPayslip.staffId}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Department:</span>
                  <div className="font-medium text-slate-800">{activePreviewPayslip.departmentName}</div>
                  <div className="text-[11px] font-medium text-blue-700">
                    Grade: {activePreviewPayslip.gradeName} / Step {activePreviewPayslip.salaryStep}
                  </div>
                </div>
              </div>

              {/* Earnings Breakdown */}
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 uppercase tracking-wider text-[11px]">
                  Earnings (GHS)
                </h4>
                <div className="flex justify-between py-1">
                  <span>Monthly Basic Salary:</span>
                  <span className="font-mono font-bold">{activePreviewPayslip.basicSalaryGhs.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Consolidated Allowances:</span>
                  <span className="font-mono text-emerald-700 font-semibold">+{activePreviewPayslip.totalAllowancesGhs.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-t border-slate-200 font-bold bg-slate-50 p-1.5 rounded">
                  <span>Total Gross Earnings:</span>
                  <span className="font-mono text-slate-900">{activePreviewPayslip.grossSalaryGhs.toFixed(2)}</span>
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-rose-900 border-b border-rose-200 pb-1 uppercase tracking-wider text-[11px]">
                  Deductions (GHS)
                </h4>
                <div className="flex justify-between py-1">
                  <span>SSNIT Tier 1 &amp; 2 Employee Contribution (5.5%):</span>
                  <span className="font-mono text-rose-700">-{activePreviewPayslip.ssnitDeductionGhs.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>GRA PAYE Statutory Income Tax:</span>
                  <span className="font-mono text-rose-700">-{activePreviewPayslip.payeTaxGhs.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>CLOGSAG &amp; Staff Welfare Fund:</span>
                  <span className="font-mono text-rose-700">-{activePreviewPayslip.otherDeductionsGhs.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-t border-slate-200 font-bold bg-rose-50 p-1.5 rounded text-rose-900">
                  <span>Total Deductions:</span>
                  <span className="font-mono">-{activePreviewPayslip.totalDeductionsGhs.toFixed(2)}</span>
                </div>
              </div>

              {/* Net Salary Callout */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-emerald-950">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                    Net Take-Home Pay
                  </span>
                  <span className="text-xl font-extrabold font-mono">{formatGhs(activePreviewPayslip.netSalaryGhs)}</span>
                </div>
                <div className="text-right text-xs">
                  <span className="text-[10px] text-slate-500 block">Credited to:</span>
                  <span className="font-semibold block">{activePreviewPayslip.bankName}</span>
                  <span className="font-mono text-[11px] text-slate-600">Acc: {activePreviewPayslip.bankAccountNumber}</span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  notificationService.success(
                    'Payslip Print Prepared',
                    `Prepared printable payslip for ${activePreviewPayslip.employeeName}.`,
                    { module: 'Payroll & Compensation', actor: currentUser?.username }
                  );
                  void printPage();
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Payslip</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewPayslip(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* DRAWER 2: EXECUTE NEW PAYROLL RUN */}
      <SlideOverPanel
        isOpen={showNewRunModal}
        onClose={() => setShowNewRunModal(false)}
        title="Execute New Monthly Payroll Run"
        subtitle="Single Spine Salary Structure (SSSS) Batch Calculation"
        icon={<CreditCard className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const year = Number(form.periodYear.value);
            const month = Number(form.periodMonth.value);
            const monthName = form.periodMonth.options[form.periodMonth.selectedIndex].text;
            const label = `${monthName} ${year} Payroll Run`;

            const res = db.runMonthlyPayroll(year, month, label, currentUser?.username || 'admin');
            setSelectedRunId(res.run.id);
            setDataVersion((prev) => prev + 1);
            setShowNewRunModal(false);
          }}
          className="flex-1 flex flex-col overflow-hidden text-xs"
        >
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-2.5">
              Runs calculation across all active Nominal Roll officers using Single Spine salary steps, allowances, and statutory taxes.
            </p>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Calendar Year</label>
              <input
                name="periodYear"
                type="number"
                defaultValue={2026}
                required
                className="w-full p-2 rounded border border-slate-300"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Payroll Month</label>
              <select name="periodMonth" defaultValue={11} className="w-full p-2 rounded border border-slate-300 bg-white">
                <option value={1}>January</option>
                <option value={2}>February</option>
                <option value={3}>March</option>
                <option value={4}>April</option>
                <option value={5}>May</option>
                <option value={6}>June</option>
                <option value={7}>July</option>
                <option value={8}>August</option>
                <option value={9}>September</option>
                <option value={10}>October</option>
                <option value={11}>November</option>
                <option value={12}>December</option>
              </select>
            </div>

            <div className="p-3 bg-amber-50 rounded text-amber-900 text-[11px] border border-amber-200">
              <strong>Statutory Check:</strong> Will calculate SSNIT 5.5% employee contributions and apply GRA graduated PAYE income tax brackets.
            </div>
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowNewRunModal(false)}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-xs"
            >
              Run Calculation
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* DRAWER 3: ADD PAYROLL COMPONENT */}
      <SlideOverPanel
        isOpen={showNewComponentModal}
        onClose={() => setShowNewComponentModal(false)}
        title="Add Allowance / Deduction Component"
        subtitle="Configurable Pay Element & Statutory Withholding"
        icon={<Sliders className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            db.createPayrollComponent(
              {
                componentCode: form.componentCode.value.trim().toUpperCase(),
                name: form.componentName.value.trim(),
                type: form.componentType.value as 'Allowance' | 'Deduction',
                calculationType: form.calculationType.value as 'PercentageOfBasic' | 'FixedAmount',
                rateOrAmount: Number(form.rateOrAmount.value),
                isStatutory: form.isStatutory.checked,
                isTaxable: form.isTaxable.checked,
                appliesToAll: form.appliesToAll.checked,
                description: form.description.value.trim(),
              },
              currentUser?.username || 'admin'
            );
            setDataVersion((prev) => prev + 1);
            setShowNewComponentModal(false);
          }}
          className="flex-1 flex flex-col overflow-hidden text-xs"
        >
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Component Code</label>
              <input
                name="componentCode"
                placeholder="e.g. ALLW-HAZARD"
                required
                className="w-full p-2 rounded border border-slate-300 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Display Name</label>
              <input
                name="componentName"
                placeholder="e.g. Environmental Hazard Allowance"
                required
                className="w-full p-2 rounded border border-slate-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Type</label>
                <select name="componentType" className="w-full p-2 rounded border border-slate-300 bg-white">
                  <option value="Allowance">Allowance (Earning)</option>
                  <option value="Deduction">Deduction (Withholding)</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Calculation</label>
                <select name="calculationType" className="w-full p-2 rounded border border-slate-300 bg-white">
                  <option value="PercentageOfBasic">% of Basic Salary</option>
                  <option value="FixedAmount">Fixed Amount (GHS)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Rate / Amount</label>
              <input
                name="rateOrAmount"
                type="number"
                step="0.01"
                placeholder="e.g. 15 for 15% or 500 for GHS 500"
                required
                className="w-full p-2 rounded border border-slate-300"
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="flex items-center space-x-2">
                <input type="checkbox" name="isStatutory" />
                <span>Statutory Mandatory Deduction</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" name="isTaxable" defaultChecked />
                <span>Taxable Component</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" name="appliesToAll" defaultChecked />
                <span>Applies to all eligible staff by default</span>
              </label>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Description / Policy Mandate</label>
              <textarea
                name="description"
                rows={2}
                className="w-full p-2 rounded border border-slate-300"
                placeholder="e.g. Fair Wages and Salaries Commission circular reference"
              />
            </div>
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowNewComponentModal(false)}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
            >
              Save Component
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* DRAWER 4: EDIT STAFF PAYROLL ASSIGNMENT */}
      <SlideOverPanel
        isOpen={showEditAssignmentModal !== null}
        onClose={() => setShowEditAssignmentModal(null)}
        title="Modify Officer Compensation & Bank Assignment"
        subtitle="SSSS Salary Step, SSNIT, GRA TIN & Bank Settlement"
        icon={<Landmark className="w-4 h-4" />}
        maxWidthClass="max-w-lg"
        overlayClassName="bg-black/40"
      >
        {activeEditAssignmentId !== null &&
          (() => {
            const emp = employees.find((e) => e.id === activeEditAssignmentId);
            const personal = emp ? db.getEmployeePersonalInfo(emp.id) : null;
            const employment = emp ? db.getEmployeeEmploymentInfo(emp.id) : null;
            const asgn = emp ? db.getEmployeePayrollAssignment(emp.id) : null;
            const grade = gradeLevels.find((g) => g.id === employment?.currentGradeId);

            if (!emp || !personal) return null;

            return (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const stepNumber = Number(form.salaryStep.value);

                  // Compute basic salary for step
                  const steps = db.getSalaryGradeSteps(employment?.currentGradeId);
                  const matchedStep = steps.find((s) => s.stepNumber === stepNumber);
                  const basicSalaryMonthlyGhs =
                    matchedStep?.basicSalaryMonthlyGhs ||
                    (grade?.monthlyBaseGhs ? Math.round(grade.monthlyBaseGhs * (1 + (stepNumber - 1) * 0.045)) : 5000);

                  db.saveEmployeePayrollAssignment(
                    {
                      employeeId: emp.id,
                      gradeId: employment?.currentGradeId || 7,
                      salaryStep: stepNumber,
                      basicSalaryMonthlyGhs,
                      bankName: form.bankName.value.trim(),
                      bankBranch: form.bankBranch.value.trim(),
                      bankAccountNumber: form.bankAccountNumber.value.trim(),
                      ssnitNumber: form.ssnitNumber.value.trim(),
                      taxIdentificationNumber: form.taxIdentificationNumber.value.trim(),
                      allowanceComponentIds: asgn?.allowanceComponentIds || [1, 4, 5],
                      deductionComponentIds: asgn?.deductionComponentIds || [6, 7, 8, 9],
                    },
                    currentUser?.username || 'admin'
                  );

                  setDataVersion((prev) => prev + 1);
                  setShowEditAssignmentModal(null);
                }}
                className="flex-1 flex flex-col overflow-hidden text-xs"
              >
                <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="font-bold text-slate-900 block">{personal.fullName}</span>
                    <span className="text-[11px] text-slate-500">
                      Staff ID: {emp.staffId} • Substantive Grade: {grade?.gradeName}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Salary Step (1 to 5)</label>
                      <select name="salaryStep" defaultValue={asgn?.salaryStep || 1} className="w-full p-2 rounded border border-slate-300 bg-white">
                        <option value={1}>Step 1 (Entry Step)</option>
                        <option value={2}>Step 2</option>
                        <option value={3}>Step 3</option>
                        <option value={4}>Step 4</option>
                        <option value={5}>Step 5 (Ceiling Step)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">SSNIT Social Security #</label>
                      <input
                        name="ssnitNumber"
                        defaultValue={asgn?.ssnitNumber || 'C0192837465'}
                        required
                        className="w-full p-2 rounded border border-slate-300 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Bank Name</label>
                      <input
                        name="bankName"
                        defaultValue={asgn?.bankName || 'Ghana Commercial Bank (GCB)'}
                        required
                        className="w-full p-2 rounded border border-slate-300"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Bank Branch</label>
                      <input
                        name="bankBranch"
                        defaultValue={asgn?.bankBranch || 'Ministries Branch, Accra'}
                        required
                        className="w-full p-2 rounded border border-slate-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Bank Account Number</label>
                      <input
                        name="bankAccountNumber"
                        defaultValue={asgn?.bankAccountNumber || '1011029384756'}
                        required
                        className="w-full p-2 rounded border border-slate-300 font-mono"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">GRA Taxpayer ID (TIN)</label>
                      <input
                        name="taxIdentificationNumber"
                        defaultValue={asgn?.taxIdentificationNumber || 'P0001928374'}
                        required
                        className="w-full p-2 rounded border border-slate-300 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowEditAssignmentModal(null)}
                    className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                  >
                    Save Compensation Assignment
                  </button>
                </div>
              </form>
            );
          })()}
      </SlideOverPanel>

      {/* DRAWER 5: CONFIRM PAYROLL RUN ACTION (APPROVE / DISBURSE / DELETE) */}
      <SlideOverPanel
        isOpen={Boolean(confirmRunAction)}
        onClose={() => setConfirmRunAction(null)}
        title={
          confirmRunAction?.action === 'Delete'
            ? 'Delete Draft Payroll Batch'
            : confirmRunAction?.action === 'Disburse'
            ? 'Certify Bank Disbursement'
            : 'Authorize Monthly Payroll Run'
        }
        subtitle={confirmRunAction?.run.periodLabel}
        icon={<AlertCircle className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {confirmRunAction && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div
                className={`p-3.5 rounded-lg border space-y-1.5 ${
                  confirmRunAction.action === 'Delete'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="font-bold">
                  {confirmRunAction.action === 'Delete'
                    ? 'Remove unprocessed payroll batch and generated payslips?'
                    : confirmRunAction.action === 'Disburse'
                    ? 'Mark approved payroll run as officially disbursed?'
                    : 'Ratify and authorize this monthly payroll run for disbursement?'}
                </div>
                <p className="leading-relaxed">
                  {confirmRunAction.action === 'Delete'
                    ? `This will permanently delete "${confirmRunAction.run.periodLabel}" (${confirmRunAction.run.totalStaffCount} payslips). Approved or Disbursed batches remain protected.`
                    : confirmRunAction.action === 'Disburse'
                    ? `Confirm Bank of Ghana / CAGD settlement for ${confirmRunAction.run.periodLabel} totaling ${formatGhs(confirmRunAction.run.totalNetGhs)}. Disbursed runs become permanently locked.`
                    : `Ratifying ${confirmRunAction.run.periodLabel} locks gross earnings (${formatGhs(confirmRunAction.run.totalGrossGhs)}) and net pay (${formatGhs(confirmRunAction.run.totalNetGhs)}) for financial release.`}
                </p>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmRunAction(null)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRunAction}
                className={`px-4 py-1.5 rounded text-white font-semibold shadow-xs ${
                  confirmRunAction.action === 'Delete'
                    ? 'bg-rose-700 hover:bg-rose-800'
                    : confirmRunAction.action === 'Disburse'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-blue-700 hover:bg-blue-800'
                }`}
              >
                {confirmRunAction.action === 'Delete'
                  ? 'Confirm Delete Batch'
                  : confirmRunAction.action === 'Disburse'
                  ? 'Confirm Disbursement'
                  : 'Confirm Authorization'}
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* DRAWER 6: EDIT SSSS GRADE SALARY STEPS (1-5) */}
      <SlideOverPanel
        isOpen={Boolean(editingGradeSteps)}
        onClose={() => setEditingGradeSteps(null)}
        title="Edit Single Spine Salary Steps (1–5)"
        subtitle={editingGradeSteps?.grade.gradeName}
        icon={<Landmark className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {editingGradeSteps && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const existingSteps = db.getSalaryGradeSteps(editingGradeSteps.grade.id);
              editingGradeSteps.steps.forEach((monthlyVal, idx) => {
                const stepNum = idx + 1;
                const existing = existingSteps.find((s) => s.stepNumber === stepNum);
                db.saveSalaryGradeStep(
                  {
                    id: existing?.id,
                    gradeLevelId: editingGradeSteps.grade.id,
                    stepNumber: stepNum,
                    basicSalaryMonthlyGhs: Number(monthlyVal) || 0,
                    annualSalaryGhs: Math.round((Number(monthlyVal) || 0) * 12 * 100) / 100,
                  },
                  currentUser?.username || 'admin'
                );
              });
              setEditingGradeSteps(null);
              setDataVersion((prev) => prev + 1);
            }}
            className="flex-1 flex flex-col overflow-hidden text-xs"
          >
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600">
                Adjust monthly basic salary points (GHS) for Steps 1–5 on <strong>{editingGradeSteps.grade.gradeName}</strong>.
              </div>
              {editingGradeSteps.steps.map((val, idx) => (
                <div key={idx}>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Step {idx + 1} {idx === 0 ? '(Entry)' : idx === 4 ? '(Ceiling)' : ''} — Monthly Basic (GHS)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={val}
                    onChange={(e) => {
                      const next: [number, number, number, number, number] = [...editingGradeSteps.steps] as [
                        number,
                        number,
                        number,
                        number,
                        number
                      ];
                      next[idx] = parseFloat(e.target.value) || 0;
                      setEditingGradeSteps({ ...editingGradeSteps, steps: next });
                    }}
                    className="w-full p-2 rounded border border-slate-300 font-mono"
                  />
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingGradeSteps(null)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                Save SSSS Steps
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* DRAWER 7: EDIT PAYROLL COMPONENT */}
      <SlideOverPanel
        isOpen={Boolean(editingComponent)}
        onClose={() => setEditingComponent(null)}
        title="Edit Allowance / Deduction Component"
        subtitle={editingComponent ? `${editingComponent.componentCode} • ${editingComponent.name}` : undefined}
        icon={<Sliders className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {editingComponent && (
          <form
            key={editingComponent.id}
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              db.updatePayrollComponent(
                editingComponent.id,
                {
                  name: form.componentName.value.trim(),
                  type: form.componentType.value as 'Allowance' | 'Deduction',
                  calculationType: form.calculationType.value as 'PercentageOfBasic' | 'FixedAmount',
                  rateOrAmount: Number(form.rateOrAmount.value),
                  isStatutory: form.isStatutory.checked,
                  isTaxable: form.isTaxable.checked,
                  appliesToAll: form.appliesToAll.checked,
                  description: form.description.value.trim(),
                },
                currentUser?.username || 'admin'
              );
              setEditingComponent(null);
              setDataVersion((prev) => prev + 1);
            }}
            className="flex-1 flex flex-col overflow-hidden text-xs"
          >
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Component Code</label>
                <input
                  value={editingComponent.componentCode}
                  disabled
                  className="w-full p-2 rounded border border-slate-200 bg-slate-100 text-slate-500 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Display Name</label>
                <input
                  name="componentName"
                  defaultValue={editingComponent.name}
                  required
                  className="w-full p-2 rounded border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Type</label>
                  <select
                    name="componentType"
                    defaultValue={editingComponent.type}
                    className="w-full p-2 rounded border border-slate-300 bg-white"
                  >
                    <option value="Allowance">Allowance (Earning)</option>
                    <option value="Deduction">Deduction (Withholding)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Calculation</label>
                  <select
                    name="calculationType"
                    defaultValue={editingComponent.calculationType}
                    className="w-full p-2 rounded border border-slate-300 bg-white"
                  >
                    <option value="PercentageOfBasic">% of Basic Salary</option>
                    <option value="FixedAmount">Fixed Amount (GHS)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Rate / Amount</label>
                <input
                  name="rateOrAmount"
                  type="number"
                  step="0.01"
                  defaultValue={editingComponent.rateOrAmount}
                  required
                  className="w-full p-2 rounded border border-slate-300"
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" name="isStatutory" defaultChecked={editingComponent.isStatutory} />
                  <span>Statutory Mandatory Deduction</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" name="isTaxable" defaultChecked={editingComponent.isTaxable} />
                  <span>Taxable Component</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" name="appliesToAll" defaultChecked={editingComponent.appliesToAll} />
                  <span>Applies to all eligible staff by default</span>
                </label>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description / Policy Mandate</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editingComponent.description || ''}
                  className="w-full p-2 rounded border border-slate-300"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingComponent(null)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold"
              >
                Update Component
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* DRAWER 8: DELETE PAYROLL COMPONENT */}
      <SlideOverPanel
        isOpen={Boolean(deletingComponent)}
        onClose={() => setDeletingComponent(null)}
        title="Delete Payroll Component Rule"
        subtitle={deletingComponent ? `${deletingComponent.componentCode} • ${deletingComponent.name}` : undefined}
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingComponent && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1.5">
                <div className="font-bold">Remove component "{deletingComponent.name}"?</div>
                <p className="leading-relaxed">
                  Historical payslips remain unchanged, and future payroll runs will no longer calculate this {deletingComponent.type.toLowerCase()} rule.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingComponent(null)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  db.deletePayrollComponent(deletingComponent.id, currentUser?.username || 'admin');
                  setDeletingComponent(null);
                  setDataVersion((prev) => prev + 1);
                }}
                className="px-4 py-1.5 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold shadow-xs"
              >
                Delete Component
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>
    </div>
  );
};
