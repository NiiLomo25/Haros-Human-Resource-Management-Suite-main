/**
 * Haros HRMIS - Promotion and Career Progression Management View
 * Features Statutory Career Progression Evaluation (3-Year Automatic vs. 5-Year Senior Competitive Merit),
 * Promotion Boards, Recommendations, Grade Progression, Approval Workflows, and permanent zero-overwrite promotion history.
 */

import React, { useState, useMemo } from 'react';
import {
  Award,
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  GraduationCap,
  Briefcase,
  ArrowRight,
  FileCheck,
  Send,
  ShieldCheck,
  Building2,
  Sparkles,
  Info,
  Scale,
  Edit2,
  Trash2,
} from 'lucide-react';
import { db } from '../../db/storage';
import { notificationService } from '../../services/notifications/notificationService';
import { useAuth } from '../../context/AuthContext';
import {
  PromotionRecommendation,
  GradeLevel,
  ProgressionType,
} from '../../types';
import { SearchableSelect } from '../common/SearchableSelect';
import { SlideOverPanel } from '../common/SlideOverPanel';

interface PromotionManagementViewProps {
  onSelectEmployee?: (empId: number) => void;
}

export const PromotionManagementView: React.FC<PromotionManagementViewProps> = ({
  onSelectEmployee,
}) => {
  const { currentUser, hasPermission } = useAuth();
  const [dataVersion, setDataVersion] = useState(0);

  // Active Tab: 'eligible' | 'recommendations'
  const [activeTab, setActiveTab] = useState<'eligible' | 'recommendations'>('eligible');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartmentId, setFilterDepartmentId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterStream, setFilterStream] = useState<string>('all');

  // Modals state
  const [showRecommendModal, setShowRecommendModal] = useState(false);
  const [selectedEligibleEmpId, setSelectedEligibleEmpId] = useState<number | null>(null);
  const [selectedRecForExecution, setSelectedRecForExecution] = useState<PromotionRecommendation | null>(null);
  const lastRecForExecutionRef = React.useRef<PromotionRecommendation | null>(null);
  if (selectedRecForExecution) {
    lastRecForExecutionRef.current = selectedRecForExecution;
  }
  const activeExecutionRec = selectedRecForExecution || lastRecForExecutionRef.current;

  const [editingRec, setEditingRec] = useState<PromotionRecommendation | null>(null);
  const [editTargetGradeId, setEditTargetGradeId] = useState<number>(1);
  const [editRecStatus, setEditRecStatus] = useState<PromotionRecommendation['status']>('Pending Review');
  const [editExamScore, setEditExamScore] = useState<number>(85);
  const [editInterviewPanel, setEditInterviewPanel] = useState('');
  const [editBoardNotes, setEditBoardNotes] = useState('');
  const [deletingRec, setDeletingRec] = useState<PromotionRecommendation | null>(null);

  // Fetch data
  const employees = useMemo(() => db.getEmployees(), [dataVersion]);
  const gradeLevels = useMemo(() => db.getGradeLevels(), []);
  const departments = useMemo(() => db.getDepartments(), [dataVersion]);
  const mdas = useMemo(() => db.getMdas(), []);
  const rawRecommendations = useMemo(() => db.getPromotionRecommendations(), [dataVersion]);

  // Evaluate Promotion Eligibility for all active officers using the statutory civil service policy engine
  const eligibleOfficers = useMemo(() => {
    return employees
      .map((emp) => {
        const pers = db.getEmployeePersonalInfo(emp.id);
        const empInfo = db.getEmployeeEmploymentInfo(emp.id);
        if (!empInfo || empInfo.currentEmploymentStatus !== 'Active') return null;

        const currentGrade = gradeLevels.find((g) => g.id === empInfo.currentGradeId);
        const firstGrade = gradeLevels.find((g) => g.id === empInfo.firstGradeId);
        const dept = departments.find((d) => d.id === empInfo.currentDepartmentId);
        const mda = mdas.find((m) => m.id === empInfo.currentMdaId);

        // Core Statutory Evaluation Engine
        const evaluation = db.evaluatePromotionEligibility(emp.id);

        // Next potential grade level in hierarchy
        const currentRank = currentGrade?.hierarchyRank || 1;
        const nextGrade = evaluation.suggestedTargetGrade || gradeLevels.find((g) => g.hierarchyRank === currentRank + 1);

        // Check if already recommended
        const existingRec = rawRecommendations.find(
          (r) => r.employeeId === emp.id && (r.status === 'Pending Review' || r.status === 'Board Approved')
        );

        return {
          employee: emp,
          personal: pers,
          employment: empInfo,
          currentGrade,
          firstGrade,
          nextGrade,
          evaluation,
          yearsInGrade: evaluation.yearsInGrade,
          minYears: evaluation.requiredYears,
          isEligible: evaluation.isEligible,
          dept,
          mda,
          existingRec,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.yearsInGrade - a.yearsInGrade);
  }, [employees, gradeLevels, departments, mdas, rawRecommendations]);

  // Filtered Eligible Officers
  const filteredEligible = useMemo(() => {
    return eligibleOfficers.filter((item) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchStaff = item.employee.staffId.toLowerCase().includes(q);
        const matchName = item.personal?.fullName?.toLowerCase().includes(q) || false;
        const matchDept = item.dept?.departmentName.toLowerCase().includes(q) || false;
        const matchGrade = item.currentGrade?.gradeName.toLowerCase().includes(q) || false;
        if (!matchStaff && !matchName && !matchDept && !matchGrade) return false;
      }
      if (filterDepartmentId !== 'all' && item.employment.currentDepartmentId.toString() !== filterDepartmentId) {
        return false;
      }
      if (filterStream !== 'all') {
        if (filterStream === 'automatic' && item.evaluation.progressionType !== 'Automatic Career Progression') return false;
        if (filterStream === 'competitive' && item.evaluation.progressionType !== 'Competitive Senior Promotion') return false;
      }
      return true;
    });
  }, [eligibleOfficers, searchTerm, filterDepartmentId, filterStream]);

  // Combined Recommendations with lookups
  const recommendationList = useMemo(() => {
    return rawRecommendations.map((rec) => {
      const emp = db.getEmployeeById(rec.employeeId);
      const pers = db.getEmployeePersonalInfo(rec.employeeId);
      const empInfo = db.getEmployeeEmploymentInfo(rec.employeeId);
      const currentGrade = gradeLevels.find((g) => g.id === rec.currentGradeId);
      const firstGrade = gradeLevels.find((g) => g.id === empInfo?.firstGradeId);
      const targetGrade = gradeLevels.find((g) => g.id === rec.recommendedGradeId);
      const dept = departments.find((d) => d.id === empInfo?.currentDepartmentId);

      return {
        rec,
        emp,
        pers,
        empInfo,
        currentGrade,
        firstGrade,
        targetGrade,
        dept,
      };
    });
  }, [rawRecommendations, gradeLevels, departments]);

  // Filtered Recommendations
  const filteredRecommendations = useMemo(() => {
    return recommendationList.filter((item) => {
      if (filterStatus !== 'all' && item.rec.status !== filterStatus) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchStaff = item.emp?.staffId.toLowerCase().includes(q) || false;
        const matchName = item.pers?.fullName?.toLowerCase().includes(q) || false;
        const matchNotes = item.rec.boardReviewNotes.toLowerCase().includes(q);
        if (!matchStaff && !matchName && !matchNotes) return false;
      }
      return true;
    });
  }, [recommendationList, filterStatus, searchTerm]);

  // Metrics
  const metrics = useMemo(() => {
    const totalEligible = eligibleOfficers.filter((o) => o.isEligible).length;
    const automaticEligible = eligibleOfficers.filter((o) => o.isEligible && o.evaluation.progressionType === 'Automatic Career Progression').length;
    const seniorCompetitiveEligible = eligibleOfficers.filter((o) => o.isEligible && o.evaluation.progressionType === 'Competitive Senior Promotion').length;
    const pendingBoard = rawRecommendations.filter((r) => r.status === 'Pending Review').length;
    const approvedReady = rawRecommendations.filter((r) => r.status === 'Board Approved').length;
    const implementedCount = rawRecommendations.filter((r) => r.status === 'Implemented').length;
    return { totalEligible, automaticEligible, seniorCompetitiveEligible, pendingBoard, approvedReady, implementedCount };
  }, [eligibleOfficers, rawRecommendations]);

  // Form State for Recommending an Officer
  const [recTargetGradeId, setRecTargetGradeId] = useState<number>(gradeLevels[0]?.id || 1);
  const [recProgressionType, setRecProgressionType] = useState<ProgressionType>('Automatic Career Progression');
  const [recExamScore, setRecExamScore] = useState<number>(85);
  const [recInterviewPanel, setRecInterviewPanel] = useState<string>('Public Services Commission & Head of Civil Service Senior Promotion Board');
  const [recBoardNotes, setRecBoardNotes] = useState('');

  const selectedOfficer = useMemo(() => {
    return eligibleOfficers.find((o) => o.employee.id === selectedEligibleEmpId);
  }, [eligibleOfficers, selectedEligibleEmpId]);

  // Dynamically determine whether the selected transition is Competitive Senior Promotion
  const isCompetitiveSeniorTransition = useMemo(() => {
    if (!selectedOfficer) return false;
    const targetGrade = gradeLevels.find((g) => g.id === recTargetGradeId);
    const currName = (selectedOfficer.currentGrade?.gradeName || '').toLowerCase();
    const targName = (targetGrade?.gradeName || '').toLowerCase();

    const fromPrincipal = currName.includes('principal');
    const toChief = targName.includes('chief') && !currName.includes('chief');
    const fromChief = currName.includes('chief') && !currName.includes('director');
    const toDirector = targName.includes('director');

    return fromPrincipal || toChief || (fromChief && toDirector) || targetGrade?.progressionMode === 'Competitive';
  }, [selectedOfficer, recTargetGradeId, gradeLevels]);

  const handleOpenRecommendModal = (empId: number, suggestedGradeId?: number) => {
    const officer = eligibleOfficers.find((o) => o.employee.id === empId);
    if (!officer) return;

    setSelectedEligibleEmpId(empId);
    const targetId = suggestedGradeId || officer.evaluation.suggestedTargetGrade?.id || gradeLevels[0]?.id || 1;
    setRecTargetGradeId(targetId);

    const isCompetitive = officer.evaluation.progressionType === 'Competitive Senior Promotion';
    setRecProgressionType(isCompetitive ? 'Competitive Senior Promotion' : 'Automatic Career Progression');
    setRecExamScore(88);
    setRecInterviewPanel('Public Services Commission & OHCS Senior Promotion Panel');

    if (isCompetitive) {
      setRecBoardNotes(
        `Competitive Merit Assessment: Officer completed ${officer.yearsInGrade.toFixed(1)} continuous years in grade. Demonstrated outstanding performance rating (${officer.evaluation.performanceRating} - ${officer.evaluation.performanceScore}%) and cleared all integrity, disciplinary, and senior interview board evaluations.`
      );
    } else {
      setRecBoardNotes(
        `Automatic Career Progression: Officer completed ${officer.yearsInGrade.toFixed(1)} continuous years in grade with satisfactory SPAS performance appraisals and clean conduct record.`
      );
    }

    setShowRecommendModal(true);
  };

  const handleCreateRecommendation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEligibleEmpId || !selectedOfficer) return;

    const evalResult = selectedOfficer.evaluation;

    db.createPromotionRecommendation(
      {
        employeeId: selectedEligibleEmpId,
        currentGradeId: selectedOfficer.employment.currentGradeId,
        recommendedGradeId: recTargetGradeId,
        yearsInCurrentGrade: selectedOfficer.yearsInGrade,
        boardReviewNotes: recBoardNotes.trim(),
        recommendedBy: currentUser?.username || 'admin',
        progressionType: isCompetitiveSeniorTransition ? 'Competitive Senior Promotion' : 'Automatic Career Progression',
        competitiveExamScore: isCompetitiveSeniorTransition ? recExamScore : undefined,
        boardInterviewPanel: isCompetitiveSeniorTransition ? recInterviewPanel.trim() : undefined,
        performanceAppraisalScore: evalResult.performanceScore,
        conductStatus: evalResult.conductStatus,
      },
      currentUser?.username || 'admin'
    );

    setShowRecommendModal(false);
    setDataVersion((v) => v + 1);
    setActiveTab('recommendations');
  };

  // Execution Form State (Implementing a board-approved promotion)
  const [execEffectiveDate, setExecEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [execSalaryStep, setExecSalaryStep] = useState<number>(1);

  const handleExecutePromotion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecForExecution) return;

    db.approveAndImplementPromotion(
      selectedRecForExecution.id,
      execEffectiveDate,
      execSalaryStep,
      currentUser?.username || 'admin'
    );

    setSelectedRecForExecution(null);
    setDataVersion((v) => v + 1);
  };

  const handleOpenEditRec = (rec: PromotionRecommendation) => {
    setEditingRec(rec);
    setEditTargetGradeId(rec.recommendedGradeId);
    setEditRecStatus(rec.status);
    setEditExamScore(rec.competitiveExamScore ?? 85);
    setEditInterviewPanel(rec.boardInterviewPanel || 'Public Services Commission & OHCS Senior Promotion Panel');
    setEditBoardNotes(rec.boardReviewNotes);
  };

  const handleSaveEditRec = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRec || !editBoardNotes.trim()) return;
    try {
      db.updatePromotionRecommendation(
        editingRec.id,
        {
          recommendedGradeId: editTargetGradeId,
          status: editRecStatus,
          competitiveExamScore:
            editingRec.progressionType === 'Competitive Senior Promotion' ? editExamScore : undefined,
          boardInterviewPanel:
            editingRec.progressionType === 'Competitive Senior Promotion' ? editInterviewPanel.trim() : undefined,
          boardReviewNotes: editBoardNotes.trim(),
          approvedDate: editRecStatus === 'Board Approved' ? new Date().toISOString().slice(0, 10) : editingRec.approvedDate,
        },
        currentUser?.username || 'admin'
      );
      setEditingRec(null);
      setDataVersion((v) => v + 1);
    } catch (err: any) {
      notificationService.error('Update Promotion Blocked', err?.message || 'Unable to update recommendation.', {
        module: 'Promotion Management',
        actor: currentUser?.username,
      });
    }
  };

  const handleConfirmDeleteRec = () => {
    if (!deletingRec) return;
    const res = db.deletePromotionRecommendation(deletingRec.id, currentUser?.username || 'admin');
    if (!res.success) {
      notificationService.error('Delete Promotion Blocked', res.message, {
        module: 'Promotion Management',
        actor: currentUser?.username,
      });
    }
    setDeletingRec(null);
    setDataVersion((v) => v + 1);
  };

  // Export Eligible Roster CSV
  const handleExportCSV = () => {
    const headers = [
      'Staff ID',
      'Officer Name',
      'Cadre Category',
      'Current Grade',
      'Date Assigned Grade',
      'Years In Grade',
      'Statutory Minimum Years',
      'Progression Stream',
      'SPAS Performance Score',
      'Conduct Clearance',
      'Eligible For Promotion',
      'Recommended Target Grade',
      'Department',
      'MDA',
      'First Grade',
      'Current Promotion Date',
    ];

    const rows = filteredEligible.map((item) => [
      `"${item.employee.staffId}"`,
      `"${item.personal?.fullName || ''}"`,
      `"${item.employment.employeeCategory}"`,
      `"${item.currentGrade?.gradeName || ''}"`,
      `"${item.employment.dateAssignedCurrentGrade}"`,
      item.yearsInGrade.toFixed(1),
      item.minYears,
      `"${item.evaluation.progressionType}"`,
      `"${item.evaluation.performanceScore}% (${item.evaluation.performanceRating})"`,
      `"${item.evaluation.conductStatus}"`,
      item.isEligible ? 'YES' : 'NO',
      `"${item.nextGrade?.gradeName || ''}"`,
      `"${item.dept?.departmentName || ''}"`,
      `"${item.mda?.name || ''}"`,
      `"${item.firstGrade?.gradeName || ''}"`,
      `"${item.employment.currentPromotionDate || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Statutory_Promotion_Eligibility_Roster_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notificationService.success(
      'Promotion Roster Exported',
      `Exported ${filteredEligible.length} promotion eligibility assessment(s) to CSV.`,
      { module: 'Promotion Management', actor: currentUser?.username }
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Award className="w-6 h-6 text-blue-700" />
            <span>Promotion & Career Progression Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Statutory civil service career progression, competitive senior management evaluations, and promotion board warrants.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export Roster CSV</span>
          </button>
        </div>
      </div>

      {/* Statutory Civil Service Career Progression & Senior Management Policy Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-lg p-4 shadow-sm border border-blue-900/40">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-blue-600/30 rounded-lg border border-blue-400/30 text-blue-200 mt-0.5 shrink-0">
              <Scale className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-extrabold tracking-wider bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded border border-blue-400/20">
                  Statutory Civil Service Policy
                </span>
                <span className="text-[11px] text-slate-300">Public Services Regulations • Career Progression & Senior Management</span>
              </div>
              <h2 className="text-sm font-bold text-white mt-1">
                Civil Service Grade Scale Progression Rules
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed max-w-3xl">
                All employees are placed on the approved grade structure upon appointment. Standard career progression is automatic every <strong>three (3) years</strong> of continuous service, subject to satisfactory performance appraisals and clean conduct. Senior management progression requires a minimum of <strong>five (5) years</strong> and a competitive merit process.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-700/60 text-xs">
          <div className="bg-slate-800/70 rounded-lg p-3 border border-slate-700/80 flex items-start space-x-2.5">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold font-mono text-[10px] shrink-0 mt-0.5">
              3 YEARS
            </span>
            <div className="space-y-1">
              <strong className="text-emerald-300 block text-xs flex items-center space-x-1">
                <span>⚡ Standard Automatic Career Progression</span>
              </strong>
              <p className="text-[11px] text-slate-300 leading-normal">
                Career progression shall generally be <strong>automatic from one grade to the next after every three (3) years</strong> of continuous service, subject to satisfactory performance appraisal (SPAS), good conduct, and compliance with all organizational requirements.
              </p>
            </div>
          </div>

          <div className="bg-slate-800/70 rounded-lg p-3 border border-slate-700/80 flex items-start space-x-2.5">
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold font-mono text-[10px] shrink-0 mt-0.5">
              5 YEARS
            </span>
            <div className="space-y-1">
              <strong className="text-purple-300 block text-xs flex items-center space-x-1">
                <span>🏛️ Non-Automatic Senior Management Promotion (Merit-Based)</span>
              </strong>
              <p className="text-[11px] text-slate-300 leading-normal">
                An employee must serve a minimum of <strong>five (5) years on Principal Officer</strong> before becoming eligible for <strong>Chief Officer</strong>, and minimum <strong>five (5) years on Chief Officer</strong> before <strong>Director</strong>. Such promotions are <strong>non-automatic</strong> and strictly based on merit and a competitive promotion process.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-emerald-50/70 rounded-lg border border-emerald-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-800 uppercase flex items-center justify-between">
            <span>Promotion Eligible</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{metrics.totalEligible}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5 flex items-center space-x-1">
            <span>⚡ {metrics.automaticEligible} Automatic</span>
            <span>•</span>
            <span>🏛️ {metrics.seniorCompetitiveEligible} Senior Merit</span>
          </div>
        </div>

        <div className="bg-amber-50/70 rounded-lg border border-amber-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-800 uppercase flex items-center justify-between">
            <span>Pending Board Review</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{metrics.pendingBoard}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">Recommendations submitted</div>
        </div>

        <div className="bg-blue-50/70 rounded-lg border border-blue-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-blue-800 uppercase flex items-center justify-between">
            <span>Board Approved</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-1">{metrics.approvedReady}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">Ready for implementation & grade change</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Implemented Promotions</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{metrics.implementedCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Archived in immutable movement ledger</div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('eligible')}
          className={`flex items-center space-x-2 py-2 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'eligible'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Statutory Eligibility Roster ({eligibleOfficers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('recommendations')}
          className={`flex items-center space-x-2 py-2 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'recommendations'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Promotion Board Recommendations ({rawRecommendations.length})</span>
        </button>
      </div>

      {/* TAB 1: ELIGIBLE OFFICERS ROSTER */}
      {activeTab === 'eligible' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by staff ID, officer name, department, or grade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto min-w-[200px]">
              <span className="text-xs text-slate-500 whitespace-nowrap">Stream:</span>
              <SearchableSelect
                value={filterStream}
                onChange={(val) => setFilterStream(val)}
                options={[
                  { value: 'all', label: 'All Progression Streams' },
                  { value: 'automatic', label: '⚡ Automatic Career Progression (3 Yrs)' },
                  { value: 'competitive', label: '🏛️ Competitive Senior Promotion (5 Yrs)' },
                ]}
                placeholder="Filter stream"
                searchPlaceholder="Search streams..."
              />
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto min-w-[220px]">
              <span className="text-xs text-slate-500 whitespace-nowrap">Department:</span>
              <SearchableSelect
                value={filterDepartmentId}
                onChange={(val) => setFilterDepartmentId(val)}
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

          {/* Eligibility Grid */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
                    <th className="p-3">Staff ID</th>
                    <th className="p-3">Officer Name</th>
                    <th className="p-3">Current Grade Level</th>
                    <th className="p-3 text-center">Seniority in Grade</th>
                    <th className="p-3">Progression Stream</th>
                    <th className="p-3">Appraisal & Conduct Check</th>
                    <th className="p-3">Next Elevation</th>
                    <th className="p-3">Eligibility Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEligible.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        <Award className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-medium text-slate-600">No officers found matching eligibility criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredEligible.map((item) => {
                      const emp = item.employee;
                      const pers = item.personal;
                      const evalRes = item.evaluation;
                      const isCompetitive = evalRes.progressionType === 'Competitive Senior Promotion';

                      return (
                        <tr key={emp.id} className="hover:bg-blue-50/20 transition-colors">
                          <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                            {emp.staffId}
                          </td>

                          <td className="p-3">
                            <div className="font-semibold text-slate-900">
                              {pers?.fullName || `${pers?.firstName} ${pers?.surname}`}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {item.dept?.departmentName}
                            </div>
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">
                              {item.currentGrade?.gradeName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Since {item.employment.dateAssignedCurrentGrade}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Entry: {item.firstGrade?.gradeName || '—'} • Promo: {item.employment.currentPromotionDate || '—'}
                            </div>
                          </td>

                          <td className="p-3 text-center whitespace-nowrap">
                            <span
                              className={`font-black text-xs px-2.5 py-0.5 rounded ${
                                evalRes.hasSufficientTimeInGrade
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {item.yearsInGrade.toFixed(1)} yrs
                            </span>
                            <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                              Required: {item.minYears}.0 yrs
                            </div>
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            {isCompetitive ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200" title="Non-automatic merit & competitive promotion process required">
                                <Sparkles className="w-3 h-3 mr-1 text-purple-600" />
                                🏛️ Competitive Senior (5 Yrs)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200" title="Automatic progression every 3 years subject to satisfactory service">
                                <TrendingUp className="w-3 h-3 mr-1 text-emerald-600" />
                                ⚡ Automatic (3 Yrs)
                              </span>
                            )}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <div className="flex flex-col space-y-1">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                  evalRes.hasSatisfactoryPerformance
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                SPAS: {evalRes.performanceScore}% ({evalRes.performanceRating})
                              </span>
                              <span
                                className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                  evalRes.hasCleanConduct
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-amber-50 text-amber-800'
                                }`}
                              >
                                <ShieldCheck className="w-2.5 h-2.5 mr-1" />
                                Conduct: {evalRes.conductStatus}
                              </span>
                            </div>
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            {item.nextGrade ? (
                              <div className="flex items-center space-x-1 text-slate-800 font-semibold">
                                <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <div>
                                  <span className="text-[11px] text-slate-800 font-bold">{item.nextGrade.gradeName}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Peak Cadre Rank</span>
                            )}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            {item.existingRec ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                <Clock className="w-3 h-3 mr-1" />
                                {item.existingRec.status}
                              </span>
                            ) : item.isEligible ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                {isCompetitive ? 'Eligible for Exam/Board' : 'Eligible for Progression'}
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                                  Maturing ({(item.minYears - item.yearsInGrade).toFixed(1)} yrs left)
                                </span>
                                {evalRes.blockerReasons.length > 0 && !evalRes.hasSufficientTimeInGrade && (
                                  <div className="text-[9px] text-slate-400">
                                    Min {item.minYears} yrs required
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                            {item.isEligible && !item.existingRec && hasPermission('promotion.recommend') && (
                              <button
                                onClick={() => handleOpenRecommendModal(emp.id, item.nextGrade?.id)}
                                className={`px-2.5 py-1 rounded text-white font-semibold transition-colors shadow-xs ${
                                  isCompetitive
                                    ? 'bg-purple-700 hover:bg-purple-800'
                                    : 'bg-blue-700 hover:bg-blue-800'
                                }`}
                              >
                                {isCompetitive ? 'Recommend Board' : 'Recommend'}
                              </button>
                            )}

                            {onSelectEmployee && (
                              <button
                                onClick={() => onSelectEmployee(emp.id)}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                              >
                                Dossier
                              </button>
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

      {/* TAB 2: PROMOTION BOARD RECOMMENDATIONS */}
      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search board recommendations by staff ID, officer name, or remarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto min-w-[180px]">
              <span className="text-xs text-slate-500 whitespace-nowrap">Status:</span>
              <SearchableSelect
                value={filterStatus}
                onChange={(val) => setFilterStatus(val)}
                options={[
                  { value: 'all', label: 'All Board Statuses' },
                  { value: 'Pending Review', label: 'Pending Review' },
                  { value: 'Board Approved', label: 'Board Approved' },
                  { value: 'Implemented', label: 'Implemented' },
                  { value: 'Deferred', label: 'Deferred' },
                ]}
                placeholder="All Statuses"
                searchPlaceholder="Filter statuses..."
              />
            </div>
          </div>

          {/* Recommendations Table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
                    <th className="p-3">Staff ID</th>
                    <th className="p-3">Officer Name</th>
                    <th className="p-3">Grade Elevation</th>
                    <th className="p-3 text-center">Seniority</th>
                    <th className="p-3">Progression Stream & Merit Score</th>
                    <th className="p-3">Board Justification</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecommendations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-medium text-slate-600">No promotion recommendations found.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRecommendations.map((item) => {
                      const rec = item.rec;
                      const emp = item.emp;
                      const pers = item.pers;
                      const isCompetitive = rec.progressionType === 'Competitive Senior Promotion';

                      return (
                        <tr key={rec.id} className="hover:bg-blue-50/20 transition-colors">
                          <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                            {emp?.staffId}
                          </td>

                          <td className="p-3">
                            <div className="font-semibold text-slate-900">
                              {pers?.fullName || `${pers?.firstName} ${pers?.surname}`}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Recommended by {rec.recommendedBy} on {rec.recommendationDate}
                            </div>
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <div className="flex items-center space-x-1.5 font-semibold text-xs">
                              <span className="text-slate-700">{item.currentGrade?.gradeName}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="text-blue-700 font-bold">{item.targetGrade?.gradeName}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Entry: {item.firstGrade?.gradeName || '—'} • Promo: {item.empInfo?.currentPromotionDate || '—'}
                            </div>
                          </td>

                          <td className="p-3 text-center font-bold text-slate-800">
                            {rec.yearsInCurrentGrade.toFixed(1)} Yrs
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            {isCompetitive ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                                  🏛️ Competitive Senior Merit
                                </span>
                                {rec.competitiveExamScore !== undefined && (
                                  <div className="text-[10px] font-semibold text-purple-800">
                                    Exam/Board Score: <strong>{rec.competitiveExamScore}%</strong>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                ⚡ Automatic Career Progression
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-slate-700 max-w-xs truncate" title={rec.boardReviewNotes}>
                            {rec.boardReviewNotes}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                rec.status === 'Implemented'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : rec.status === 'Board Approved'
                                  ? 'bg-blue-100 text-blue-800'
                                  : rec.status === 'Pending Review'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                  rec.status === 'Implemented'
                                    ? 'bg-emerald-500'
                                    : rec.status === 'Board Approved'
                                    ? 'bg-blue-500'
                                    : rec.status === 'Pending Review'
                                    ? 'bg-amber-500'
                                    : 'bg-slate-400'
                                }`}
                              ></span>
                              {rec.status}
                            </span>
                          </td>

                          <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                            {rec.status === 'Board Approved' && hasPermission('promotion.implement') && (
                              <button
                                onClick={() => {
                                  setSelectedRecForExecution(rec);
                                  setExecEffectiveDate(new Date().toISOString().slice(0, 10));
                                  setExecSalaryStep(item.empInfo?.currentSalaryStep || 1);
                                }}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-xs"
                              >
                                Execute Promotion
                              </button>
                            )}

                            {rec.status !== 'Implemented' &&
                              (hasPermission('promotion.recommend') || hasPermission('promotion.implement')) && (
                                <>
                                  <button
                                    onClick={() => handleOpenEditRec(rec)}
                                    className="p-1.5 rounded bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors"
                                    title="Edit recommendation or update board review status"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 inline" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingRec(rec)}
                                    className="p-1.5 rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors"
                                    title="Delete unimplemented promotion recommendation"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 inline" />
                                  </button>
                                </>
                              )}

                            {onSelectEmployee && emp && (
                              <button
                                onClick={() => onSelectEmployee(emp.id)}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                              >
                                Dossier
                              </button>
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

      {/* RECOMMEND PROMOTION SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(showRecommendModal && selectedOfficer)}
        onClose={() => setShowRecommendModal(false)}
        title={
          isCompetitiveSeniorTransition
            ? 'Senior Management Promotion Recommendation'
            : 'Recommend Officer for Career Progression'
        }
        subtitle={
          selectedOfficer
            ? `Candidate: ${selectedOfficer.personal?.fullName} (${selectedOfficer.employee.staffId})`
            : undefined
        }
        icon={<Award className="w-4 h-4" />}
        maxWidthClass="max-w-xl"
        overlayClassName="bg-black/40"
      >
        {selectedOfficer && (
          <form onSubmit={handleCreateRecommendation} className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Statutory Policy Notice Card */}
              {isCompetitiveSeniorTransition ? (
                <div className="p-3.5 bg-purple-50 rounded-lg border border-purple-200 text-purple-900 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-purple-950">
                    <Scale className="w-4 h-4 text-purple-700 shrink-0" />
                    <span>Statutory Senior Management Merit Requirement</span>
                  </div>
                  <p className="text-[11px] text-purple-800 leading-relaxed">
                    Promotion from <strong>Principal Officer to Chief Officer</strong> or from{' '}
                    <strong>Chief Officer to Director</strong> is <strong>not automatic</strong>. An employee
                    must serve a minimum of <strong>five (5) years</strong> on grade and qualify through a
                    merit-based competitive promotion board examination.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-emerald-950">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Statutory Automatic Career Progression</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Career progression is automatic after completing <strong>three (3) years</strong> of
                    continuous service, subject to satisfactory performance appraisals and clean conduct.
                  </p>
                </div>
              )}

              {/* Current Status Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Current Grade:</span>
                  <span className="font-bold text-slate-900">
                    {selectedOfficer.currentGrade?.gradeName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Continuous Service:</span>
                  <span className="font-bold text-slate-900">
                    {selectedOfficer.yearsInGrade.toFixed(1)} Years in Grade
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">SPAS Appraisal:</span>
                  <span className="font-bold text-emerald-700">
                    {selectedOfficer.evaluation.performanceScore}% ({selectedOfficer.evaluation.performanceRating})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Conduct Clearance:</span>
                  <span className="font-bold text-blue-700">{selectedOfficer.evaluation.conductStatus}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Target Recommended Grade Level <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={recTargetGradeId}
                  onChange={(val) => setRecTargetGradeId(parseInt(val, 10))}
                  options={gradeLevels.map((g) => ({
                    value: g.id.toString(),
                    label: g.gradeName,
                  }))}
                  placeholder="Select position title..."
                  searchPlaceholder="Filter position titles..."
                  buttonClassName="h-9 px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-800 font-medium focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {isCompetitiveSeniorTransition && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-purple-900 mb-1">
                      Competitive Exam / Merit Score (%) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={recExamScore}
                      onChange={(e) => setRecExamScore(parseInt(e.target.value) || 0)}
                      required
                      className="w-full p-2.5 bg-purple-50/50 border border-purple-300 rounded text-purple-950 font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-purple-900 mb-1">
                      Interview Board Panel <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={recInterviewPanel}
                      onChange={(e) => setRecInterviewPanel(e.target.value)}
                      required
                      className="w-full p-2.5 bg-purple-50/50 border border-purple-300 rounded text-purple-950 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Promotion Board Review Notes &amp; Justification <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Detail the officer's performance appraisals, leadership contributions, and readiness for higher grade responsibilities..."
                  value={recBoardNotes}
                  onChange={(e) => setRecBoardNotes(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowRecommendModal(false)}
                className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-4 py-2 rounded text-white font-semibold shadow-xs flex items-center space-x-1.5 ${
                  isCompetitiveSeniorTransition
                    ? 'bg-purple-700 hover:bg-purple-800'
                    : 'bg-blue-700 hover:bg-blue-800'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Recommendation</span>
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* EXECUTE PROMOTION SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(selectedRecForExecution)}
        onClose={() => setSelectedRecForExecution(null)}
        title="Execute Approved Promotion Directive"
        subtitle="Promotions & Career Progression • Grade Implementation"
        icon={<CheckCircle2 className="w-4 h-4" />}
        maxWidthClass="max-w-lg"
        overlayClassName="bg-black/40"
      >
        {activeExecutionRec && (
          <form onSubmit={handleExecutePromotion} className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-3.5 bg-emerald-50/50 rounded-lg border border-emerald-200 text-slate-700 space-y-1.5">
                <div>
                  Officer:{' '}
                  <strong className="text-slate-900">
                    {db.getEmployeePersonalInfo(activeExecutionRec.employeeId)?.fullName}
                  </strong>
                </div>
                <div>
                  Progression Stream:{' '}
                  <strong className="text-slate-900">
                    {activeExecutionRec.progressionType || 'Career Progression'}
                  </strong>
                </div>
                <div>
                  Target Grade:{' '}
                  <strong className="text-emerald-700">
                    {gradeLevels.find((g) => g.id === activeExecutionRec.recommendedGradeId)?.gradeName}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Promotion Effective Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={execEffectiveDate}
                  onChange={(e) => setExecEffectiveDate(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Assigned Salary Step on SSSS Grade Scale <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={execSalaryStep}
                  onChange={(e) => setExecSalaryStep(parseInt(e.target.value) || 1)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedRecForExecution(null)}
                className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm &amp; Implement Grade Progression</span>
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* EDIT PROMOTION RECOMMENDATION & BOARD REVIEW DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(editingRec)}
        onClose={() => setEditingRec(null)}
        title="Edit Promotion Board Recommendation"
        subtitle={
          editingRec
            ? `${db.getEmployeePersonalInfo(editingRec.employeeId)?.fullName || 'Officer'} • Rec #${editingRec.id}`
            : undefined
        }
        icon={<Edit2 className="w-4 h-4" />}
        maxWidthClass="max-w-lg"
        overlayClassName="bg-black/40"
      >
        {editingRec && (
          <form onSubmit={handleSaveEditRec} className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Recommended Target Grade <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={editTargetGradeId}
                  onChange={(val) => setEditTargetGradeId(parseInt(val, 10))}
                  options={gradeLevels.map((g) => ({
                    value: g.id.toString(),
                    label: g.gradeName,
                  }))}
                  placeholder="Select grade level..."
                  searchPlaceholder="Filter grade levels..."
                  buttonClassName="h-9 px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Board Review Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={editRecStatus}
                  onChange={(e) => setEditRecStatus(e.target.value as PromotionRecommendation['status'])}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 font-semibold"
                >
                  <option value="Pending Review">Pending Review</option>
                  <option value="Board Approved">Board Approved (Ready for Execution)</option>
                  <option value="Deferred">Deferred</option>
                </select>
              </div>

              {editingRec.progressionType === 'Competitive Senior Promotion' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-purple-900 mb-1">
                      Competitive Merit Score (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editExamScore}
                      onChange={(e) => setEditExamScore(parseInt(e.target.value, 10) || 0)}
                      className="w-full p-2 bg-purple-50/50 border border-purple-300 rounded text-purple-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-purple-900 mb-1">
                      Interview Board Panel
                    </label>
                    <input
                      type="text"
                      value={editInterviewPanel}
                      onChange={(e) => setEditInterviewPanel(e.target.value)}
                      className="w-full p-2 bg-purple-50/50 border border-purple-300 rounded text-purple-950"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Board Review Notes &amp; Justification <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={editBoardNotes}
                  onChange={(e) => setEditBoardNotes(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingRec(null)}
                className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs"
              >
                Save Recommendation
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* DELETE PROMOTION RECOMMENDATION CONFIRMATION DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(deletingRec)}
        onClose={() => setDeletingRec(null)}
        title="Delete Promotion Recommendation"
        subtitle={
          deletingRec ? db.getEmployeePersonalInfo(deletingRec.employeeId)?.fullName || undefined : undefined
        }
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingRec && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1.5">
                <div className="font-bold">
                  Withdraw recommendation for {db.getEmployeePersonalInfo(deletingRec.employeeId)?.fullName}?
                </div>
                <p className="leading-relaxed">
                  Only unimplemented board recommendations can be withdrawn. Promotions already enacted onto the Nominal Roll remain permanently archived.
                </p>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingRec(null)}
                className="px-3.5 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRec}
                className="px-4 py-2 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold shadow-xs"
              >
                Delete Recommendation
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>
    </div>
  );
};
