/**
 * Haros HRMIS - Leave Management View
 * Implements 10 Statutory Leave Categories, Entitlement Balances, Applications,
 * Multi-Tier Approval Workflows, Leave Resumptions, and Nominal Roll Integration.
 */

import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Plus,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Building2,
  ChevronRight,
  ArrowRight,
  Send,
  Eye,
  Check,
  X,
  RotateCcw,
  Calendar,
  AlertTriangle,
  Edit2,
  Trash2,
} from 'lucide-react';
import { db } from '../../db/storage';
import { notificationService } from '../../services/notifications/notificationService';
import { useAuth } from '../../context/AuthContext';
import {
  LeaveType,
  LeaveBalance,
  LeaveApplication,
  Employee,
  Department,
  Mda,
} from '../../types';
import { SearchableSelect } from '../common/SearchableSelect';
import { SlideOverPanel } from '../common/SlideOverPanel';

interface LeaveManagementViewProps {
  onSelectEmployee?: (empId: number) => void;
}

export const LeaveManagementView: React.FC<LeaveManagementViewProps> = ({ onSelectEmployee }) => {
  const { currentUser, hasPermission } = useAuth();
  const [dataVersion, setDataVersion] = useState(0);

  // Active Tab: 'applications' | 'balances'
  const [activeTab, setActiveTab] = useState<'applications' | 'balances'>('applications');

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLeaveTypeId, setFilterLeaveTypeId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDeptId, setFilterDeptId] = useState<string>('all');

  // Modals state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [editingLeaveApp, setEditingLeaveApp] = useState<LeaveApplication | null>(null);
  const [deletingLeaveApp, setDeletingLeaveApp] = useState<LeaveApplication | null>(null);
  const [selectedAppForReview, setSelectedAppForReview] = useState<LeaveApplication | null>(null);
  const lastReviewAppRef = React.useRef<LeaveApplication | null>(null);
  if (selectedAppForReview) {
    lastReviewAppRef.current = selectedAppForReview;
  }
  const activeReviewApp = selectedAppForReview || lastReviewAppRef.current;

  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumptionDate, setResumptionDate] = useState(new Date().toISOString().slice(0, 10));
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Load data
  const leaveTypes = useMemo(() => db.getLeaveTypes(), []);
  const leaveBalances = useMemo(() => db.getLeaveBalances(), [dataVersion]);
  const leaveApplications = useMemo(() => db.getLeaveApplications(), [dataVersion]);
  const employees = useMemo(() => db.getEmployees(), [dataVersion]);
  const departments = useMemo(() => db.getDepartments(), [dataVersion]);
  const mdas = useMemo(() => db.getMdas(), []);

  // Filtered Applications
  const filteredApplications = useMemo(() => {
    return leaveApplications.filter((app) => {
      const emp = db.getEmployeeById(app.employeeId);
      const pers = db.getEmployeePersonalInfo(app.employeeId);
      const empInfo = db.getEmployeeEmploymentInfo(app.employeeId);
      const fullName = pers?.fullName || `${pers?.firstName || ''} ${pers?.surname || ''}`;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchRef = app.leaveReferenceNumber.toLowerCase().includes(q);
        const matchStaff = emp?.staffId.toLowerCase().includes(q) || false;
        const matchName = fullName.toLowerCase().includes(q);
        const matchReason = app.reason.toLowerCase().includes(q);
        if (!matchRef && !matchStaff && !matchName && !matchReason) return false;
      }

      if (filterLeaveTypeId !== 'all' && app.leaveTypeId.toString() !== filterLeaveTypeId) return false;
      if (filterStatus !== 'all' && app.workflowStatus !== filterStatus) return false;
      if (filterDeptId !== 'all' && empInfo?.currentDepartmentId.toString() !== filterDeptId) return false;

      return true;
    });
  }, [leaveApplications, searchTerm, filterLeaveTypeId, filterStatus, filterDeptId]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalApps = leaveApplications.length;
    const pendingReviews = leaveApplications.filter(
      (a) => a.workflowStatus === 'Submitted' || a.workflowStatus === 'Supervisor Recommended' || a.workflowStatus === 'HR Reviewed'
    ).length;
    const activeOnLeave = leaveApplications.filter((a) => a.workflowStatus === 'Approved').length;
    const resumed = leaveApplications.filter((a) => a.workflowStatus === 'Resumed').length;
    return { totalApps, pendingReviews, activeOnLeave, resumed };
  }, [leaveApplications]);

  // Form State for Leave Application
  const [applyEmpId, setApplyEmpId] = useState<number>(employees[0]?.id || 1);
  const [applyTypeId, setApplyTypeId] = useState<number>(1); // Annual
  const [applyStartDate, setApplyStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [applyEndDate, setApplyEndDate] = useState(
    new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10)
  );
  const [applyDays, setApplyDays] = useState<number>(10);
  const [applyHandoverEmpId, setApplyHandoverEmpId] = useState<string>('');
  const [applyReason, setApplyReason] = useState('');
  const [applyAddress, setApplyAddress] = useState('');
  const [applyPhone, setApplyPhone] = useState('');

  // Selected officer's available balance preview
  const activeEmpBalance = useMemo(() => {
    return leaveBalances.find((b) => b.employeeId === applyEmpId && b.leaveTypeId === applyTypeId);
  }, [leaveBalances, applyEmpId, applyTypeId]);

  const handleOpenApplyModal = (preselectedEmpId?: number) => {
    setEditingLeaveApp(null);
    const empId = preselectedEmpId || employees[0]?.id || 1;
    setApplyEmpId(empId);
    setApplyTypeId(1);
    const start = new Date();
    start.setDate(start.getDate() + 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    setApplyStartDate(start.toISOString().slice(0, 10));
    setApplyEndDate(end.toISOString().slice(0, 10));
    setApplyDays(10);
    setApplyHandoverEmpId('');
    setApplyReason('Annual statutory vacation leave.');
    setApplyAddress('Residential contact address while away');
    setApplyPhone('+233 24 123 4567');
    setShowApplyModal(true);
  };

  const handleOpenEditLeaveModal = (app: LeaveApplication) => {
    setEditingLeaveApp(app);
    setApplyEmpId(app.employeeId);
    setApplyTypeId(app.leaveTypeId);
    setApplyStartDate(app.startDate);
    setApplyEndDate(app.endDate);
    setApplyDays(app.daysRequested);
    setApplyHandoverEmpId(app.handoverOfficerEmployeeId ? app.handoverOfficerEmployeeId.toString() : '');
    setApplyReason(app.reason);
    setApplyAddress(app.contactAddressWhileOnLeave || '');
    setApplyPhone(app.contactPhoneWhileOnLeave || '');
    setShowApplyModal(true);
  };

  const handleSaveApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyReason.trim()) return;

    if (editingLeaveApp) {
      const res = db.updateLeaveApplication(
        editingLeaveApp.id,
        {
          employeeId: applyEmpId,
          leaveTypeId: applyTypeId,
          startDate: applyStartDate,
          endDate: applyEndDate,
          daysRequested: applyDays,
          handoverOfficerEmployeeId: applyHandoverEmpId ? parseInt(applyHandoverEmpId, 10) : undefined,
          reason: applyReason.trim(),
          contactAddressWhileOnLeave: applyAddress.trim(),
          contactPhoneWhileOnLeave: applyPhone.trim(),
        },
        currentUser?.username || 'admin'
      );
      if (!res.success) {
        notificationService.error('Update Leave Blocked', res.message, {
          module: 'Leave Management',
          actor: currentUser?.username,
        });
        return;
      }
    } else {
      db.createLeaveApplication(
        {
          employeeId: applyEmpId,
          leaveTypeId: applyTypeId,
          startDate: applyStartDate,
          endDate: applyEndDate,
          daysRequested: applyDays,
          handoverOfficerEmployeeId: applyHandoverEmpId ? parseInt(applyHandoverEmpId, 10) : undefined,
          reason: applyReason.trim(),
          contactAddressWhileOnLeave: applyAddress.trim(),
          contactPhoneWhileOnLeave: applyPhone.trim(),
        },
        currentUser?.username || 'admin'
      );
    }

    setEditingLeaveApp(null);
    setShowApplyModal(false);
    setDataVersion((v) => v + 1);
  };

  const handleConfirmDeleteLeave = () => {
    if (!deletingLeaveApp) return;
    const res = db.deleteLeaveApplication(deletingLeaveApp.id, currentUser?.username || 'admin');
    if (!res.success) {
      notificationService.error('Withdraw Leave Blocked', res.message, {
        module: 'Leave Management',
        actor: currentUser?.username,
      });
    }
    setDeletingLeaveApp(null);
    setDataVersion((v) => v + 1);
  };

  const handleAdvanceWorkflow = (targetStatus: 'Supervisor Recommended' | 'HR Reviewed' | 'Approved' | 'Rejected') => {
    if (!selectedAppForReview) return;
    setReviewError(null);
    try {
      db.advanceLeaveWorkflow(selectedAppForReview.id, targetStatus, currentUser?.username || 'admin');
      setSelectedAppForReview(null);
      setDataVersion((v) => v + 1);
    } catch (err: any) {
      const msg = err?.message || 'Unable to advance leave workflow.';
      setReviewError(msg);
      notificationService.error('Leave Approval Blocked', msg, {
        module: 'Leave Management',
        actor: currentUser?.username,
      });
    }
  };

  const handleResumeDuty = () => {
    if (!selectedAppForReview) return;
    db.resumeLeave(selectedAppForReview.id, resumptionDate, currentUser?.username || 'admin');
    setShowResumeModal(false);
    setSelectedAppForReview(null);
    setDataVersion((v) => v + 1);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Reference No',
      'Staff ID',
      'Officer Name',
      'Department',
      'Leave Category',
      'Start Date',
      'End Date',
      'Days Requested',
      'Status',
      'Resumption Date',
      'Reason',
    ];

    const rows = filteredApplications.map((app) => {
      const emp = db.getEmployeeById(app.employeeId);
      const pers = db.getEmployeePersonalInfo(app.employeeId);
      const empInfo = db.getEmployeeEmploymentInfo(app.employeeId);
      const dept = departments.find((d) => d.id === empInfo?.currentDepartmentId);
      const type = leaveTypes.find((t) => t.id === app.leaveTypeId);

      return [
        `"${app.leaveReferenceNumber}"`,
        `"${emp?.staffId || ''}"`,
        `"${pers?.fullName || ''}"`,
        `"${dept?.departmentName || ''}"`,
        `"${type?.leaveName || ''}"`,
        `"${app.startDate}"`,
        `"${app.endDate}"`,
        app.daysRequested,
        `"${app.workflowStatus}"`,
        `"${app.resumptionDate || ''}"`,
        `"${app.reason.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Civil_Service_Leave_Register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notificationService.success(
      'Leave Register Exported',
      `Exported ${filteredApplications.length} leave application(s) to CSV.`,
      { module: 'Leave Management', actor: currentUser?.username }
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Employee Services</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-blue-700">Leave Management</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 flex items-center">
            <CalendarDays className="w-5 h-5 mr-2 text-blue-700" />
            Civil Service Leave & Vacation Administration
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Manage 10 statutory leave categories, track annual balance sheets, process multi-tier approvals, and log duty resumptions.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export Register</span>
          </button>

          {hasPermission('leave.apply') && (
            <button
              onClick={() => handleOpenApplyModal()}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Apply for Leave</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Applications</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.totalApps}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">All leave filings this cycle</div>
        </div>

        <div className="bg-amber-50/60 rounded-lg border border-amber-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-800 uppercase flex items-center justify-between">
            <span>Pending Approvals</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{metrics.pendingReviews}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">Supervisor & HR review queues</div>
        </div>

        <div className="bg-blue-50/60 rounded-lg border border-blue-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-blue-800 uppercase flex items-center justify-between">
            <span>Currently On Leave</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-1">{metrics.activeOnLeave}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">Approved active leaves</div>
        </div>

        <div className="bg-emerald-50/60 rounded-lg border border-emerald-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-800 uppercase flex items-center justify-between">
            <span>Resumed Duty</span>
            <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{metrics.resumed}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Completed & certified return</div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('applications')}
          className={`flex items-center space-x-2 py-2 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'applications'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Leave Applications & Approvals ({leaveApplications.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('balances')}
          className={`flex items-center space-x-2 py-2 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'balances'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Annual Leave Balance Sheets ({leaveBalances.length})</span>
        </button>
      </div>

      {/* TAB 1: APPLICATIONS & WORKFLOW */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by reference no (e.g. LV-2026-0001), officer name, staff ID, or reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center space-x-2 text-xs text-slate-500 shrink-0">
                <span>Showing:</span>
                <span className="font-bold text-slate-800">{filteredApplications.length}</span>
                <span>of {leaveApplications.length} applications</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Leave Category
                </label>
                <SearchableSelect
                  value={filterLeaveTypeId}
                  onChange={(val) => setFilterLeaveTypeId(val)}
                  options={[
                    { value: 'all', label: 'All Leave Types' },
                    ...leaveTypes.map((t) => ({
                      value: t.id.toString(),
                      label: `${t.leaveName} (${t.defaultDaysPerYear} days)`,
                      subLabel: t.isPaid ? 'Paid' : 'Unpaid',
                    })),
                  ]}
                  placeholder="All Leave Types"
                  searchPlaceholder="Filter leave types..."
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Workflow Status
                </label>
                <SearchableSelect
                  value={filterStatus}
                  onChange={(val) => setFilterStatus(val)}
                  options={[
                    { value: 'all', label: 'All Workflow Statuses' },
                    { value: 'Submitted', label: 'Submitted (Awaiting Supervisor)' },
                    { value: 'Supervisor Recommended', label: 'Supervisor Recommended' },
                    { value: 'HR Reviewed', label: 'HR Reviewed' },
                    { value: 'Approved', label: 'Approved (On Leave)' },
                    { value: 'Resumed', label: 'Resumed Duty' },
                    { value: 'Rejected', label: 'Rejected' },
                  ]}
                  placeholder="All Statuses"
                  searchPlaceholder="Filter statuses..."
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Department
                </label>
                <SearchableSelect
                  value={filterDeptId}
                  onChange={(val) => setFilterDeptId(val)}
                  options={[
                    { value: 'all', label: 'All Departments' },
                    ...departments.map((d) => ({
                      value: d.id.toString(),
                      label: `${d.departmentCode} - ${d.departmentName}`,
                    })),
                  ]}
                  placeholder="All Departments"
                  searchPlaceholder="Filter departments..."
                />
              </div>
            </div>
          </div>

          {/* Applications Table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
                    <th className="p-3">Reference No</th>
                    <th className="p-3">Officer Name</th>
                    <th className="p-3">Leave Category</th>
                    <th className="p-3">Leave Period</th>
                    <th className="p-3 text-center">Days</th>
                    <th className="p-3">Relief Officer</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredApplications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-medium text-slate-600">No leave applications found matching criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredApplications.map((app) => {
                      const emp = db.getEmployeeById(app.employeeId);
                      const pers = db.getEmployeePersonalInfo(app.employeeId);
                      const empInfo = db.getEmployeeEmploymentInfo(app.employeeId);
                      const dept = departments.find((d) => d.id === empInfo?.currentDepartmentId);
                      const type = leaveTypes.find((t) => t.id === app.leaveTypeId);
                      const reliefOfficer = app.handoverOfficerEmployeeId
                        ? db.getEmployeePersonalInfo(app.handoverOfficerEmployeeId)
                        : null;

                      return (
                        <tr key={app.id} className="hover:bg-blue-50/20 transition-colors">
                          <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                            {app.leaveReferenceNumber}
                          </td>

                          <td className="p-3">
                            <div className="font-semibold text-slate-900">
                              {pers?.fullName || `${pers?.firstName} ${pers?.surname}`}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Staff ID: {emp?.staffId} • {dept?.departmentCode}
                            </div>
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <span className="font-semibold text-slate-800">{type?.leaveName}</span>
                            <div className="text-[10px] text-slate-500">
                              {type?.isPaid ? 'With Full Pay' : 'Without Pay'}
                            </div>
                          </td>

                          <td className="p-3 whitespace-nowrap font-mono text-slate-700">
                            {app.startDate} to {app.endDate}
                          </td>

                          <td className="p-3 text-center font-bold text-slate-900 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                              {app.daysRequested} Days
                            </span>
                          </td>

                          <td className="p-3 text-slate-600 text-[11px]">
                            {reliefOfficer?.fullName || 'None specified'}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                app.workflowStatus === 'Approved'
                                  ? 'bg-blue-100 text-blue-800'
                                  : app.workflowStatus === 'Resumed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : app.workflowStatus === 'Supervisor Recommended' || app.workflowStatus === 'HR Reviewed'
                                  ? 'bg-amber-100 text-amber-800'
                                  : app.workflowStatus === 'Submitted'
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                  app.workflowStatus === 'Approved'
                                    ? 'bg-blue-500'
                                    : app.workflowStatus === 'Resumed'
                                    ? 'bg-emerald-500'
                                    : app.workflowStatus === 'Supervisor Recommended' || app.workflowStatus === 'HR Reviewed'
                                    ? 'bg-amber-500'
                                    : app.workflowStatus === 'Submitted'
                                    ? 'bg-slate-400'
                                    : 'bg-red-500'
                                }`}
                              ></span>
                              {app.workflowStatus}
                            </span>
                          </td>

                          <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                            <button
                              onClick={() => setSelectedAppForReview(app)}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-700 hover:text-white text-slate-700 font-semibold transition-colors inline-flex items-center space-x-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Review</span>
                            </button>

                            {(app.workflowStatus === 'Submitted' || app.workflowStatus === 'Rejected') &&
                              (hasPermission('leave.apply') || hasPermission('leave.review')) && (
                                <>
                                  <button
                                    onClick={() => handleOpenEditLeaveModal(app)}
                                    className="p-1.5 rounded bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors"
                                    title="Edit leave application"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 inline" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingLeaveApp(app)}
                                    className="p-1.5 rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors"
                                    title="Withdraw / Delete leave application"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 inline" />
                                  </button>
                                </>
                              )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ANNUAL LEAVE BALANCES */}
      {activeTab === 'balances' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center">
                <Calendar className="w-4 h-4 mr-1.5 text-blue-700" />
                Civil Service Annual Statutory Leave Balance Sheet
              </h2>
              <p className="text-xs text-slate-500">
                Calculates statutory annual entitlement (36 days), brought forward days, days utilized, and available quotas.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-2.5">Staff ID</th>
                  <th className="p-2.5">Officer Name</th>
                  <th className="p-2.5">Leave Category</th>
                  <th className="p-2.5 text-center">Annual Entitlement</th>
                  <th className="p-2.5 text-center">Brought Forward</th>
                  <th className="p-2.5 text-center">Days Taken</th>
                  <th className="p-2.5 text-center">Available Balance</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveBalances.map((bal) => {
                  const emp = db.getEmployeeById(bal.employeeId);
                  const pers = db.getEmployeePersonalInfo(bal.employeeId);
                  const type = leaveTypes.find((t) => t.id === bal.leaveTypeId);

                  return (
                    <tr key={bal.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {emp?.staffId}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-900">
                        {pers?.fullName || `${pers?.firstName} ${pers?.surname}`}
                      </td>
                      <td className="p-2.5 text-slate-700">{type?.leaveName}</td>
                      <td className="p-2.5 text-center font-bold text-slate-800">
                        {bal.annualEntitlementDays} Days
                      </td>
                      <td className="p-2.5 text-center text-slate-600">
                        +{bal.broughtForwardDays} Days
                      </td>
                      <td className="p-2.5 text-center text-amber-800 font-bold">
                        {bal.daysTaken} Days
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {bal.availableDays} Days
                        </span>
                      </td>
                      <td className="p-2.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenApplyModal(bal.employeeId)}
                          className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-700 hover:text-white font-semibold transition-colors"
                        >
                          File Leave
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* APPLY / EDIT LEAVE SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={showApplyModal}
        onClose={() => {
          setShowApplyModal(false);
          setEditingLeaveApp(null);
        }}
        title={
          editingLeaveApp
            ? `Edit Leave Application (${editingLeaveApp.leaveReferenceNumber})`
            : 'File Official Civil Service Leave Application'
        }
        subtitle="Employee Services • Statutory Leave & Vacation Filing"
        icon={<CalendarDays className="w-4 h-4" />}
        maxWidthClass="max-w-xl"
        overlayClassName="bg-black/40"
      >
        <form onSubmit={handleSaveApplication} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Civil Service Officer <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={applyEmpId}
                onChange={(val) => setApplyEmpId(parseInt(val, 10))}
                options={employees.map((emp) => {
                  const pers = db.getEmployeePersonalInfo(emp.id);
                  return {
                    value: emp.id.toString(),
                    label: `${emp.staffId} - ${pers?.fullName || `${pers?.firstName} ${pers?.surname}`}`,
                  };
                })}
                placeholder="Select officer..."
                searchPlaceholder="Filter officers by name or ID..."
                buttonClassName="h-9 px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-800 font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Leave Category <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={applyTypeId}
                  onChange={(val) => setApplyTypeId(parseInt(val, 10))}
                  options={leaveTypes.map((t) => ({
                    value: t.id.toString(),
                    label: `${t.leaveName} (Statutory: ${t.defaultDaysPerYear} days)`,
                    subLabel: t.isPaid ? 'With Full Pay' : 'Without Pay',
                  }))}
                  placeholder="Select category..."
                  searchPlaceholder="Filter leave categories..."
                  buttonClassName="h-9 px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                />
              </div>

              {/* Available quota display */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Available Entitlement Quota
                </label>
                <div className="h-9 px-3 bg-emerald-50 rounded border border-emerald-200 text-emerald-800 font-bold flex items-center justify-between">
                  <span>Available Balance:</span>
                  <span className="text-sm font-black">{activeEmpBalance?.availableDays ?? 36} Days</span>
                </div>
              </div>
            </div>

            {/* Dates & Requested days */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={applyStartDate}
                  onChange={(e) => setApplyStartDate(e.target.value)}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={applyEndDate}
                  onChange={(e) => setApplyEndDate(e.target.value)}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Days Requested <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={activeEmpBalance?.availableDays || 90}
                  value={applyDays}
                  onChange={(e) => setApplyDays(parseInt(e.target.value) || 1)}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Handover Relief Officer */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Designate Relief / Handover Officer
              </label>
              <SearchableSelect
                value={applyHandoverEmpId}
                onChange={(val) => setApplyHandoverEmpId(val)}
                options={[
                  { value: '', label: '-- No Relief Officer Specified --' },
                  ...employees
                    .filter((e) => e.id !== applyEmpId)
                    .map((emp) => {
                      const pers = db.getEmployeePersonalInfo(emp.id);
                      return {
                        value: emp.id.toString(),
                        label: `${emp.staffId} - ${pers?.fullName || `${pers?.firstName} ${pers?.surname}`}`,
                      };
                    }),
                ]}
                placeholder="Select relief officer..."
                searchPlaceholder="Filter relief officers..."
                buttonClassName="h-9 px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
              />
            </div>

            {/* Reason & Emergency contacts */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Reason for Leave <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={applyReason}
                onChange={(e) => setApplyReason(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Contact Address While Away
                </label>
                <input
                  type="text"
                  value={applyAddress}
                  onChange={(e) => setApplyAddress(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Emergency Phone While Away
                </label>
                <input
                  type="text"
                  value={applyPhone}
                  onChange={(e) => setApplyPhone(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowApplyModal(false);
                setEditingLeaveApp(null);
              }}
              className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{editingLeaveApp ? 'Save Application Changes' : 'Submit Leave Application'}</span>
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* REVIEW & APPROVAL SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(selectedAppForReview)}
        onClose={() => {
          if (!showResumeModal) setSelectedAppForReview(null);
        }}
        title="Leave Application Review & Action"
        subtitle={
          activeReviewApp
            ? `${activeReviewApp.leaveReferenceNumber} • ${activeReviewApp.workflowStatus}`
            : undefined
        }
        icon={<CalendarDays className="w-4 h-4" />}
        maxWidthClass="max-w-lg"
        overlayClassName="bg-black/40"
      >
        {activeReviewApp && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  {activeReviewApp.leaveReferenceNumber}
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeReviewApp.workflowStatus === 'Approved'
                      ? 'bg-blue-100 text-blue-800'
                      : activeReviewApp.workflowStatus === 'Resumed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : activeReviewApp.workflowStatus === 'Supervisor Recommended' ||
                        activeReviewApp.workflowStatus === 'HR Reviewed'
                      ? 'bg-amber-100 text-amber-800'
                      : activeReviewApp.workflowStatus === 'Submitted'
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {activeReviewApp.workflowStatus}
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div>
                  Officer: <strong>{db.getEmployeePersonalInfo(activeReviewApp.employeeId)?.fullName}</strong>
                </div>
                <div>
                  Category:{' '}
                  <strong>{leaveTypes.find((t) => t.id === activeReviewApp.leaveTypeId)?.leaveName}</strong>
                </div>
                <div>
                  Period:{' '}
                  <strong>
                    {activeReviewApp.startDate} to {activeReviewApp.endDate}
                  </strong>{' '}
                  ({activeReviewApp.daysRequested} Days)
                </div>
                <div>
                  Reason: <em>"{activeReviewApp.reason}"</em>
                </div>
              </div>

              {/* Stepper */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-center text-[10px] gap-1">
                {['Submitted', 'Supervisor Recommended', 'HR Reviewed', 'Approved', 'Resumed'].map((stage, idx) => {
                  const stages = ['Submitted', 'Supervisor Recommended', 'HR Reviewed', 'Approved', 'Resumed'];
                  const currIdx = stages.indexOf(activeReviewApp.workflowStatus);
                  const isPassed = currIdx >= idx;

                  return (
                    <div key={stage} className="flex-1 min-w-0">
                      <div
                        className={`w-5 h-5 mx-auto rounded-full flex items-center justify-center font-bold text-[9px] ${
                          isPassed ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isPassed ? '✓' : idx + 1}
                      </div>
                      <div className="mt-1 font-semibold text-slate-700 truncate" title={stage}>
                        {stage}
                      </div>
                    </div>
                  );
                })}
              </div>

              {reviewError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold">
                  {reviewError}
                </div>
              )}
            </div>

            {/* Pinned Actions Button Bar */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedAppForReview(null)}
                className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
              >
                Close
              </button>

              <div className="flex flex-wrap justify-end gap-2">
                {(activeReviewApp.workflowStatus === 'Submitted' ||
                  activeReviewApp.workflowStatus === 'Supervisor Recommended' ||
                  activeReviewApp.workflowStatus === 'HR Reviewed') &&
                  (hasPermission('leave.review') || hasPermission('leave.approve')) && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceWorkflow('Rejected')}
                      className="px-3.5 py-2 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 font-semibold transition-colors"
                    >
                      Reject
                    </button>
                  )}

                {activeReviewApp.workflowStatus === 'Submitted' && hasPermission('leave.review') && (
                  <button
                    type="button"
                    onClick={() => handleAdvanceWorkflow('Supervisor Recommended')}
                    className="px-3.5 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs transition-colors"
                  >
                    Recommend Application
                  </button>
                )}

                {activeReviewApp.workflowStatus === 'Supervisor Recommended' && hasPermission('leave.review') && (
                  <button
                    type="button"
                    onClick={() => handleAdvanceWorkflow('HR Reviewed')}
                    className="px-3.5 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs transition-colors"
                  >
                    Endorse (HR Review)
                  </button>
                )}

                {activeReviewApp.workflowStatus === 'HR Reviewed' && hasPermission('leave.approve') && (
                  <button
                    type="button"
                    onClick={() => handleAdvanceWorkflow('Approved')}
                    className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors"
                  >
                    Grant Final Approval
                  </button>
                )}

                {activeReviewApp.workflowStatus === 'Approved' && hasPermission('leave.approve') && (
                  <button
                    type="button"
                    onClick={() => setShowResumeModal(true)}
                    className="px-3.5 py-2 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center space-x-1.5 shadow-xs transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Log Resumption of Duty</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* RESUME DUTY SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(showResumeModal && selectedAppForReview)}
        onClose={() => setShowResumeModal(false)}
        title="Certify Resumption of Duty"
        subtitle={activeReviewApp ? activeReviewApp.leaveReferenceNumber : undefined}
        icon={<RotateCcw className="w-4 h-4" />}
        maxWidthClass="max-w-sm"
        overlayClassName="bg-black/40"
        zIndexClass="z-60"
      >
        <div className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <p className="text-slate-600 leading-relaxed">
              Confirm that the officer has officially resumed duty at their department.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Actual Resumption Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={resumptionDate}
                onChange={(e) => setResumptionDate(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowResumeModal(false)}
              className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleResumeDuty}
              className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors"
            >
              Confirm Resumption
            </button>
          </div>
        </div>
      </SlideOverPanel>

      {/* WITHDRAW / DELETE LEAVE APPLICATION CONFIRMATION DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(deletingLeaveApp)}
        onClose={() => setDeletingLeaveApp(null)}
        title="Withdraw & Delete Leave Application"
        subtitle={deletingLeaveApp?.leaveReferenceNumber}
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingLeaveApp && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1.5">
                <div className="font-bold">
                  Withdraw application {deletingLeaveApp.leaveReferenceNumber} for{' '}
                  {db.getEmployeePersonalInfo(deletingLeaveApp.employeeId)?.fullName}?
                </div>
                <p className="leading-relaxed">
                  Only unapproved applications (Submitted or Rejected) can be withdrawn and deleted so statutory leave balances remain protected.
                </p>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingLeaveApp(null)}
                className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteLeave}
                className="px-4 py-2 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold shadow-xs"
              >
                Withdraw Application
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>
    </div>
  );
};
