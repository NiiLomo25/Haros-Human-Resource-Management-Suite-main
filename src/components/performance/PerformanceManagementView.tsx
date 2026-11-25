/**
 * Haros HRMIS - Performance Management View
 * Implements Annual Performance Planning, KPI Target Setting, Self-Assessments,
 * Supervisor Ratings, Performance Improvement Plans (PIP), and Nominal Roll Integration.
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  TrendingUp,
  Plus,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Users,
  Award,
  Building2,
  ChevronRight,
  FileCheck,
  Star,
  Send,
  Eye,
  Check,
  AlertTriangle,
  Target,
  Edit2,
  Trash2,
} from 'lucide-react';
import { db } from '../../db/storage';
import { notificationService } from '../../services/notifications/notificationService';
import { useAuth } from '../../context/AuthContext';
import {
  PerformanceAppraisal,
  Employee,
  Department,
} from '../../types';
import { SlideOverPanel } from '../common/SlideOverPanel';
import { SearchableSelect } from '../common/SearchableSelect';

interface PerformanceManagementViewProps {
  onSelectEmployee?: (empId: number) => void;
}

export const PerformanceManagementView: React.FC<PerformanceManagementViewProps> = ({
  onSelectEmployee,
}) => {
  const { currentUser, hasPermission } = useAuth();
  const [dataVersion, setDataVersion] = useState(0);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRating, setFilterRating] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDeptId, setFilterDeptId] = useState<string>('all');

  // Modals state
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [selectedAppraisalForReview, setSelectedAppraisalForReview] = useState<PerformanceAppraisal | null>(null);
  const lastReviewAppraisalRef = useRef<PerformanceAppraisal | null>(null);
  if (selectedAppraisalForReview) lastReviewAppraisalRef.current = selectedAppraisalForReview;
  const activeReviewAppraisal = selectedAppraisalForReview || lastReviewAppraisalRef.current;

  const [editingAppraisal, setEditingAppraisal] = useState<PerformanceAppraisal | null>(null);
  const [editCycle, setEditCycle] = useState('');
  const [editSupervisorId, setEditSupervisorId] = useState<number>(1);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editKpis, setEditKpis] = useState('');
  const [editStatus, setEditStatus] = useState<PerformanceAppraisal['status']>('Draft Self-Appraisal');
  const [deletingAppraisal, setDeletingAppraisal] = useState<PerformanceAppraisal | null>(null);

  // Fetch data
  const appraisals = useMemo(() => db.getPerformanceAppraisals(), [dataVersion]);
  const employees = useMemo(() => db.getEmployees(), [dataVersion]);
  const departments = useMemo(() => db.getDepartments(), [dataVersion]);

  // Combined List
  const appraisalList = useMemo(() => {
    return appraisals.map((appr) => {
      const emp = db.getEmployeeById(appr.employeeId);
      const pers = db.getEmployeePersonalInfo(appr.employeeId);
      const empInfo = db.getEmployeeEmploymentInfo(appr.employeeId);
      const supervisorPers = db.getEmployeePersonalInfo(appr.supervisorEmployeeId);
      const dept = departments.find((d) => d.id === empInfo?.currentDepartmentId);

      return {
        appraisal: appr,
        emp,
        pers,
        empInfo,
        supervisorPers,
        dept,
      };
    });
  }, [appraisals, departments]);

  // Filtered List
  const filteredAppraisals = useMemo(() => {
    return appraisalList.filter((item) => {
      const q = searchTerm.toLowerCase().trim();
      if (q) {
        const matchStaff = item.emp?.staffId.toLowerCase().includes(q) || false;
        const matchName = item.pers?.fullName?.toLowerCase().includes(q) || false;
        const matchKpi = item.appraisal.kpiTargetsSummary.toLowerCase().includes(q);
        if (!matchStaff && !matchName && !matchKpi) return false;
      }

      if (filterRating !== 'all' && item.appraisal.finalRating !== filterRating) return false;
      if (filterStatus !== 'all' && item.appraisal.status !== filterStatus) return false;
      if (filterDeptId !== 'all' && item.empInfo?.currentDepartmentId.toString() !== filterDeptId) return false;

      return true;
    });
  }, [appraisalList, searchTerm, filterRating, filterStatus, filterDeptId]);

  // Metrics
  const metrics = useMemo(() => {
    const total = appraisals.length;
    const completed = appraisals.filter((a) => a.status === 'Completed').length;
    const pendingSupervisor = appraisals.filter((a) => a.status === 'Supervisor Review').length;
    const outstanding = appraisals.filter((a) => a.finalRating === 'Outstanding').length;
    const needsImprovement = appraisals.filter((a) => a.finalRating === 'Needs Improvement' || a.finalRating === 'Unsatisfactory').length;
    return { total, completed, pendingSupervisor, outstanding, needsImprovement };
  }, [appraisals]);

  // Form State for Initiating Appraisal
  const [initEmpId, setInitEmpId] = useState<number>(employees[0]?.id || 1);
  const [initSupervisorId, setInitSupervisorId] = useState<number>(employees[1]?.id || 2);
  const [initCycle, setInitCycle] = useState('2025/2026 Annual Staff Appraisal');
  const [initStartDate, setInitStartDate] = useState('2025-01-01');
  const [initEndDate, setInitEndDate] = useState('2025-12-31');
  const [initKpis, setInitKpis] = useState('');

  const handleOpenInitiateModal = () => {
    setInitEmpId(employees[0]?.id || 1);
    setInitSupervisorId(employees[1]?.id || 2);
    setInitCycle('2025/2026 Annual Staff Appraisal');
    setInitKpis('Delivery of key departmental objectives, staff attendance records, and project milestones.');
    setShowInitiateModal(true);
  };

  const handleSaveInitiate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!initKpis.trim()) return;

    db.createPerformanceAppraisal(
      {
        appraisalCycle: initCycle,
        employeeId: initEmpId,
        supervisorEmployeeId: initSupervisorId,
        appraisalPeriodStart: initStartDate,
        appraisalPeriodEnd: initEndDate,
        kpiTargetsSummary: initKpis.trim(),
        selfAssessmentScore: 4.0,
        supervisorScore: 4.0,
        finalRating: 'Meets Expectations',
        overallScorePercentage: 80,
        strengthsAndAchievements: 'Consistently fulfills assigned operational duties.',
        areasForImprovement: 'Improve reporting deadlines.',
        status: 'Draft Self-Appraisal',
      },
      currentUser?.username || 'admin'
    );

    setShowInitiateModal(false);
    setDataVersion((v) => v + 1);
  };

  // Review Form State
  const [revSelfScore, setRevSelfScore] = useState<number>(4.5);
  const [revSupervisorScore, setRevSupervisorScore] = useState<number>(4.6);
  const [revRating, setRevRating] = useState<PerformanceAppraisal['finalRating']>('Exceeds Expectations');
  const [revStrengths, setRevStrengths] = useState('');
  const [revImprovements, setRevImprovements] = useState('');
  const [revStatus, setRevStatus] = useState<PerformanceAppraisal['status']>('Completed');

  const handleOpenReviewModal = (appr: PerformanceAppraisal) => {
    setSelectedAppraisalForReview(appr);
    setRevSelfScore(appr.selfAssessmentScore);
    setRevSupervisorScore(appr.supervisorScore);
    setRevRating(appr.finalRating);
    setRevStrengths(appr.strengthsAndAchievements);
    setRevImprovements(appr.areasForImprovement);
    setRevStatus('Completed');
  };

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppraisalForReview) return;

    const overallPct = Math.round((revSupervisorScore / 5) * 100);

    db.updatePerformanceAppraisal(
      selectedAppraisalForReview.id,
      {
        selfAssessmentScore: revSelfScore,
        supervisorScore: revSupervisorScore,
        finalRating: revRating,
        overallScorePercentage: overallPct,
        strengthsAndAchievements: revStrengths.trim(),
        areasForImprovement: revImprovements.trim(),
        status: revStatus,
        completedDate: revStatus === 'Completed' ? new Date().toISOString().slice(0, 10) : undefined,
      },
      currentUser?.username || 'admin'
    );

    setSelectedAppraisalForReview(null);
    setDataVersion((v) => v + 1);
  };

  const handleOpenEditPlan = (appr: PerformanceAppraisal) => {
    setEditingAppraisal(appr);
    setEditCycle(appr.appraisalCycle);
    setEditSupervisorId(appr.supervisorEmployeeId);
    setEditStartDate(appr.appraisalPeriodStart);
    setEditEndDate(appr.appraisalPeriodEnd);
    setEditKpis(appr.kpiTargetsSummary);
    setEditStatus(appr.status);
  };

  const handleSaveEditPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAppraisal || !editKpis.trim()) return;
    db.updatePerformanceAppraisal(
      editingAppraisal.id,
      {
        appraisalCycle: editCycle.trim(),
        supervisorEmployeeId: editSupervisorId,
        appraisalPeriodStart: editStartDate,
        appraisalPeriodEnd: editEndDate,
        kpiTargetsSummary: editKpis.trim(),
        status: editStatus,
        completedDate: editStatus === 'Completed' ? new Date().toISOString().slice(0, 10) : undefined,
      },
      currentUser?.username || 'admin'
    );
    setEditingAppraisal(null);
    setDataVersion((v) => v + 1);
  };

  const handleConfirmDeleteAppraisal = () => {
    if (!deletingAppraisal) return;
    const res = db.deletePerformanceAppraisal(deletingAppraisal.id, currentUser?.username || 'admin');
    if (!res.success) {
      notificationService.error('Delete Appraisal Blocked', res.message, {
        module: 'Performance Appraisals',
        actor: currentUser?.username,
      });
    }
    setDeletingAppraisal(null);
    setDataVersion((v) => v + 1);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Appraisal Cycle',
      'Staff ID',
      'Officer Name',
      'Department',
      'Supervisor Name',
      'Overall Score (%)',
      'Final Rating',
      'Status',
    ];

    const rows = filteredAppraisals.map((item) => [
      `"${item.appraisal.appraisalCycle}"`,
      `"${item.emp?.staffId || ''}"`,
      `"${item.pers?.fullName || ''}"`,
      `"${item.dept?.departmentName || ''}"`,
      `"${item.supervisorPers?.fullName || ''}"`,
      `${item.appraisal.overallScorePercentage}%`,
      `"${item.appraisal.finalRating}"`,
      `"${item.appraisal.status}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Performance_Appraisals_Register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Employee Services</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-blue-700">Performance Management</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-700" />
            Civil Service Annual Performance Planning & Appraisals
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Set annual KPI targets, coordinate supervisor evaluations, establish performance rating scales, and manage PIPs.
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

          {hasPermission('performance.evaluate') && (
            <button
              onClick={handleOpenInitiateModal}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Initiate Appraisal</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Appraisals</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Active review cycles</div>
        </div>

        <div className="bg-emerald-50/60 rounded-lg border border-emerald-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-800 uppercase flex items-center justify-between">
            <span>Outstanding Ratings</span>
            <Star className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{metrics.outstanding}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Exemplary service delivery</div>
        </div>

        <div className="bg-amber-50/60 rounded-lg border border-amber-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-800 uppercase flex items-center justify-between">
            <span>Supervisor Review</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{metrics.pendingSupervisor}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">Awaiting director assessment</div>
        </div>

        <div className="bg-blue-50/60 rounded-lg border border-blue-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-blue-800 uppercase flex items-center justify-between">
            <span>Finalized & Closed</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-1">{metrics.completed}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">Archived into staff dossiers</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search appraisals by staff ID, officer name, or KPI target keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-500 shrink-0">
            <span>Showing:</span>
            <span className="font-bold text-slate-800">{filteredAppraisals.length}</span>
            <span>of {appraisals.length} reviews</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Performance Rating
            </label>
            <SearchableSelect
              value={filterRating}
              onChange={setFilterRating}
              options={[
                { value: 'all', label: 'All Ratings' },
                { value: 'Outstanding', label: 'Outstanding (95-100%)' },
                { value: 'Exceeds Expectations', label: 'Exceeds Expectations (85-94%)' },
                { value: 'Meets Expectations', label: 'Meets Expectations (75-84%)' },
                { value: 'Needs Improvement', label: 'Needs Improvement (60-74%)' },
                { value: 'Unsatisfactory', label: 'Unsatisfactory (<60%)' },
              ]}
              placeholder="All Ratings"
              searchPlaceholder="Filter ratings..."
              buttonClassName="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700 focus:bg-white h-8"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Review Status
            </label>
            <SearchableSelect
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'Draft Self-Appraisal', label: 'Draft Self-Appraisal' },
                { value: 'Supervisor Review', label: 'Supervisor Review' },
                { value: 'HR Finalized', label: 'HR Finalized' },
                { value: 'Completed', label: 'Completed & Archived' },
              ]}
              placeholder="All Statuses"
              searchPlaceholder="Filter statuses..."
              buttonClassName="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700 focus:bg-white h-8"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Department
            </label>
            <SearchableSelect
              value={filterDeptId}
              onChange={setFilterDeptId}
              options={[
                { value: 'all', label: 'All Departments' },
                ...departments.map((d) => ({
                  value: d.id.toString(),
                  label: `${d.departmentCode} - ${d.departmentName}`,
                })),
              ]}
              placeholder="All Departments"
              searchPlaceholder="Filter departments..."
              buttonClassName="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700 focus:bg-white h-8"
            />
          </div>
        </div>
      </div>

      {/* Appraisals Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
                <th className="p-3">Staff ID</th>
                <th className="p-3">Officer Name</th>
                <th className="p-3">Department</th>
                <th className="p-3">Appraisal Cycle</th>
                <th className="p-3 text-center">Score</th>
                <th className="p-3">Civil Service Rating</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAppraisals.map((item) => {
                const appr = item.appraisal;

                return (
                  <tr key={appr.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                      {item.emp?.staffId}
                    </td>

                    <td className="p-3">
                      <div className="font-semibold text-slate-900">
                        {item.pers?.fullName || `${item.pers?.firstName} ${item.pers?.surname}`}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Supervisor: {item.supervisorPers?.fullName || 'Director'}
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="text-slate-800 font-medium">{item.dept?.departmentName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{item.dept?.departmentCode}</div>
                    </td>

                    <td className="p-3 text-slate-700">
                      <div className="font-semibold">{appr.appraisalCycle}</div>
                      <div className="text-[10px] text-slate-500">
                        Period: {appr.appraisalPeriodStart} to {appr.appraisalPeriodEnd}
                      </div>
                    </td>

                    <td className="p-3 text-center whitespace-nowrap font-black text-slate-900">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {appr.overallScorePercentage}%
                      </span>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          appr.finalRating === 'Outstanding'
                            ? 'bg-emerald-100 text-emerald-800'
                            : appr.finalRating === 'Exceeds Expectations'
                            ? 'bg-blue-100 text-blue-800'
                            : appr.finalRating === 'Meets Expectations'
                            ? 'bg-slate-100 text-slate-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {appr.finalRating}
                      </span>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          appr.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {appr.status}
                      </span>
                    </td>

                    <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                      {hasPermission('performance.evaluate') && (
                        <>
                          <button
                            onClick={() => handleOpenReviewModal(appr)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-700 hover:text-white text-slate-700 font-semibold transition-colors"
                          >
                            Review / Score
                          </button>

                          {appr.status !== 'Completed' && (
                            <>
                              <button
                                onClick={() => handleOpenEditPlan(appr)}
                                className="p-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors"
                                title="Edit appraisal plan & KPIs"
                              >
                                <Edit2 className="w-3.5 h-3.5 inline" />
                              </button>
                              <button
                                onClick={() => setDeletingAppraisal(appr)}
                                className="p-1 rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors"
                                title="Delete draft/in-progress appraisal"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
                            </>
                          )}
                        </>
                      )}

                      {onSelectEmployee && item.emp && (
                        <button
                          onClick={() => onSelectEmployee(item.emp!.id)}
                          className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-700 hover:text-white font-semibold transition-colors"
                        >
                          Dossier
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* INITIATE APPRAISAL DRAWER */}
      <SlideOverPanel
        isOpen={showInitiateModal}
        onClose={() => setShowInitiateModal(false)}
        title="Initiate Annual Staff Appraisal"
        subtitle="SPAS Cycle & Agreed KPI Target Setting"
        icon={<Target className="w-4 h-4" />}
        maxWidthClass="max-w-lg"
        overlayClassName="bg-black/40"
      >
        <form onSubmit={handleSaveInitiate} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Civil Service Officer <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={initEmpId.toString()}
                onChange={(val) => setInitEmpId(parseInt(val, 10))}
                options={employees.map((emp) => {
                  const pers = db.getEmployeePersonalInfo(emp.id);
                  const name = pers?.fullName || `${pers?.firstName ?? ''} ${pers?.surname ?? ''}`.trim() || 'Officer';
                  return { value: emp.id.toString(), label: `${emp.staffId} - ${name}` };
                })}
                placeholder="Select officer..."
                searchPlaceholder="Search officer by Staff ID or name..."
                buttonClassName="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 font-semibold h-10"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Designated Evaluating Supervisor <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={initSupervisorId.toString()}
                onChange={(val) => setInitSupervisorId(parseInt(val, 10))}
                options={employees.map((emp) => {
                  const pers = db.getEmployeePersonalInfo(emp.id);
                  const name = pers?.fullName || `${pers?.firstName ?? ''} ${pers?.surname ?? ''}`.trim() || 'Officer';
                  return { value: emp.id.toString(), label: `${emp.staffId} - ${name}` };
                })}
                placeholder="Select supervisor..."
                searchPlaceholder="Search supervisor by Staff ID or name..."
                buttonClassName="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 h-10"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Appraisal Cycle Title
              </label>
              <input
                type="text"
                value={initCycle}
                onChange={(e) => setInitCycle(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Period Start</label>
                <input
                  type="date"
                  value={initStartDate}
                  onChange={(e) => setInitStartDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Period End</label>
                <input
                  type="date"
                  value={initEndDate}
                  onChange={(e) => setInitEndDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Agreed Key Performance Indicator (KPI) Targets <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                value={initKpis}
                onChange={(e) => setInitKpis(e.target.value)}
                required
                placeholder="Summarize key targets, project milestones, and deliverables..."
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
              />
            </div>
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowInitiateModal(false)}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs"
            >
              Initiate Cycle
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* REVIEW & SCORE APPRAISAL DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(selectedAppraisalForReview)}
        onClose={() => setSelectedAppraisalForReview(null)}
        title="Conduct Performance Appraisal Assessment"
        subtitle={activeReviewAppraisal?.appraisalCycle || 'Annual SPAS Review'}
        icon={<FileCheck className="w-4 h-4" />}
        maxWidthClass="max-w-xl"
        overlayClassName="bg-black/40"
      >
        {activeReviewAppraisal && (
          <form onSubmit={handleSaveReview} className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                <div>
                  Officer: <strong>{db.getEmployeePersonalInfo(activeReviewAppraisal.employeeId)?.fullName}</strong>
                </div>
                <div>
                  Agreed KPIs: <em>"{activeReviewAppraisal.kpiTargetsSummary}"</em>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Self-Assessment Score (1.0 to 5.0)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    value={revSelfScore}
                    onChange={(e) => setRevSelfScore(parseFloat(e.target.value) || 1.0)}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Supervisor Score (1.0 to 5.0)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    value={revSupervisorScore}
                    onChange={(e) => setRevSupervisorScore(parseFloat(e.target.value) || 1.0)}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold text-blue-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Final Evaluated Civil Service Rating
                </label>
                <SearchableSelect
                  value={revRating}
                  onChange={(val) => setRevRating(val as PerformanceAppraisal['finalRating'])}
                  options={[
                    { value: 'Outstanding', label: 'Outstanding (95 - 100%)' },
                    { value: 'Exceeds Expectations', label: 'Exceeds Expectations (85 - 94%)' },
                    { value: 'Meets Expectations', label: 'Meets Expectations (75 - 84%)' },
                    { value: 'Needs Improvement', label: 'Needs Improvement (60 - 74%)' },
                    { value: 'Unsatisfactory', label: 'Unsatisfactory (<60%)' },
                  ]}
                  placeholder="Select rating..."
                  searchPlaceholder="Filter ratings..."
                  buttonClassName="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 font-bold h-10"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Major Strengths &amp; Commendable Achievements
                </label>
                <textarea
                  rows={3}
                  value={revStrengths}
                  onChange={(e) => setRevStrengths(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Areas for Capacity Building &amp; Improvement (PIP if applicable)
                </label>
                <textarea
                  rows={3}
                  value={revImprovements}
                  onChange={(e) => setRevImprovements(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedAppraisalForReview(null)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs"
              >
                Complete &amp; Archive Appraisal
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* EDIT APPRAISAL PLAN & KPI TARGETS DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(editingAppraisal)}
        onClose={() => setEditingAppraisal(null)}
        title="Edit Performance Appraisal Plan"
        subtitle={editingAppraisal?.appraisalCycle}
        icon={<Edit2 className="w-4 h-4" />}
        maxWidthClass="max-w-lg"
        overlayClassName="bg-black/40"
      >
        {editingAppraisal && (
          <form onSubmit={handleSaveEditPlan} className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                Officer: <strong>{db.getEmployeePersonalInfo(editingAppraisal.employeeId)?.fullName}</strong>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Evaluating Supervisor <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={editSupervisorId.toString()}
                  onChange={(val) => setEditSupervisorId(parseInt(val, 10))}
                  options={employees.map((emp) => {
                    const pers = db.getEmployeePersonalInfo(emp.id);
                    const name = pers?.fullName || `${pers?.firstName ?? ''} ${pers?.surname ?? ''}`.trim() || 'Officer';
                    return { value: emp.id.toString(), label: `${emp.staffId} - ${name}` };
                  })}
                  placeholder="Select supervisor..."
                  searchPlaceholder="Search supervisor by Staff ID or name..."
                  buttonClassName="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 h-10"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Appraisal Cycle Title</label>
                <input
                  type="text"
                  value={editCycle}
                  onChange={(e) => setEditCycle(e.target.value)}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Period Start</label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Period End</label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Workflow Stage</label>
                <SearchableSelect
                  value={editStatus}
                  onChange={(val) => setEditStatus(val as PerformanceAppraisal['status'])}
                  options={[
                    { value: 'Draft Self-Appraisal', label: 'Draft Self-Appraisal' },
                    { value: 'Supervisor Review', label: 'Supervisor Review' },
                    { value: 'HR Finalized', label: 'HR Finalized' },
                  ]}
                  placeholder="Select stage..."
                  searchPlaceholder="Filter stages..."
                  buttonClassName="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 h-10"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Agreed KPI Targets <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={editKpis}
                  onChange={(e) => setEditKpis(e.target.value)}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingAppraisal(null)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs"
              >
                Save Plan Changes
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* DELETE APPRAISAL CONFIRMATION DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(deletingAppraisal)}
        onClose={() => setDeletingAppraisal(null)}
        title="Delete Performance Appraisal"
        subtitle={deletingAppraisal?.appraisalCycle}
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingAppraisal && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1.5">
                <div className="font-bold">
                  Delete "{deletingAppraisal.appraisalCycle}" for{' '}
                  {db.getEmployeePersonalInfo(deletingAppraisal.employeeId)?.fullName}?
                </div>
                <p className="leading-relaxed">
                  Only uncompleted appraisals can be removed. Completed &amp; archived appraisals are permanently locked for statutory promotion eligibility scoring.
                </p>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingAppraisal(null)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAppraisal}
                className="px-4 py-1.5 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold shadow-xs"
              >
                Delete Appraisal
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>
    </div>
  );
};
