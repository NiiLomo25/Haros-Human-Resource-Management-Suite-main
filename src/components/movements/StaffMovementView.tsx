/**
 * Haros HRMIS - Staff Movement Management View
 * Implements Transfers, Postings, Inter-MDA Movements, Secondments, Acting Appointments,
 * Redeployments, multi-tier Approval Workflows, and permanent zero-overwrite history.
 */

import React, { useState, useMemo } from 'react';
import {
  ArrowRightLeft,
  Plus,
  Search,
  Filter,
  Download,
  Building2,
  ChevronRight,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  GraduationCap,
  Calendar,
  Layers,
  ArrowRight,
  Eye,
  Check,
  X,
  History,
  Send,
  AlertTriangle,
  Edit2,
  Trash2,
} from 'lucide-react';
import { db } from '../../db/storage';
import { notificationService } from '../../services/notifications/notificationService';
import { useAuth } from '../../context/AuthContext';
import {
  StaffMovement,
  StaffMovementHistory,
  MovementType,
  MovementWorkflowStatus,
  Employee,
  Department,
  Mda,
  GradeLevel,
} from '../../types';
import { SearchableSelect } from '../common/SearchableSelect';
import { SlideOverPanel } from '../common/SlideOverPanel';

interface StaffMovementViewProps {
  onSelectEmployee?: (empId: number) => void;
}

export const StaffMovementView: React.FC<StaffMovementViewProps> = ({ onSelectEmployee }) => {
  const { currentUser, hasPermission } = useAuth();
  const [dataVersion, setDataVersion] = useState(0);

  // Active Tab: 'activeMovements' | 'history'
  const [activeTab, setActiveTab] = useState<'activeMovements' | 'history'>('activeMovements');

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMdaId, setFilterMdaId] = useState<string>('all');

  // Modals state
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [editingMovement, setEditingMovement] = useState<StaffMovement | null>(null);
  const [deletingMovement, setDeletingMovement] = useState<StaffMovement | null>(null);
  const [selectedMovementForReview, setSelectedMovementForReview] = useState<StaffMovement | null>(null);
  const lastMovementReviewRef = React.useRef<StaffMovement | null>(null);
  if (selectedMovementForReview) {
    lastMovementReviewRef.current = selectedMovementForReview;
  }
  const activeReviewMovement = selectedMovementForReview || lastMovementReviewRef.current;

  // Fetch data
  const movements = useMemo(() => db.getStaffMovements(), [dataVersion]);
  const movementHistory = useMemo(() => db.getStaffMovementHistory(), [dataVersion]);
  const employees = useMemo(() => db.getEmployees(), [dataVersion]);
  const mdas = useMemo(() => db.getMdas(), []);
  const departments = useMemo(() => db.getDepartments(), [dataVersion]);
  const units = useMemo(() => db.getUnits(), [dataVersion]);
  const gradeLevels = useMemo(() => db.getGradeLevels(), []);

  // Form state for New Movement
  const [selectedEmpId, setSelectedEmpId] = useState<number>(employees[0]?.id || 1);
  const [formMovementType, setFormMovementType] = useState<MovementType>('Transfer');
  const [formNewMdaId, setFormNewMdaId] = useState<number>(mdas[0]?.id || 1);
  const [formNewDeptId, setFormNewDeptId] = useState<number>(departments[0]?.id || 1);
  const [formNewUnitId, setFormNewUnitId] = useState<string>('');
  const [formNewPositionTitle, setFormNewPositionTitle] = useState('');
  const [formNewGradeId, setFormNewGradeId] = useState<number>(gradeLevels[0]?.id || 1);
  const [formNewSalaryStep, setFormNewSalaryStep] = useState<number>(1);
  const [formEffectiveDate, setFormEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [formReason, setFormReason] = useState('');
  const [formDocRef, setFormDocRef] = useState('');
  const [formRemarks, setFormRemarks] = useState('');

  // Auto-fill current employee details when employee changes in Initiate modal
  const selectedEmpDetails = useMemo(() => {
    if (!selectedEmpId) return null;
    const emp = db.getEmployeeById(selectedEmpId);
    const pers = db.getEmployeePersonalInfo(selectedEmpId);
    const empInfo = db.getEmployeeEmploymentInfo(selectedEmpId);
    const currentMda = mdas.find((m) => m.id === empInfo?.currentMdaId);
    const currentDept = departments.find((d) => d.id === empInfo?.currentDepartmentId);
    const currentGrade = gradeLevels.find((g) => g.id === empInfo?.currentGradeId);

    return { emp, pers, empInfo, currentMda, currentDept, currentGrade };
  }, [selectedEmpId, mdas, departments, gradeLevels]);

  const handleOpenInitiateModal = (preselectedEmpId?: number) => {
    setEditingMovement(null);
    const empId = preselectedEmpId || employees[0]?.id || 1;
    setSelectedEmpId(empId);
    const empInfo = db.getEmployeeEmploymentInfo(empId);
    if (empInfo) {
      setFormNewMdaId(empInfo.currentMdaId);
      setFormNewDeptId(empInfo.currentDepartmentId);
      setFormNewGradeId(empInfo.currentGradeId);
      setFormNewSalaryStep(empInfo.currentSalaryStep);
      setFormNewPositionTitle(empInfo.currentPositionTitle);
    }
    setFormMovementType('Transfer');
    setFormEffectiveDate(new Date().toISOString().slice(0, 10));
    setFormReason('');
    setFormDocRef(`DIR/MOV/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`);
    setFormRemarks('');
    setShowInitiateModal(true);
  };

  const handleOpenEditMovementModal = (mov: StaffMovement) => {
    setEditingMovement(mov);
    setSelectedEmpId(mov.employeeId);
    setFormMovementType(mov.movementType);
    setFormNewMdaId(mov.newMdaId);
    setFormNewDeptId(mov.newDepartmentId);
    setFormNewUnitId(mov.newUnitId ? mov.newUnitId.toString() : '');
    setFormNewPositionTitle(mov.newPositionTitle);
    setFormNewGradeId(mov.newGradeId);
    setFormNewSalaryStep(mov.newSalaryStep);
    setFormEffectiveDate(mov.effectiveDate);
    setFormReason(mov.movementReason);
    setFormDocRef(mov.supportingDocumentName || '');
    setFormRemarks(mov.remarks || '');
    setShowInitiateModal(true);
  };

  const handleCreateMovement = (e: React.FormEvent, submitImmediately: boolean = false) => {
    e.preventDefault();
    if (!selectedEmpDetails?.empInfo) return;

    const currentInfo = selectedEmpDetails.empInfo;
    const targetGrade = gradeLevels.find((g) => g.id === formNewGradeId);

    if (editingMovement) {
      db.updateStaffMovement(
        editingMovement.id,
        {
          movementType: formMovementType,
          newMdaId: formNewMdaId,
          newDepartmentId: formNewDeptId,
          newUnitId: formNewUnitId ? parseInt(formNewUnitId, 10) : undefined,
          newPositionTitle: formNewPositionTitle.trim() || currentInfo.currentPositionTitle,
          newGradeId: formNewGradeId,
          newSalaryLevel: targetGrade?.hierarchyRank || currentInfo.currentSalaryLevel,
          newSalaryStep: formNewSalaryStep,
          effectiveDate: formEffectiveDate,
          movementReason: formReason.trim(),
          supportingDocumentName: formDocRef.trim(),
          remarks: formRemarks.trim(),
          workflowStatus: submitImmediately ? 'Submitted' : editingMovement.workflowStatus,
        },
        currentUser?.username || 'admin'
      );
    } else {
      db.createStaffMovement(
        {
          employeeId: selectedEmpId,
          movementType: formMovementType,
          previousMdaId: currentInfo.currentMdaId,
          newMdaId: formNewMdaId,
          previousDepartmentId: currentInfo.currentDepartmentId,
          newDepartmentId: formNewDeptId,
          previousUnitId: currentInfo.currentUnitId,
          newUnitId: formNewUnitId ? parseInt(formNewUnitId, 10) : undefined,
          previousPositionTitle: currentInfo.currentPositionTitle,
          newPositionTitle: formNewPositionTitle.trim() || currentInfo.currentPositionTitle,
          previousGradeId: currentInfo.currentGradeId,
          newGradeId: formNewGradeId,
          previousSalaryLevel: currentInfo.currentSalaryLevel,
          newSalaryLevel: targetGrade?.hierarchyRank || currentInfo.currentSalaryLevel,
          previousSalaryStep: currentInfo.currentSalaryStep,
          newSalaryStep: formNewSalaryStep,
          effectiveDate: formEffectiveDate,
          movementReason: formReason.trim(),
          supportingDocumentName: formDocRef.trim(),
          remarks: formRemarks.trim(),
          workflowStatus: submitImmediately ? 'Submitted' : 'Draft',
        },
        currentUser?.username || 'admin'
      );
    }

    setEditingMovement(null);
    setShowInitiateModal(false);
    setDataVersion((v) => v + 1);
  };

  const handleConfirmDeleteMovement = () => {
    if (!deletingMovement) return;
    const res = db.deleteStaffMovement(deletingMovement.id, currentUser?.username || 'admin');
    if (!res.success) {
      notificationService.error('Delete Movement Blocked', res.message, {
        module: 'Staff Movements',
        actor: currentUser?.username,
      });
    }
    setDeletingMovement(null);
    setDataVersion((v) => v + 1);
  };

  // Filtered movements list
  const filteredMovements = useMemo(() => {
    return movements.filter((mov) => {
      const emp = db.getEmployeeById(mov.employeeId);
      const pers = db.getEmployeePersonalInfo(mov.employeeId);
      const fullName = pers?.fullName || `${pers?.firstName || ''} ${pers?.surname || ''}`;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchRef = mov.movementReferenceNumber.toLowerCase().includes(q);
        const matchStaff = emp?.staffId.toLowerCase().includes(q) || false;
        const matchName = fullName.toLowerCase().includes(q);
        const matchReason = mov.movementReason.toLowerCase().includes(q);
        if (!matchRef && !matchStaff && !matchName && !matchReason) return false;
      }

      if (filterType !== 'all' && mov.movementType !== filterType) return false;
      if (filterStatus !== 'all' && mov.workflowStatus !== filterStatus) return false;
      if (filterMdaId !== 'all' && mov.newMdaId.toString() !== filterMdaId) return false;

      return true;
    }).sort((a, b) => new Date(b.createdTimestamp).getTime() - new Date(a.createdTimestamp).getTime());
  }, [movements, searchTerm, filterType, filterStatus, filterMdaId]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = movements.length;
    const drafts = movements.filter((m) => m.workflowStatus === 'Draft').length;
    const submittedOrReview = movements.filter((m) => m.workflowStatus === 'Submitted' || m.workflowStatus === 'Under Review').length;
    const approved = movements.filter((m) => m.workflowStatus === 'Approved').length;
    const implemented = movements.filter((m) => m.workflowStatus === 'Implemented').length;
    return { total, drafts, submittedOrReview, approved, implemented };
  }, [movements]);

  // Handle workflow status transitions
  const handleWorkflowAdvance = (targetStatus: MovementWorkflowStatus, remarks?: string) => {
    if (!selectedMovementForReview) return;

    db.advanceMovementWorkflow(
      selectedMovementForReview.id,
      targetStatus,
      currentUser?.username || 'admin',
      remarks
    );

    setSelectedMovementForReview(null);
    setDataVersion((v) => v + 1);
  };

  // Export Movement Register as CSV
  const handleExportCSV = () => {
    const headers = [
      'Movement Ref',
      'Staff ID',
      'Officer Name',
      'Movement Type',
      'Previous MDA',
      'New MDA',
      'Previous Department',
      'New Department',
      'Previous Grade',
      'New Grade',
      'Effective Date',
      'Approval Date',
      'Workflow Status',
      'Reason',
    ];

    const rows = filteredMovements.map((mov) => {
      const emp = db.getEmployeeById(mov.employeeId);
      const pers = db.getEmployeePersonalInfo(mov.employeeId);
      const fullName = pers?.fullName || `${pers?.firstName || ''} ${pers?.surname || ''}`;
      const mdaFrom = mdas.find((m) => m.id === mov.previousMdaId)?.code || '';
      const mdaTo = mdas.find((m) => m.id === mov.newMdaId)?.code || '';
      const deptFrom = departments.find((d) => d.id === mov.previousDepartmentId)?.departmentCode || '';
      const deptTo = departments.find((d) => d.id === mov.newDepartmentId)?.departmentCode || '';
      const gradeFrom = gradeLevels.find((g) => g.id === mov.previousGradeId)?.gradeName || '';
      const gradeTo = gradeLevels.find((g) => g.id === mov.newGradeId)?.gradeName || '';

      return [
        `"${mov.movementReferenceNumber}"`,
        `"${emp?.staffId || ''}"`,
        `"${fullName}"`,
        `"${mov.movementType}"`,
        `"${mdaFrom}"`,
        `"${mdaTo}"`,
        `"${deptFrom}"`,
        `"${deptTo}"`,
        `"${gradeFrom}"`,
        `"${gradeTo}"`,
        `"${mov.effectiveDate}"`,
        `"${mov.approvalDate || ''}"`,
        `"${mov.workflowStatus}"`,
        `"${mov.movementReason.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Staff_Movements_Register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notificationService.success(
      'Movements Register Exported',
      `Exported ${filteredMovements.length} staff movement record(s) to CSV.`,
      { module: 'Staff Movements', actor: currentUser?.username }
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Staff Administration</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-blue-700">Movement & Postings</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 flex items-center">
            <ArrowRightLeft className="w-5 h-5 mr-2 text-blue-700" />
            Staff Movement & Relocation Management
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Process transfers, postings, secondments, inter-MDA relocations, and acting appointments with zero-overwrite history.
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

          {hasPermission('movement.initiate') && (
            <button
              onClick={() => handleOpenInitiateModal()}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Initiate Movement</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Movements</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">All categories recorded</div>
        </div>

        <div className="bg-amber-50/60 rounded-lg border border-amber-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-800 uppercase flex items-center justify-between">
            <span>Under Review</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{metrics.submittedOrReview}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">Awaiting committee action</div>
        </div>

        <div className="bg-blue-50/60 rounded-lg border border-blue-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-blue-800 uppercase flex items-center justify-between">
            <span>Approved (Pending)</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-1">{metrics.approved}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">Ready for implementation</div>
        </div>

        <div className="bg-emerald-50/60 rounded-lg border border-emerald-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-800 uppercase">Implemented</div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{metrics.implemented}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Permanent record archived</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Draft Proposals</div>
          <div className="text-2xl font-black text-slate-700 mt-1">{metrics.drafts}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Unsubmitted motions</div>
        </div>
      </div>

      {/* Tabs Switcher: Active Workflow vs Permanent History Archive */}
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('activeMovements')}
          className={`flex items-center space-x-2 py-2 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'activeMovements'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Movement Directives & Workflows ({movements.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center space-x-2 py-2 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'history'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Permanent Movement History Archive ({movementHistory.length})</span>
        </button>
      </div>

      {activeTab === 'activeMovements' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by movement reference (e.g. MOV-2024-0012), officer name, staff ID, or reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center space-x-2 text-xs text-slate-500 shrink-0">
                <span>Showing:</span>
                <span className="font-bold text-slate-800">{filteredMovements.length}</span>
                <span>of {movements.length} directives</span>
              </div>
            </div>

            {/* Dropdowns */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
              {/* Movement Type */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Movement Category
                </label>
                <SearchableSelect
                  value={filterType}
                  onChange={(val) => setFilterType(val)}
                  options={[
                    { value: 'all', label: 'All Movement Categories' },
                    { value: 'Transfer', label: 'Transfer' },
                    { value: 'Posting', label: 'Posting' },
                    { value: 'Inter-MDA Movement', label: 'Inter-MDA Movement' },
                    { value: 'Secondment', label: 'Secondment' },
                    { value: 'Return from Secondment', label: 'Return from Secondment' },
                    { value: 'Acting Appointment', label: 'Acting Appointment' },
                    { value: 'Redeployment', label: 'Redeployment' },
                    { value: 'Reassignment', label: 'Reassignment' },
                    { value: 'Promotion', label: 'Promotion' },
                    { value: 'Demotion', label: 'Demotion' },
                  ]}
                  placeholder="All Movement Categories"
                  searchPlaceholder="Filter categories..."
                />
              </div>

              {/* Workflow Status */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Workflow Status
                </label>
                <SearchableSelect
                  value={filterStatus}
                  onChange={(val) => setFilterStatus(val)}
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'Draft', label: 'Draft' },
                    { value: 'Submitted', label: 'Submitted' },
                    { value: 'Under Review', label: 'Under Review' },
                    { value: 'Approved', label: 'Approved' },
                    { value: 'Implemented', label: 'Implemented' },
                    { value: 'Rejected', label: 'Rejected' },
                    { value: 'Cancelled', label: 'Cancelled' },
                  ]}
                  placeholder="All Statuses"
                  searchPlaceholder="Filter statuses..."
                />
              </div>

              {/* Destination MDA */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Destination MDA
                </label>
                <SearchableSelect
                  value={filterMdaId}
                  onChange={(val) => setFilterMdaId(val)}
                  options={[
                    { value: 'all', label: 'All MDAs' },
                    ...mdas.map((m) => ({
                      value: m.id.toString(),
                      label: `${m.code} - ${m.name}`,
                    })),
                  ]}
                  placeholder="All MDAs"
                  searchPlaceholder="Filter MDAs..."
                />
              </div>
            </div>
          </div>

          {/* Movements Grid */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
                    <th className="p-3">Reference No.</th>
                    <th className="p-3">Officer Name</th>
                    <th className="p-3">Movement Type</th>
                    <th className="p-3">From Placement</th>
                    <th className="p-3">To Destination</th>
                    <th className="p-3">Effective Date</th>
                    <th className="p-3">Workflow Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-medium text-slate-600">No staff movement records found matching criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((mov) => {
                      const emp = db.getEmployeeById(mov.employeeId);
                      const pers = db.getEmployeePersonalInfo(mov.employeeId);
                      const fullName = pers?.fullName || `${pers?.firstName || ''} ${pers?.surname || ''}`;

                      const mdaFrom = mdas.find((m) => m.id === mov.previousMdaId);
                      const mdaTo = mdas.find((m) => m.id === mov.newMdaId);
                      const deptFrom = departments.find((d) => d.id === mov.previousDepartmentId);
                      const deptTo = departments.find((d) => d.id === mov.newDepartmentId);
                      const gradeFrom = gradeLevels.find((g) => g.id === mov.previousGradeId);

                      return (
                        <tr key={mov.id} className="hover:bg-blue-50/20 transition-colors">
                          {/* Ref */}
                          <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                            {mov.movementReferenceNumber}
                          </td>

                          {/* Officer */}
                          <td className="p-3">
                            <div className="font-semibold text-slate-900">{fullName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Staff ID: {emp?.staffId}
                            </div>
                          </td>

                          {/* Category Badge */}
                          <td className="p-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              {mov.movementType}
                            </span>
                          </td>

                          {/* From Placement */}
                          <td className="p-3">
                            <div className="font-medium text-slate-800">
                              {mdaFrom?.name || mdaFrom?.code || 'MDA'}{' '}
                              <span className="font-normal text-slate-600">({gradeFrom?.gradeName || 'Grade'})</span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Dept: {deptFrom?.departmentName || 'Dept'}
                            </div>
                          </td>

                          {/* To Destination */}
                          <td className="p-3">
                            <div className="font-medium text-blue-800">{mdaTo?.name || mdaTo?.code || 'MDA'}</div>
                            <div className="text-[10px] text-slate-500">
                              Dept: {deptTo?.departmentName || 'Dept'}
                            </div>
                            {db.getEmployeeEmploymentInfo(mov.employeeId)?.previousPosting && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[180px]" title={db.getEmployeeEmploymentInfo(mov.employeeId)?.previousPosting}>
                                Prev: {db.getEmployeeEmploymentInfo(mov.employeeId)?.previousPosting}
                              </div>
                            )}
                          </td>

                          {/* Effective Date */}
                          <td className="p-3 whitespace-nowrap text-slate-700 font-mono">
                            {mov.effectiveDate}
                          </td>

                          {/* Status */}
                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                mov.workflowStatus === 'Implemented'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : mov.workflowStatus === 'Approved'
                                  ? 'bg-blue-100 text-blue-800'
                                  : mov.workflowStatus === 'Under Review' || mov.workflowStatus === 'Submitted'
                                  ? 'bg-amber-100 text-amber-800'
                                  : mov.workflowStatus === 'Draft'
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                  mov.workflowStatus === 'Implemented'
                                    ? 'bg-emerald-500'
                                    : mov.workflowStatus === 'Approved'
                                    ? 'bg-blue-500'
                                    : mov.workflowStatus === 'Under Review' || mov.workflowStatus === 'Submitted'
                                    ? 'bg-amber-500'
                                    : mov.workflowStatus === 'Draft'
                                    ? 'bg-slate-400'
                                    : 'bg-red-500'
                                }`}
                              ></span>
                              {mov.workflowStatus}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                            <button
                              onClick={() => setSelectedMovementForReview(mov)}
                              className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-700 hover:text-white text-blue-700 text-xs font-semibold transition-colors inline-flex items-center space-x-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Inspect / Review</span>
                            </button>

                            {mov.workflowStatus !== 'Implemented' &&
                              mov.workflowStatus !== 'Approved' &&
                              (hasPermission('movement.initiate') || hasPermission('movement.approve')) && (
                                <>
                                  <button
                                    onClick={() => handleOpenEditMovementModal(mov)}
                                    className="p-1.5 rounded bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors"
                                    title="Edit movement directive"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 inline" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingMovement(mov)}
                                    className="p-1.5 rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors"
                                    title="Delete movement directive"
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

      {/* TAB 2: Permanent Immutable Movement History Archive */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center">
                <History className="w-4 h-4 mr-1.5 text-blue-700" />
                Permanent Civil Service Movement Ledger (Zero-Overwrite Audit)
              </h2>
              <p className="text-xs text-slate-500">
                Tamper-proof chronological records preserved permanently whenever a movement directive is implemented.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-2.5">Date Implemented</th>
                  <th className="p-2.5">Reference No.</th>
                  <th className="p-2.5">Officer Name</th>
                  <th className="p-2.5">Movement Category</th>
                  <th className="p-2.5">Relocation Details (From → To)</th>
                  <th className="p-2.5">Reason & Authorization</th>
                  <th className="p-2.5 text-right">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movementHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No archived movements found in the permanent ledger.
                    </td>
                  </tr>
                ) : (
                  movementHistory.map((item) => {
                    const emp = db.getEmployeeById(item.employeeId);
                    const pers = db.getEmployeePersonalInfo(item.employeeId);
                    const fullName = pers?.fullName || `${pers?.firstName || ''} ${pers?.surname || ''}`;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">
                          {item.implementedDate}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {item.movementReferenceNumber}
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-900">{fullName}</div>
                          <div className="text-[10px] text-slate-500">Staff ID: {emp?.staffId}</div>
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                            {item.movementType}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-start gap-2 text-[11px]">
                            <div className="text-slate-700">
                              <div className="font-medium text-slate-800">
                                {item.mdaNameFrom}{' '}
                                <span className="font-normal text-slate-600">({item.gradeNameFrom})</span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Dept: {item.departmentNameFrom}
                              </div>
                            </div>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 mt-1" />
                            <div>
                              <div className="font-bold text-blue-800">{item.mdaNameTo}</div>
                              <div className="text-[10px] text-blue-700/80">
                                Dept: {item.departmentNameTo}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-2.5 text-slate-600">
                          <div className="font-medium text-slate-800">{item.reason}</div>
                          <div className="text-[10px] text-slate-500">
                            Authorized by: <strong>{item.approvedByOfficerName}</strong>
                          </div>
                        </td>
                        <td className="p-2.5 text-right whitespace-nowrap">
                          {onSelectEmployee && (
                            <button
                              onClick={() => onSelectEmployee(item.employeeId)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-700 hover:text-white font-semibold text-slate-700 transition-colors"
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
      )}

      {/* INITIATE / EDIT MOVEMENT SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={showInitiateModal}
        onClose={() => {
          setShowInitiateModal(false);
          setEditingMovement(null);
        }}
        title={
          editingMovement
            ? `Edit Movement Directive (${editingMovement.movementReferenceNumber})`
            : 'Initiate Staff Movement Directive'
        }
        subtitle="Staff Administration • Transfers, Postings & Relocations"
        icon={<ArrowRightLeft className="w-4 h-4" />}
        maxWidthClass="max-w-2xl"
        overlayClassName="bg-black/40"
      >
        <form className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Officer Selection */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Select Civil Service Officer <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={selectedEmpId}
                onChange={(val) => {
                  const empId = parseInt(val, 10);
                  setSelectedEmpId(empId);
                  const empInfo = db.getEmployeeEmploymentInfo(empId);
                  if (empInfo) {
                    setFormNewMdaId(empInfo.currentMdaId);
                    setFormNewDeptId(empInfo.currentDepartmentId);
                    setFormNewGradeId(empInfo.currentGradeId);
                    setFormNewSalaryStep(empInfo.currentSalaryStep);
                    setFormNewPositionTitle(empInfo.currentPositionTitle);
                  }
                }}
                options={employees.map((emp) => {
                  const pers = db.getEmployeePersonalInfo(emp.id);
                  const empInfo = db.getEmployeeEmploymentInfo(emp.id);
                  return {
                    value: emp.id.toString(),
                    label: `${emp.staffId} - ${pers?.fullName || `${pers?.firstName} ${pers?.surname}`}`,
                    subLabel: empInfo?.currentPositionTitle,
                  };
                })}
                placeholder="Type to search and select civil service officer..."
                searchPlaceholder="Filter officers by name, staff ID..."
                buttonClassName="h-9 px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-800 font-medium focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>

            {/* Current Placement Summary Box */}
            {selectedEmpDetails && (
              <div className="p-3.5 bg-blue-50/50 rounded-lg border border-blue-200 space-y-1.5">
                <div className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider">
                  Current Official Placement:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
                  <div>
                    <span className="text-[10px] text-slate-500">MDA:</span>
                    <div className="font-semibold text-slate-900">{selectedEmpDetails.currentMda?.code}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Department:</span>
                    <div className="font-semibold text-slate-900">{selectedEmpDetails.currentDept?.departmentName}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Grade Level:</span>
                    <div className="font-semibold text-slate-900">{selectedEmpDetails.currentGrade?.gradeName}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Position Title:</span>
                    <div className="font-semibold text-slate-900">{selectedEmpDetails.empInfo?.currentPositionTitle}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Movement Type & Effective Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Movement Category <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={formMovementType}
                  onChange={(val) => setFormMovementType(val as MovementType)}
                  options={[
                    { value: 'Transfer', label: 'Transfer (Inter-departmental / Inter-agency)' },
                    { value: 'Posting', label: 'Posting (Operational assignment)' },
                    { value: 'Inter-MDA Movement', label: 'Inter-MDA Movement (Cross-ministerial)' },
                    { value: 'Secondment', label: 'Secondment (Temporary statutory transfer)' },
                    { value: 'Return from Secondment', label: 'Return from Secondment' },
                    { value: 'Acting Appointment', label: 'Acting Appointment (Higher responsibility)' },
                    { value: 'Redeployment', label: 'Redeployment (Organizational realignment)' },
                    { value: 'Reassignment', label: 'Reassignment (Role adjustment)' },
                    { value: 'Promotion', label: 'Promotion (Grade elevation)' },
                    { value: 'Demotion', label: 'Demotion' },
                  ]}
                  placeholder="Select movement type..."
                  searchPlaceholder="Filter movement types..."
                  buttonClassName="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 h-10"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Effective Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formEffectiveDate}
                  onChange={(e) => setFormEffectiveDate(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Destination Placement Parameters */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                Target Destination Placement:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Destination MDA</label>
                  <SearchableSelect
                    value={formNewMdaId.toString()}
                    onChange={(val) => {
                      const mdaId = parseInt(val, 10);
                      setFormNewMdaId(mdaId);
                      const firstDept = departments.find((d) => d.mdaId === mdaId);
                      if (firstDept) setFormNewDeptId(firstDept.id);
                    }}
                    options={mdas.map((m) => ({
                      value: m.id.toString(),
                      label: `${m.code} - ${m.name}`,
                      subLabel: m.mdaType,
                    }))}
                    placeholder="Select MDA..."
                    searchPlaceholder="Filter MDAs..."
                    buttonClassName="w-full p-2 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 h-9"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Destination Department</label>
                  <SearchableSelect
                    value={formNewDeptId.toString()}
                    onChange={(val) => setFormNewDeptId(parseInt(val, 10))}
                    options={departments
                      .filter((d) => d.mdaId === formNewMdaId)
                      .map((d) => ({
                        value: d.id.toString(),
                        label: `${d.departmentCode} - ${d.departmentName}`,
                      }))}
                    placeholder="Select department..."
                    searchPlaceholder="Filter departments..."
                    buttonClassName="w-full p-2 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Target Position Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Principal HR Officer"
                    value={formNewPositionTitle}
                    onChange={(e) => setFormNewPositionTitle(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Target Grade Level</label>
                  <SearchableSelect
                    value={formNewGradeId.toString()}
                    onChange={(val) => setFormNewGradeId(parseInt(val, 10))}
                    options={gradeLevels.map((g) => ({ value: g.id.toString(), label: g.gradeName }))}
                    placeholder="Select grade..."
                    searchPlaceholder="Filter grade levels..."
                    buttonClassName="w-full p-2 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 h-9"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Target Salary Step</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formNewSalaryStep}
                    onChange={(e) => setFormNewSalaryStep(parseInt(e.target.value) || 1)}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Justification & Reference */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Movement Justification / Policy Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide official civil service justification for this movement directive..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Supporting Document / Directive Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. OHCS/DIR/2026/044.pdf"
                    value={formDocRef}
                    onChange={(e) => setFormDocRef(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Administrative Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Endorsed by Ministerial Advisory Board"
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Footer Actions */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowInitiateModal(false);
                setEditingMovement(null);
              }}
              className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
            >
              Cancel
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={(e) => handleCreateMovement(e, false)}
                className="px-3.5 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold"
              >
                {editingMovement ? 'Save Changes' : 'Save as Draft'}
              </button>
              <button
                type="button"
                onClick={(e) => handleCreateMovement(e, true)}
                className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit for Review</span>
              </button>
            </div>
          </div>
        </form>
      </SlideOverPanel>

      {/* WORKFLOW REVIEW & IMPLEMENT SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(selectedMovementForReview)}
        onClose={() => setSelectedMovementForReview(null)}
        title={
          activeReviewMovement
            ? `${activeReviewMovement.movementReferenceNumber} — ${activeReviewMovement.movementType} Directive`
            : 'Posting Directive'
        }
        subtitle={
          activeReviewMovement
            ? `Created by ${activeReviewMovement.createdBy} on ${activeReviewMovement.createdTimestamp.slice(0, 10)}`
            : undefined
        }
        icon={<FileText className="w-4 h-4" />}
        maxWidthClass="max-w-2xl"
        overlayClassName="bg-black/40"
      >
        {activeReviewMovement && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Stepper Display */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-center">
                {['Draft', 'Submitted', 'Under Review', 'Approved', 'Implemented'].map((stage, idx) => {
                  const currentStages = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Implemented'];
                  const currIdx = currentStages.indexOf(activeReviewMovement.workflowStatus);
                  const isPassed = currIdx >= idx;
                  const isCurrent = activeReviewMovement.workflowStatus === stage;

                  return (
                    <div key={stage} className="flex-1 relative">
                      <div
                        className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isCurrent
                            ? 'bg-blue-700 text-white ring-2 ring-blue-300'
                            : isPassed
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isPassed && !isCurrent ? '✓' : idx + 1}
                      </div>
                      <div className={`text-[10px] mt-1 font-semibold ${isCurrent ? 'text-blue-800 font-bold' : 'text-slate-500'}`}>
                        {stage}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Previous */}
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Current Official Posting:
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">MDA:</span>
                    <div className="font-semibold text-slate-800">
                      {mdas.find((m) => m.id === activeReviewMovement.previousMdaId)?.name}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Grade &amp; Position:</span>
                    <div className="font-semibold text-slate-800">
                      {gradeLevels.find((g) => g.id === activeReviewMovement.previousGradeId)?.gradeName} ({activeReviewMovement.previousPositionTitle})
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Department:</span>
                    <div className="font-semibold text-slate-800">
                      {departments.find((d) => d.id === activeReviewMovement.previousDepartmentId)?.departmentName}
                    </div>
                  </div>
                </div>

                {/* Target Destination */}
                <div className="p-3.5 bg-blue-50/60 rounded-lg border border-blue-200 space-y-2">
                  <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                    Target Relocation:
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-600">Destination MDA:</span>
                    <div className="font-semibold text-blue-900">
                      {mdas.find((m) => m.id === activeReviewMovement.newMdaId)?.name}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-600">Destination Department:</span>
                    <div className="font-semibold text-blue-900">
                      {departments.find((d) => d.id === activeReviewMovement.newDepartmentId)?.departmentName}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-600">Target Position:</span>
                    <div className="font-semibold text-blue-900">
                      {activeReviewMovement.newPositionTitle}
                    </div>
                  </div>
                </div>
              </div>

              {/* Justification Box */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <span className="font-semibold text-slate-700">Official Justification:</span>
                <p className="text-slate-800 leading-relaxed">{activeReviewMovement.movementReason}</p>
                {activeReviewMovement.supportingDocumentName && (
                  <div className="pt-1 text-[11px] text-slate-500 flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      Warrant / Letter Reference: <strong>{activeReviewMovement.supportingDocumentName}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Workflow Actions Button Bar */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedMovementForReview(null)}
                className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Close
              </button>

              <div className="flex items-center space-x-2">
                {activeReviewMovement.workflowStatus === 'Draft' && (
                  <button
                    type="button"
                    onClick={() => handleWorkflowAdvance('Submitted')}
                    className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold flex items-center space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Directive</span>
                  </button>
                )}

                {activeReviewMovement.workflowStatus === 'Submitted' && hasPermission('movement.review') && (
                  <button
                    type="button"
                    onClick={() => handleWorkflowAdvance('Under Review')}
                    className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                  >
                    Place Under Review
                  </button>
                )}

                {activeReviewMovement.workflowStatus === 'Under Review' && hasPermission('movement.approve') && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleWorkflowAdvance('Rejected', 'Directive declined by review committee')}
                      className="px-4 py-2 rounded bg-red-100 hover:bg-red-200 text-red-700 font-semibold"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleWorkflowAdvance('Approved')}
                      className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold flex items-center space-x-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve Directive</span>
                    </button>
                  </>
                )}

                {activeReviewMovement.workflowStatus === 'Approved' && hasPermission('movement.implement') && (
                  <button
                    type="button"
                    onClick={() => handleWorkflowAdvance('Implemented')}
                    className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Execute &amp; Implement Relocation</span>
                  </button>
                )}

                {activeReviewMovement.workflowStatus === 'Implemented' && (
                  <div className="text-emerald-700 font-bold flex items-center space-x-1 text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Implemented &amp; Archived in Ledger</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* DELETE STAFF MOVEMENT CONFIRMATION DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(deletingMovement)}
        onClose={() => setDeletingMovement(null)}
        title="Delete Staff Movement Directive"
        subtitle={deletingMovement?.movementReferenceNumber}
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingMovement && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1.5">
                <div className="font-bold">
                  Delete movement directive {deletingMovement.movementReferenceNumber} (
                  {deletingMovement.movementType})?
                </div>
                <p className="leading-relaxed">
                  Only unapproved and unimplemented movement proposals can be removed. Approved directives and Permanent Movement History Ledger records remain locked.
                </p>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingMovement(null)}
                className="px-3.5 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMovement}
                className="px-4 py-2 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold shadow-xs"
              >
                Delete Directive
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>
    </div>
  );
};
