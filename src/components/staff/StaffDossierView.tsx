/**
 * Haros HRMIS - 12-Tab Master Employee Dossier View
 * Fully functional inspection, editing, qualifications, memberships, movements, and documents.
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  User,
  Briefcase,
  GraduationCap,
  Award,
  Building2,
  ArrowRightLeft,
  CalendarDays,
  Clock,
  TrendingUp,
  FileText,
  Hourglass,
  Plus,
  Trash2,
  Edit2,
  Edit3,
  Save,
  X,
  FileCheck,
  Download,
  Printer,
  ChevronLeft,
  CheckCircle2,
  ExternalLink,
  Shield,
  Upload,
  CreditCard,
  Gavel,
  Zap,
  Sparkles,
} from 'lucide-react';
import { db } from '../../db/storage';
import { notificationService } from '../../services/notifications/notificationService';
import { useAuth } from '../../context/AuthContext';
import {
  Employee,
  EmployeePersonalInfo,
  EmployeeEmploymentInfo,
  EmployeeQualification,
  EmployeeProfessionalMembership,
  PriorEmploymentHistory,
  EmployeeDocument,
  Gender,
  MaritalStatus,
  EmployeeCategory,
  EmploymentType,
  EmployeeTrainingCapability,
  EmployeeSkill,
} from '../../types';
import {
  TrainingAndSkillsEditor,
  SkillEntry,
  getCategoryBadgeStyle,
} from './TrainingAndSkillsEditor';
import { StaffRegistrationModal } from './StaffRegistrationModal';
import { SlideOverPanel } from '../common/SlideOverPanel';

interface StaffDossierViewProps {
  employeeId: number;
  onBack: () => void;
  onInitiateMovement?: (empId: number) => void;
}

export const StaffDossierView: React.FC<StaffDossierViewProps> = ({
  employeeId,
  onBack,
  onInitiateMovement,
}) => {
  const { currentUser, hasPermission, canAccessModule } = useAuth();
  const canEditStaff = hasPermission('STAFF_EDIT');
  const canManageDocs = hasPermission('DOCUMENTS_MANAGE') || hasPermission('STAFF_EDIT');
  const canInitiateMove = Boolean(
    onInitiateMovement && canAccessModule('movements') && hasPermission('MOVEMENT_SUBMIT')
  );
  const [activeTab, setActiveTab] = useState<number>(1);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Entities
  const employee = useMemo(() => db.getEmployeeById(employeeId), [employeeId, refreshTrigger]);
  const personal = useMemo(() => db.getEmployeePersonalInfo(employeeId), [employeeId, refreshTrigger]);
  const employment = useMemo(() => db.getEmployeeEmploymentInfo(employeeId), [employeeId, refreshTrigger]);
  const qualifications = useMemo(() => db.getEmployeeQualifications(employeeId), [employeeId, refreshTrigger]);
  const memberships = useMemo(() => db.getEmployeeMemberships(employeeId), [employeeId, refreshTrigger]);
  const priorHistory = useMemo(() => db.getPriorEmploymentHistory(employeeId), [employeeId, refreshTrigger]);
  const documents = useMemo(() => db.getEmployeeDocuments(employeeId), [employeeId, refreshTrigger]);
  const movementHistory = useMemo(() => db.getStaffMovementHistory(employeeId), [employeeId, refreshTrigger]);
  const leaveApplications = useMemo(() => db.getLeaveApplications(employeeId), [employeeId, refreshTrigger]);
  const leaveBalances = useMemo(() => db.getLeaveBalances(employeeId), [employeeId, refreshTrigger]);
  const trainingNominations = useMemo(() => db.getTrainingNominations(undefined, employeeId), [employeeId, refreshTrigger]);
  const performanceAppraisals = useMemo(() => db.getPerformanceAppraisals(employeeId), [employeeId, refreshTrigger]);
  const capabilities = useMemo(() => db.getTrainingCapabilities(employeeId), [employeeId, refreshTrigger]);
  const skills = useMemo(() => db.getEmployeeSkills(employeeId), [employeeId, refreshTrigger]);
  const promotions = useMemo(
    () => movementHistory.filter((m) => m.movementType === 'Promotion' || m.movementType === 'Acting Appointment'),
    [movementHistory]
  );

  const mdas = useMemo(() => db.getMdas(), []);
  const departments = useMemo(() => db.getDepartments(), []);
  const gradeLevels = useMemo(() => db.getGradeLevels(), []);
  const leaveTypes = useMemo(() => db.getLeaveTypes(), []);
  const trainingPrograms = useMemo(() => db.getTrainingPrograms(), []);
  const allEmployees = useMemo(() => db.getEmployees(), []);
  const payrollAssignment = useMemo(() => db.getEmployeePayrollAssignment(employeeId), [employeeId, refreshTrigger]);
  const disciplinaryCases = useMemo(() => db.getDisciplinaryCases(employeeId), [employeeId, refreshTrigger]);

  // Modal States
  const [showAddQualModal, setShowAddQualModal] = useState(false);
  const [editingQual, setEditingQual] = useState<EmployeeQualification | null>(null);
  const [deletingQual, setDeletingQual] = useState<EmployeeQualification | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<EmployeeProfessionalMembership | null>(null);
  const [deletingMember, setDeletingMember] = useState<EmployeeProfessionalMembership | null>(null);
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<EmployeeDocument | null>(null);
  const [showAddPriorModal, setShowAddPriorModal] = useState(false);
  const [showEditSkillsModal, setShowEditSkillsModal] = useState(false);
  const [showEditFullModal, setShowEditFullModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<EmployeeDocument | null>(null);
  const lastPreviewDocRef = useRef<EmployeeDocument | null>(null);
  if (previewDoc) lastPreviewDocRef.current = previewDoc;
  const activePreviewDoc = previewDoc || lastPreviewDocRef.current;

  // Edit Mode States for Skills & Capabilities
  const [editCaps, setEditCaps] = useState<string[]>([]);
  const [editSkillsList, setEditSkillsList] = useState<SkillEntry[]>([]);
  const [skillsModalError, setSkillsModalError] = useState('');

  // Edit Mode States
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [editPersonalData, setEditPersonalData] = useState<Partial<EmployeePersonalInfo>>({});

  const currentMda = mdas.find((m) => m.id === employment?.currentMdaId);
  const currentDept = departments.find((d) => d.id === employment?.currentDepartmentId);
  const currentGrade = gradeLevels.find((g) => g.id === employment?.currentGradeId);

  // Computed values
  const age = personal ? db.calculateAge(personal.dateOfBirth) : 0;
  const yearsOfService = employment ? db.calculateTotalYearsOfService(employment.dateOfFirstAppointment) : 0;
  const yearsInGrade = employment ? db.calculateYearsInCurrentGrade(employment.dateAssignedCurrentGrade) : 0;
  const monthsToRetirement = employment ? db.calculateMonthsToRetirement(employment.statutoryRetirementDate) : 0;
  const promotionEvaluation = useMemo(() => db.evaluatePromotionEligibility(employeeId), [employeeId, refreshTrigger]);

  if (!employee || !personal || !employment) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Employee record not found.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded text-xs font-semibold">
          Return to Staff Register
        </button>
      </div>
    );
  }

  const handleSavePersonal = () => {
    db.updateEmployee(
      employeeId,
      {
        personal: {
          ...editPersonalData,
          nationalIdentificationNumber:
            editPersonalData.nationalIdentificationNumber?.trim().toUpperCase() || undefined,
        },
      },
      currentUser?.username || 'admin'
    );
    setIsEditingPersonal(false);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleOpenSkillsEditor = () => {
    setEditCaps(capabilities.map((c) => c.capability));
    setEditSkillsList(
      skills.map((s) => ({
        id: s.id,
        skillName: s.skillName,
        category: s.category,
        evidence: s.evidence || '',
      }))
    );
    setSkillsModalError('');
    setShowEditSkillsModal(true);
  };

  const handleSaveSkillsModal = (e: React.FormEvent) => {
    e.preventDefault();
    setSkillsModalError('');

    const nonBlankCaps = editCaps
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
      .slice(0, 10);

    const validSkills: { skillName: string; category: any; evidence: string }[] = [];
    const seen = new Set<string>();

    for (const s of editSkillsList) {
      const trimmedName = s.skillName.trim();
      const trimmedEvidence = s.evidence.trim();
      if (!trimmedName && !trimmedEvidence) continue;
      if (!trimmedName || !s.category) {
        setSkillsModalError('Skill / Competency and Category are required for each skill entry.');
        return;
      }
      const lower = trimmedName.toLowerCase();
      if (seen.has(lower)) {
        setSkillsModalError(`Duplicate skill detected: "${trimmedName}" has already been entered.`);
        return;
      }
      seen.add(lower);
      validSkills.push({
        skillName: trimmedName,
        category: s.category,
        evidence: trimmedEvidence,
      });
    }

    db.updateEmployee(
      employeeId,
      {
        trainingCapabilities: nonBlankCaps,
        skills: validSkills,
      },
      currentUser?.username || 'admin'
    );

    setShowEditSkillsModal(false);
    setRefreshTrigger((prev) => prev + 1);
  };

  const tabs = [
    { id: 1, label: 'Overview', icon: User },
    { id: 2, label: 'Personal Details', icon: User },
    { id: 3, label: 'Employment Details', icon: Briefcase },
    { id: 4, label: `Qualifications (${qualifications.length})`, icon: GraduationCap },
    { id: 5, label: `Memberships (${memberships.length})`, icon: Award },
    { id: 6, label: 'Department History', icon: Building2 },
    { id: 7, label: `Movement History (${movementHistory.length})`, icon: ArrowRightLeft },
    { id: 8, label: `Promotions (${promotions.length})`, icon: Award },
    { id: 9, label: `Leave (${leaveApplications.length})`, icon: CalendarDays },
    { id: 10, label: `Training & Skills (${capabilities.length + skills.length})`, icon: Zap },
    { id: 11, label: `Appraisals (${performanceAppraisals.length})`, icon: TrendingUp },
    { id: 12, label: `Documents (${documents.length})`, icon: FileText },
  ];

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Breadcrumb & Return Action */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Staff Register</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              notificationService.success(
                'Dossier Print Prepared',
                `Prepared Staff Dossier CV (${employee?.staffId || 'Employee'}) for printing.`,
                { module: 'Staff Management', actor: currentUser?.username }
              );
              window.print();
            }}
            className="flex items-center space-x-1 px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Dossier CV</span>
          </button>

          {canEditStaff && (
            <button
              onClick={() => setShowEditFullModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-blue-50 border border-blue-300 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Edit Employee Record</span>
            </button>
          )}

          {canInitiateMove && (
            <button
              onClick={() => onInitiateMovement!(employeeId)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold transition-colors shadow-xs"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Initiate Movement</span>
            </button>
          )}
        </div>
      </div>

      {/* Persistent Master Employee Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            {/* Photograph / Avatar */}
            <div className="w-16 h-16 rounded-xl bg-slate-900 text-white font-bold text-xl flex items-center justify-center border-2 border-slate-200 shadow-xs shrink-0 font-mono">
              {personal.firstName.charAt(0)}
              {personal.surname.charAt(0)}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  {personal.fullName}
                </h1>
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {employee.staffId}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    employment.employeeCategory === 'Professional'
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      : 'bg-teal-100 text-teal-800 border border-teal-200'
                  }`}
                >
                  {employment.employeeCategory} Cadre
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {employment.currentEmploymentStatus}
                </span>
              </div>

              <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-y-1 gap-x-3">
                <span className="font-medium text-slate-900">{employment.currentPositionTitle}</span>
                <span>•</span>
                <span>{currentMda?.name || 'Ministry'}</span>
                <span>•</span>
                <span>{currentDept?.departmentName || 'Directorate'}</span>
                <span>•</span>
                <span className="font-semibold text-blue-700">
                  {currentGrade?.gradeName} (Step {employment.currentSalaryStep})
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Badge Ribbon */}
          <div className="flex items-center space-x-4 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs shrink-0 font-mono">
            <div>
              <div className="text-[10px] text-slate-400 font-sans uppercase">Age</div>
              <div className="font-bold text-slate-900">{age} yrs</div>
            </div>
            <div className="w-px h-6 bg-slate-200"></div>
            <div>
              <div className="text-[10px] text-slate-400 font-sans uppercase">Total Service</div>
              <div className="font-bold text-slate-900">{yearsOfService} yrs</div>
            </div>
            <div className="w-px h-6 bg-slate-200"></div>
            <div>
              <div className="text-[10px] text-slate-400 font-sans uppercase">Time in Grade</div>
              <div className="font-bold text-blue-700">{yearsInGrade} yrs</div>
            </div>
            <div className="w-px h-6 bg-slate-200"></div>
            <div>
              <div className="text-[10px] text-slate-400 font-sans uppercase">Retirement</div>
              <div className={`font-bold ${monthsToRetirement <= 12 ? 'text-rose-600' : 'text-slate-800'}`}>
                {monthsToRetirement <= 0 ? 'DUE' : `${monthsToRetirement} mo.`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 12-Tab Dossier Navigation Ribbon */}
      <div className="bg-white rounded-lg border border-slate-200 p-1 shadow-xs overflow-x-auto select-none">
        <div className="flex space-x-1 min-w-max text-xs font-semibold">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-md transition-all ${
                  isActive
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dossier Body Canvas */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs min-h-[380px]">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Dossier Executive Summary
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
                  Biographical Card
                </div>
                <div><span className="text-slate-500">Gender:</span> <strong>{personal.gender}</strong></div>
                <div><span className="text-slate-500">Date of Birth:</span> <strong className="font-mono">{personal.dateOfBirth}</strong> ({age} years old)</div>
                <div><span className="text-slate-500">Marital Status:</span> <strong>{personal.maritalStatus}</strong></div>
                <div><span className="text-slate-500">Nationality:</span> <strong>{personal.nationality}</strong></div>
                <div><span className="text-slate-500">Ghana Card (NIA):</span> <strong className="font-mono">{personal.nationalIdentificationNumber || 'Pending'}</strong></div>
                <div><span className="text-slate-500">Telephone:</span> <strong className="font-mono">{personal.telephoneNumber}</strong></div>
                <div><span className="text-slate-500">Email:</span> <strong>{personal.emailAddress}</strong></div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
                  Civil Service Cadre Placement
                </div>
                <div><span className="text-slate-500">Cadre Class:</span> <strong className="text-indigo-900">{employment.employeeCategory}</strong></div>
                <div><span className="text-slate-500">Engagement Type:</span> <strong>{employment.employmentType}</strong></div>
                <div><span className="text-slate-500">First Appointment:</span> <strong className="font-mono">{employment.dateOfFirstAppointment}</strong></div>
                <div><span className="text-slate-500">Assumption of Duty:</span> <strong className="font-mono">{employment.dateOfAssumptionOfDuty}</strong></div>
                <div><span className="text-slate-500">Current Grade Scale:</span> <strong className="text-blue-700">{currentGrade?.gradeName}</strong></div>
                <div><span className="text-slate-500">Salary Step:</span> <strong className="font-mono">Step {employment.currentSalaryStep}</strong></div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 uppercase text-[10px] tracking-wider flex items-center justify-between">
                  <span>Statutory Succession & Progression</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                    promotionEvaluation.progressionType === 'Competitive Senior Promotion'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {promotionEvaluation.progressionType === 'Competitive Senior Promotion' ? '🏛️ Senior Merit' : '⚡ Automatic'}
                  </span>
                </div>
                <div><span className="text-slate-500">Statutory Retirement:</span> <strong className="font-mono text-rose-700">{employment.statutoryRetirementDate}</strong> <span className="text-slate-400 text-[10px]">({monthsToRetirement} mos)</span></div>
                <div><span className="text-slate-500">Time in Current Grade:</span> <strong className="font-mono">{yearsInGrade.toFixed(1)} yrs</strong> <span className="text-slate-400 text-[10px]">(Min: {promotionEvaluation.requiredYears}.0 yrs)</span></div>
                <div className="text-[11px] text-slate-600">
                  <span className="text-slate-500">Next Stream:</span> <strong>{promotionEvaluation.progressionType}</strong>
                </div>
                <div className="pt-1">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      promotionEvaluation.isEligible
                        ? 'bg-emerald-100 text-emerald-800'
                        : !promotionEvaluation.hasSufficientTimeInGrade
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {promotionEvaluation.isEligible
                      ? 'Qualified for Promotion Review'
                      : !promotionEvaluation.hasSufficientTimeInGrade
                      ? `${(promotionEvaluation.requiredYears - yearsInGrade).toFixed(1)} yrs to Minimum Seniority`
                      : `Promotion Hold: ${promotionEvaluation.blockerReasons[0] || 'Under Review'}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 4: Training Capabilities & Key Staff Skills */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">
                      Role-Related Training Capabilities & Staff Skills Inventory
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Technical capabilities relating to current posting & certified staff competencies
                    </p>
                  </div>
                </div>

                {canEditStaff && (
                  <button
                    type="button"
                    onClick={handleOpenSkillsEditor}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:text-blue-700 hover:border-blue-400 font-semibold text-xs transition-colors shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Capabilities & Skills</span>
                  </button>
                )}
              </div>

              {/* Specific Training Capabilities (Section B) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    B. Specific Training Capabilities Relating to Current Role ({capabilities.length})
                  </span>
                </div>

                {capabilities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {capabilities.map((cap) => (
                      <div
                        key={cap.id}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs shadow-2xs font-medium"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{cap.capability}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-xs bg-white p-3 rounded-lg border border-dashed border-slate-200">
                    No role-related capabilities recorded. Click "Edit Capabilities & Skills" to capture technical training competencies.
                  </p>
                )}
              </div>

              {/* Skills Possessed by Staff (Section E) */}
              <div className="space-y-2 pt-1 border-t border-slate-200/60">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    E. Skills Possessed by Staff ({skills.length})
                  </span>
                </div>

                {skills.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {skills.map((skill) => (
                      <div
                        key={skill.id}
                        className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-900 text-xs">{skill.skillName}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider shrink-0 ${getCategoryBadgeStyle(
                              skill.category
                            )}`}
                          >
                            {skill.category}
                          </span>
                        </div>
                        {skill.evidence ? (
                          <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100">
                            "{skill.evidence}"
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">No application notes provided.</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-xs bg-white p-3 rounded-lg border border-dashed border-slate-200">
                    No staff skills recorded. Click "Edit Capabilities & Skills" to log key technical, leadership, or analytical skills.
                  </p>
                )}
              </div>
            </div>

            {/* Confidential Disciplinary Notice (Section 15) */}
            {disciplinaryCases.length > 0 && (hasPermission('DISCIPLINARY_VIEW') || hasPermission('ALL')) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-amber-900">
                  <Gavel className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    <strong>Confidential Disciplinary Notice:</strong> {disciplinaryCases.length} case docket{disciplinaryCases.length !== 1 ? 's' : ''} on record ({disciplinaryCases.map((c) => c.caseReference).join(', ')}).
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-[10px]">
                  Classified Docket
                </span>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PERSONAL DETAILS */}
        {activeTab === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Personal & Next-of-Kin Information</h3>
              {canEditStaff && (!isEditingPersonal ? (
                <button
                  onClick={() => {
                    setEditPersonalData(personal);
                    setIsEditingPersonal(true);
                  }}
                  className="flex items-center space-x-1 px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Personal Details</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsEditingPersonal(false)}
                    className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePersonal}
                    className="flex items-center space-x-1 px-3 py-1 rounded bg-blue-700 text-white text-xs font-bold shadow-xs hover:bg-blue-800"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              ))}
            </div>

            {!isEditingPersonal ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-800 text-[11px] uppercase">Identity & Contact</div>
                  <div><span className="text-slate-500">Surname:</span> <strong>{personal.surname}</strong></div>
                  <div><span className="text-slate-500">First Name:</span> <strong>{personal.firstName}</strong></div>
                  <div><span className="text-slate-500">Other Names:</span> <strong>{personal.otherNames || 'N/A'}</strong></div>
                  <div><span className="text-slate-500">Full Name:</span> <strong>{personal.fullName}</strong></div>
                  <div><span className="text-slate-500">Ghana Card (NIA):</span> <strong className="font-mono">{personal.nationalIdentificationNumber || 'Pending'}</strong></div>
                  <div><span className="text-slate-500">Telephone:</span> <strong className="font-mono">{personal.telephoneNumber}</strong></div>
                  <div><span className="text-slate-500">Email:</span> <strong>{personal.emailAddress}</strong></div>
                  <div><span className="text-slate-500">Residential Address:</span> <strong>{personal.residentialAddress}</strong></div>
                </div>

                <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-800 text-[11px] uppercase">Emergency & Next of Kin</div>
                  <div><span className="text-slate-500">Next of Kin Name:</span> <strong>{personal.nextOfKinName}</strong></div>
                  <div><span className="text-slate-500">Relationship:</span> <strong>{personal.nextOfKinRelationship}</strong></div>
                  <div><span className="text-slate-500">Next of Kin Phone:</span> <strong className="font-mono">{personal.nextOfKinPhone}</strong></div>
                  <div><span className="text-slate-500">Emergency Contact:</span> <strong>{personal.emergencyContactName}</strong></div>
                  <div><span className="text-slate-500">Emergency Phone:</span> <strong className="font-mono">{personal.emergencyContactPhone}</strong></div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Surname</label>
                  <input
                    type="text"
                    value={editPersonalData.surname || ''}
                    onChange={(e) => setEditPersonalData({ ...editPersonalData, surname: e.target.value })}
                    className="w-full h-8 px-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">First Name</label>
                  <input
                    type="text"
                    value={editPersonalData.firstName || ''}
                    onChange={(e) => setEditPersonalData({ ...editPersonalData, firstName: e.target.value })}
                    className="w-full h-8 px-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Other Names</label>
                  <input
                    type="text"
                    value={editPersonalData.otherNames || ''}
                    onChange={(e) => setEditPersonalData({ ...editPersonalData, otherNames: e.target.value })}
                    className="w-full h-8 px-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Ghana Card (NIA)</label>
                  <input
                    type="text"
                    value={editPersonalData.nationalIdentificationNumber || ''}
                    onChange={(e) =>
                      setEditPersonalData({
                        ...editPersonalData,
                        nationalIdentificationNumber: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g. GHA-718293041-9"
                    className="w-full h-8 px-2 border rounded font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Telephone Number</label>
                  <input
                    type="text"
                    value={editPersonalData.telephoneNumber || ''}
                    onChange={(e) => setEditPersonalData({ ...editPersonalData, telephoneNumber: e.target.value })}
                    className="w-full h-8 px-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Email Address</label>
                  <input
                    type="email"
                    value={editPersonalData.emailAddress || ''}
                    onChange={(e) => setEditPersonalData({ ...editPersonalData, emailAddress: e.target.value })}
                    className="w-full h-8 px-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Next of Kin Phone</label>
                  <input
                    type="text"
                    value={editPersonalData.nextOfKinPhone || ''}
                    onChange={(e) => setEditPersonalData({ ...editPersonalData, nextOfKinPhone: e.target.value })}
                    className="w-full h-8 px-2 border rounded"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: EMPLOYMENT DETAILS */}
        {activeTab === 3 && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Employment History & Active Placement Record
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="font-bold text-slate-800 text-[11px] uppercase">Service Tenure</div>
                <div><span className="text-slate-500">Date of First Appointment:</span> <strong className="font-mono">{employment.dateOfFirstAppointment}</strong></div>
                <div><span className="text-slate-500">Date of Assumption of Duty:</span> <strong className="font-mono">{employment.dateOfAssumptionOfDuty}</strong></div>
                <div><span className="text-slate-500">Confirmation Date:</span> <strong className="font-mono">{employment.confirmationDate || 'Probation in Progress'}</strong></div>
                <div><span className="text-slate-500">Total Length of Service:</span> <strong className="font-mono">{yearsOfService} years</strong></div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="font-bold text-slate-800 text-[11px] uppercase">Grade & Scheme of Service</div>
                <div><span className="text-slate-500">Staff Category:</span> <strong className="text-indigo-900">{employment.employeeCategory} Cadre</strong></div>
                <div><span className="text-slate-500">Position / Role:</span> <strong>{employment.currentPositionTitle}</strong></div>
                <div><span className="text-slate-500">Grade Level:</span> <strong className="text-blue-700">{currentGrade?.gradeName}</strong></div>
                <div><span className="text-slate-500">Date Assigned Grade:</span> <strong className="font-mono">{employment.dateAssignedCurrentGrade}</strong></div>
              </div>
            </div>

            {/* Single Spine Compensation Parameters (Section 13) */}
            <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-emerald-950 text-[11px] uppercase flex items-center">
                  <CreditCard className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                  Single Spine Compensation & Banking Directives (Section 13)
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 text-emerald-900">
                  Step {payrollAssignment?.salaryStep || 1} of 5
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-slate-500 block text-[10px]">Monthly Basic:</span>
                  <strong className="font-mono text-slate-900">
                    GHS {(payrollAssignment?.basicSalaryMonthlyGhs || currentGrade?.monthlyBaseGhs || 4500).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">SSNIT Number:</span>
                  <strong className="font-mono text-slate-800">{payrollAssignment?.ssnitNumber || 'Pending'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">GRA TIN:</span>
                  <strong className="font-mono text-slate-800">{payrollAssignment?.taxIdentificationNumber || 'Pending'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Bank & Account:</span>
                  <span className="font-medium text-slate-900 block truncate">{payrollAssignment?.bankName || 'GCB Bank'}</span>
                  <span className="font-mono text-[10px] text-slate-500">{payrollAssignment?.bankAccountNumber || 'Not set'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: QUALIFICATIONS */}
        {activeTab === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Academic & Professional Qualifications</h3>
                <p className="text-[11px] text-slate-500">Certified credentials on record</p>
              </div>

              {canEditStaff && (
                <button
                  onClick={() => setShowAddQualModal(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Qualification</span>
                </button>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Level</th>
                    <th className="py-2 px-3">Qualification Title</th>
                    <th className="py-2 px-3">Institution</th>
                    <th className="py-2 px-3">Course / Discipline</th>
                    <th className="py-2 px-3">Year</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {qualifications.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-800">{q.qualificationLevel}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{q.qualificationTitle}</td>
                      <td className="py-2 px-3 text-slate-600">{q.institutionName} ({q.country})</td>
                      <td className="py-2 px-3 text-slate-700">{q.courseOfStudy}</td>
                      <td className="py-2 px-3 font-mono text-slate-800">{q.yearObtained}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center w-max">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {q.verificationStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap space-x-1">
                        {canEditStaff && (
                          <>
                            <button
                              onClick={() => setEditingQual(q)}
                              className="text-slate-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors"
                              title="Edit qualification"
                            >
                              <Edit2 className="w-3.5 h-3.5 inline" />
                            </button>
                            <button
                              onClick={() => setDeletingQual(q)}
                              className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition-colors"
                              title="Delete qualification"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {qualifications.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No qualifications on record. Click "+ Add Qualification" to register credentials.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: PROFESSIONAL MEMBERSHIPS */}
        {activeTab === 5 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Professional Regulatory Memberships</h3>
                <p className="text-[11px] text-slate-500">Chartered bodies & professional licensing</p>
              </div>

              {canEditStaff && (
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Membership</span>
                </button>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Professional Body</th>
                    <th className="py-2 px-3">Membership Number</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Registration Date</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {memberships.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-900">{m.professionalBody}</td>
                      <td className="py-2 px-3 font-mono font-bold text-blue-700">{m.membershipNumber}</td>
                      <td className="py-2 px-3 text-slate-700">{m.membershipCategory}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{m.registrationDate}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {m.membershipStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap space-x-1">
                        {canEditStaff && (
                          <>
                            <button
                              onClick={() => setEditingMember(m)}
                              className="text-slate-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors"
                              title="Edit membership"
                            >
                              <Edit2 className="w-3.5 h-3.5 inline" />
                            </button>
                            <button
                              onClick={() => setDeletingMember(m)}
                              className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition-colors"
                              title="Delete membership"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {memberships.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No professional memberships logged.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: IMMUTABLE MOVEMENT HISTORY (Section 6 & 25) */}
        {activeTab === 7 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Career Movement History (Immutable Historical Ledger)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Permanent chronological record of every transfer, posting, and promotion
                </p>
              </div>

              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono">
                Tamper-Proof Ledger
              </span>
            </div>

            <div className="space-y-3">
              {movementHistory.map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-blue-900 text-sm">{m.movementType}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 text-blue-800 font-semibold">
                        Ref: {m.movementReferenceNumber}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-700">
                      Effective: {m.effectiveDate}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-700 pt-1">
                    <div className="p-2 rounded bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Origin Placement:</span>
                      <div className="font-medium text-slate-900 mt-0.5">
                        {m.mdaNameFrom} <span className="font-normal text-slate-600">({m.gradeNameFrom})</span>
                      </div>
                      <div className="text-[11px] text-slate-500">Dept: {m.departmentNameFrom}</div>
                      <div className="text-[10px] text-slate-400">Position: {m.positionTitleFrom}</div>
                    </div>

                    <div className="p-2 rounded bg-blue-50/50 border border-blue-200">
                      <span className="text-[10px] text-blue-500 font-semibold uppercase">Assigned Destination:</span>
                      <div className="font-bold text-blue-950 mt-0.5">{m.mdaNameTo}</div>
                      <div className="text-[11px] text-blue-800 font-medium">Dept: {m.departmentNameTo}</div>
                      <div className="text-[10px] text-blue-600">Position: {m.positionTitleTo}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Justification: <em>"{m.reason}"</em></span>
                    <span>Approved by: <strong>{m.approvedByOfficerName}</strong></span>
                  </div>
                </div>
              ))}

              {movementHistory.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No historical movements implemented yet. Initiated movements will permanently append here upon approval.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 8: PROMOTIONS & GRADE PROGRESSION */}
        {activeTab === 8 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Promotions & Grade Progression</h3>
                <p className="text-[11px] text-slate-500">
                  Substantive promotions and acting appointments endorsed by the Civil Service Commission
                </p>
              </div>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold font-mono">
                {promotions.length} Career Elevation{promotions.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Next Progression Readiness Card */}
            <div className={`p-4 rounded-xl border text-xs space-y-3 ${
              promotionEvaluation.progressionType === 'Competitive Senior Promotion'
                ? 'bg-purple-50/60 border-purple-200 text-purple-950'
                : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                <div className="flex items-center space-x-2">
                  <Award className={`w-4 h-4 ${
                    promotionEvaluation.progressionType === 'Competitive Senior Promotion' ? 'text-purple-700' : 'text-emerald-700'
                  }`} />
                  <span className="font-bold text-slate-900">Next Career Elevation Readiness</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    promotionEvaluation.progressionType === 'Competitive Senior Promotion'
                      ? 'bg-purple-200/80 text-purple-900'
                      : 'bg-emerald-200/80 text-emerald-900'
                  }`}>
                    {promotionEvaluation.progressionType === 'Competitive Senior Promotion'
                      ? '🏛️ Competitive Senior Promotion (5 Yrs - Merit)'
                      : '⚡ Automatic Career Progression (3 Yrs)'}
                  </span>
                </div>

                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  promotionEvaluation.isEligible
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : !promotionEvaluation.hasSufficientTimeInGrade
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-amber-200 text-amber-900'
                }`}>
                  {promotionEvaluation.isEligible
                    ? '✓ Eligible for Promotion Board'
                    : !promotionEvaluation.hasSufficientTimeInGrade
                    ? `Seniority Maturing (${(promotionEvaluation.requiredYears - yearsInGrade).toFixed(1)} yrs left)`
                    : `Progression Hold: ${promotionEvaluation.blockerReasons[0]}`}
                </span>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                {promotionEvaluation.statutoryRuleSummary}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div className="p-2 rounded bg-white/80 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block font-semibold">Continuous Service in Grade</span>
                  <strong className="text-slate-900 font-mono">{yearsInGrade.toFixed(1)} / {promotionEvaluation.requiredYears}.0 yrs</strong>
                </div>

                <div className="p-2 rounded bg-white/80 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block font-semibold">SPAS Appraisal Rating</span>
                  <strong className="text-slate-900">{promotionEvaluation.performanceScore}% ({promotionEvaluation.performanceRating})</strong>
                </div>

                <div className="p-2 rounded bg-white/80 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block font-semibold">Conduct Clearance</span>
                  <strong className={promotionEvaluation.hasCleanConduct ? 'text-emerald-700' : 'text-rose-700'}>
                    {promotionEvaluation.conductStatus}
                  </strong>
                </div>

                <div className="p-2 rounded bg-white/80 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 block font-semibold">Projected Next Grade</span>
                  <strong className="text-blue-700">{promotionEvaluation.suggestedTargetGrade?.gradeName || 'Peak Grade'}</strong>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {promotions.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-blue-400 transition-colors text-xs space-y-2 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] uppercase bg-emerald-100 text-emerald-800">
                        {p.movementType}
                      </span>
                      <span className="font-mono text-slate-500 text-[11px]">Warrant #{p.movementReferenceNumber}</span>
                    </div>
                    <span className="font-bold text-slate-800 font-mono">Effective: {p.effectiveDate}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">From Grade:</span>
                      <div className="font-medium text-slate-800">{p.gradeNameFrom || 'Entry Grade'}</div>
                      <div className="text-[11px] text-slate-500">{p.positionTitleFrom}</div>
                    </div>
                    <div className="p-2 rounded bg-blue-50/50 border border-blue-200">
                      <span className="text-[10px] text-blue-500 uppercase font-semibold">Promoted To:</span>
                      <div className="font-bold text-blue-900">{p.gradeNameTo}</div>
                      <div className="text-[11px] text-blue-800">{p.positionTitleTo}</div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>Endorsement: <em>"{p.reason}"</em></span>
                    <span>Approved by: <strong>{p.approvedByOfficerName}</strong></span>
                  </div>
                </div>
              ))}

              {promotions.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No promotions or acting appointments recorded for this officer.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 9: LEAVE HISTORY & BALANCES */}
        {activeTab === 9 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Leave Quotas & Historical Applications</h3>
                <p className="text-[11px] text-slate-500">
                  Annual statutory entitlements, days utilized, and formal resumption records
                </p>
              </div>
            </div>

            {/* Leave Balances Grid */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Active Year Entitlement Balances ({new Date().getFullYear()})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {leaveBalances.map((b) => {
                  const lt = leaveTypes.find((t) => t.id === b.leaveTypeId);
                  return (
                    <div key={b.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 text-xs">
                      <span className="font-semibold text-slate-800 text-[11px] block truncate">
                        {lt?.leaveName || 'Leave Category'}
                      </span>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-lg font-bold text-blue-700 font-mono">{b.availableDays}</span>
                        <span className="text-[10px] text-slate-500">of {b.annualEntitlementDays} days</span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400 flex justify-between">
                        <span>Used: {b.daysTaken}d</span>
                        {b.broughtForwardDays > 0 && <span>+{b.broughtForwardDays} CF</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Applications List */}
            <div className="pt-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Historical Applications ({leaveApplications.length})
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2 px-3">Ref #</th>
                      <th className="py-2 px-3">Leave Type</th>
                      <th className="py-2 px-3">Duration</th>
                      <th className="py-2 px-3">Days</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Resumption</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaveApplications.map((app) => {
                      const lt = leaveTypes.find((t) => t.id === app.leaveTypeId);
                      return (
                        <tr key={app.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-blue-700 font-bold">{app.leaveReferenceNumber}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{lt?.leaveName || 'Leave'}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {app.startDate} → {app.endDate}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-700">{app.daysRequested}d</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                app.workflowStatus === 'Approved' || app.workflowStatus === 'Resumed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : app.workflowStatus === 'Rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {app.workflowStatus}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[11px]">
                            {app.resumptionDate ? (
                              <span className="font-mono text-emerald-700 font-semibold">Resumed {app.resumptionDate}</span>
                            ) : (
                              <span className="text-slate-400">Scheduled</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {leaveApplications.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          No leave applications logged for this officer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 10: TRAINING & SKILLS INVENTORY */}
        {activeTab === 10 && (
          <div className="space-y-6">
            {/* Role-Related Training Capabilities & Skills Section */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                      Officer Capability Profile & Staff Skills Inventory
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Specific training capabilities relating to current posting & certified key skills
                    </p>
                  </div>
                </div>

                {canEditStaff && (
                  <button
                    type="button"
                    onClick={handleOpenSkillsEditor}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs transition-colors shadow-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Capabilities & Skills</span>
                  </button>
                )}
              </div>

              {/* Specific Training Capabilities (Section B) */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                  B. Specific Training Capabilities Relating to Current Role ({capabilities.length})
                </span>

                {capabilities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {capabilities.map((cap) => (
                      <div
                        key={cap.id}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs shadow-2xs font-medium"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{cap.capability}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-xs bg-white p-3 rounded-lg border border-dashed border-slate-200">
                    No role-related capabilities recorded. Click "Edit Capabilities & Skills" to capture technical training competencies.
                  </p>
                )}
              </div>

              {/* Skills Possessed by Staff (Section E) */}
              <div className="space-y-2 pt-2 border-t border-slate-200/60">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                  E. Skills Possessed by Staff ({skills.length})
                </span>

                {skills.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {skills.map((skill) => (
                      <div
                        key={skill.id}
                        className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-900 text-xs">{skill.skillName}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider shrink-0 ${getCategoryBadgeStyle(
                              skill.category
                            )}`}
                          >
                            {skill.category}
                          </span>
                        </div>
                        {skill.evidence ? (
                          <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100">
                            "{skill.evidence}"
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">No application notes provided.</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-xs bg-white p-3 rounded-lg border border-dashed border-slate-200">
                    No staff skills recorded. Click "Edit Capabilities & Skills" to log key technical, leadership, or analytical skills.
                  </p>
                )}
              </div>
            </div>

            {/* Official Capacity Building & Courses */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Official Civil Service Courses & Programs</h3>
                  <p className="text-[11px] text-slate-500">
                    Institutional sponsorships, GIMPA/CSTC courses, certifications, and bonding covenants
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold font-mono">
                  {trainingNominations.length} Program{trainingNominations.length !== 1 ? 's' : ''}
                </span>
              </div>

            <div className="space-y-3">
              {trainingNominations.map((nom) => {
                const program = trainingPrograms.find((p) => p.id === nom.trainingProgramId);
                return (
                  <div
                    key={nom.id}
                    className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-blue-400 transition-colors text-xs space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{program?.title || 'Training Program'}</h4>
                        <span className="text-[11px] text-blue-700 font-semibold">{program?.institutionName || 'Civil Service College'}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          nom.status === 'Certified' || nom.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {nom.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-slate-50 p-2 rounded">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Start Date:</span>
                        <span className="font-mono font-medium">{program?.startDate || nom.nominationDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">End Date:</span>
                        <span className="font-mono font-medium">{program?.endDate || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Sponsored By:</span>
                        <span className="font-semibold text-slate-700">{program?.sponsoredBy || 'Government of Ghana'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Location:</span>
                        <span className="font-medium text-slate-700">{program?.location || 'Accra'}</span>
                      </div>
                    </div>

                    {nom.certificateNumber && (
                      <div className="text-[11px] text-emerald-800 flex items-center space-x-2 pt-1 border-t border-slate-100">
                        <span className="font-semibold">Certificate Issued:</span>
                        <span className="font-mono font-bold">{nom.certificateNumber}</span>
                        {nom.evaluationScore && <span>(Score: {nom.evaluationScore}/100)</span>}
                      </div>
                    )}
                  </div>
                );
              })}

              {trainingNominations.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No training programs or certifications logged for this officer.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* TAB 11: PERFORMANCE APPRAISALS */}
        {activeTab === 11 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Performance Appraisals & Annual Ratings</h3>
                <p className="text-[11px] text-slate-500">
                  Civil service annual evaluation cycles, self-assessment, supervisor ratings, and promotion scores
                </p>
              </div>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold font-mono">
                {performanceAppraisals.length} Cycle{performanceAppraisals.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-3">
              {performanceAppraisals.map((appr) => {
                const supervisor = allEmployees.find((e) => e.id === appr.supervisorEmployeeId);
                const supervisorPersonal = supervisor ? db.getEmployeePersonalInfo(supervisor.id) : null;
                return (
                  <div
                    key={appr.id}
                    className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-blue-400 transition-colors text-xs space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">{appr.appraisalCycle} Cycle</span>
                        <span className="text-[11px] text-slate-500 ml-2 font-mono">
                          Period: {appr.appraisalPeriodStart} → {appr.appraisalPeriodEnd}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-extrabold text-blue-700 font-mono">
                          {appr.overallScorePercentage}%
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            appr.finalRating === 'Outstanding' || appr.finalRating === 'Exceeds Expectations'
                              ? 'bg-emerald-100 text-emerald-800'
                              : appr.finalRating === 'Meets Expectations'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {appr.finalRating}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Evaluation Scores:</span>
                        <div className="text-[11px] text-slate-700 mt-1 space-y-0.5">
                          <div className="flex justify-between">
                            <span>Self Assessment:</span>
                            <span className="font-mono font-bold">{appr.selfAssessmentScore}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Supervisor Assessment:</span>
                            <span className="font-mono font-bold">{appr.supervisorScore}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Achievements & Feedback:</span>
                        <div className="text-[11px] text-slate-700 mt-1 italic line-clamp-2">
                          "{appr.strengthsAndAchievements || 'Satisfactory overall target execution.'}"
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 font-semibold">
                          Appraised by: {supervisorPersonal ? `${supervisorPersonal.firstName} ${supervisorPersonal.surname}` : supervisor ? supervisor.staffId : 'Reporting Officer'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Workflow Status: <strong className="text-slate-800">{appr.status}</strong></span>
                      {appr.completedDate && (
                        <span>Completed Date: <strong className="font-mono text-emerald-700">{appr.completedDate}</strong></span>
                      )}
                    </div>
                  </div>
                );
              })}

              {performanceAppraisals.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No annual performance appraisals logged for this officer.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 12: DOCUMENTS REPOSITORY */}
        {activeTab === 12 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Employee Document Repository</h3>
                <p className="text-[11px] text-slate-500">
                  Partitioned digital archive: appointment letters, certificates, and appraisals
                </p>
              </div>

              {canManageDocs && (
                <button
                  onClick={() => setShowAddDocModal(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Document</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 rounded-lg border border-slate-200 bg-white hover:border-blue-400 transition-colors flex items-start justify-between text-xs group"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 leading-snug block">
                        {doc.documentTitle}
                      </span>
                      <span className="text-[10px] text-blue-700 font-semibold block mt-0.5">
                        {doc.documentCategory}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        {doc.fileName} • {Math.round(doc.fileSizeInBytes / 1024)} KB • Uploaded {doc.uploadDate.split('T')[0]}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 text-blue-700 font-medium text-[11px]"
                    >
                      Preview
                    </button>
                    {canManageDocs && (
                      <button
                        onClick={() => setDeletingDoc(doc)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600"
                        title="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {documents.length === 0 && (
                <div className="col-span-2 py-8 text-center text-slate-400 text-xs">
                  No documents uploaded to this employee dossier.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fallback for other standard tabs */}
        {(activeTab === 6 || activeTab === 8 || activeTab === 9 || activeTab === 10 || activeTab === 11) && (
          <div className="py-12 text-center text-slate-500 text-xs space-y-2">
            <div className="font-bold text-slate-700 text-sm">
              {tabs.find((t) => t.id === activeTab)?.label}
            </div>
            <p>
              Records for this tab are integrated with the centralized employee database.
              {activeTab === 8 && ' Official grade progression history is synchronized with the Promotions module.'}
              {activeTab === 9 && ' Entitlements and statutory leave applications appear here from the Leave module.'}
              {activeTab === 10 && ' Completed capacity building programs and bonds appear here from the Training module.'}
              {activeTab === 11 && ' Annual appraisal scores and KPI evaluations appear here from Performance Management.'}
            </p>
          </div>
        )}
      </div>

      {/* --- ADD QUALIFICATION DRAWER --- */}
      <SlideOverPanel
        isOpen={showAddQualModal}
        onClose={() => setShowAddQualModal(false)}
        title="Add Educational Qualification"
        subtitle={`${personal.fullName} • ${employee.staffId}`}
        icon={<GraduationCap className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as any;
            db.addQualification(
              {
                employeeId,
                qualificationLevel: form.level.value,
                qualificationTitle: form.title.value,
                institutionName: form.inst.value,
                country: 'Ghana',
                courseOfStudy: form.course.value,
                yearObtained: Number(form.year.value),
                certificateNumber: form.cert.value,
                verificationStatus: 'Verified',
              },
              currentUser?.username || 'admin'
            );
            setShowAddQualModal(false);
            setRefreshTrigger((prev) => prev + 1);
          }}
          className="flex-1 flex flex-col overflow-hidden text-xs text-slate-800"
        >
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Qualification Level</label>
              <select name="level" className="w-full h-8 px-2 border rounded bg-white">
                <option value="Bachelor">Bachelor's Degree</option>
                <option value="Master">Master's Degree</option>
                <option value="Doctorate">Doctorate (PhD)</option>
                <option value="HND">Higher National Diploma (HND)</option>
                <option value="Diploma">Diploma</option>
                <option value="WASSCE">WASSCE</option>
                <option value="Professional">Professional Certification</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Qualification Title *</label>
              <input name="title" required className="w-full h-8 px-2 border rounded" placeholder="e.g. B.Sc. Administration" />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Institution Name *</label>
              <input name="inst" required className="w-full h-8 px-2 border rounded" placeholder="e.g. University of Ghana" />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Course / Discipline</label>
              <input name="course" required className="w-full h-8 px-2 border rounded" placeholder="e.g. Public Administration" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Year Obtained</label>
                <input name="year" type="number" defaultValue="2016" className="w-full h-8 px-2 border rounded" />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Certificate Number</label>
                <input name="cert" className="w-full h-8 px-2 border rounded" placeholder="e.g. UG-2016-11" />
              </div>
            </div>
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button type="button" onClick={() => setShowAddQualModal(false)} className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 rounded font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded">Save Qualification</button>
          </div>
        </form>
      </SlideOverPanel>

      {/* --- ADD MEMBERSHIP DRAWER --- */}
      <SlideOverPanel
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        title="Add Professional Membership"
        subtitle={`${personal.fullName} • ${employee.staffId}`}
        icon={<Award className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as any;
            db.addEmployeeMembership(
              {
                employeeId,
                professionalBody: form.body.value,
                membershipNumber: form.num.value,
                membershipCategory: form.cat.value,
                registrationDate: form.regDate.value,
                membershipStatus: 'Active',
              },
              currentUser?.username || 'admin'
            );
            setShowAddMemberModal(false);
            setRefreshTrigger((prev) => prev + 1);
          }}
          className="flex-1 flex flex-col overflow-hidden text-xs text-slate-800"
        >
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Professional Body / Association *</label>
              <input name="body" required className="w-full h-8 px-2 border rounded" placeholder="e.g. Ghana Institute of Management (GIM)" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Membership Number *</label>
                <input name="num" required className="w-full h-8 px-2 border rounded font-mono" placeholder="e.g. GIM-GH-881" />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Category</label>
                <input name="cat" defaultValue="Full Member" className="w-full h-8 px-2 border rounded" />
              </div>
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Registration Date</label>
              <input name="regDate" type="date" defaultValue="2018-01-15" className="w-full h-8 px-2 border rounded font-mono" />
            </div>
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button type="button" onClick={() => setShowAddMemberModal(false)} className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 rounded font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded">Save Membership</button>
          </div>
        </form>
      </SlideOverPanel>

      {/* --- ADD DOCUMENT DRAWER --- */}
      <SlideOverPanel
        isOpen={showAddDocModal}
        onClose={() => setShowAddDocModal(false)}
        title="Upload Employee Document"
        subtitle={`${personal.fullName} • ${employee.staffId}`}
        icon={<Upload className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as any;
            db.addEmployeeDocument(
              {
                employeeId,
                documentCategory: form.category.value,
                documentTitle: form.title.value,
                fileName: form.filename.value || 'document.pdf',
                fileExtension: 'pdf',
                fileSizeInBytes: 250000,
                uploadedBy: currentUser?.username || 'admin',
                notes: form.notes.value,
              },
              currentUser?.username || 'admin'
            );
            setShowAddDocModal(false);
            setRefreshTrigger((prev) => prev + 1);
          }}
          className="flex-1 flex flex-col overflow-hidden text-xs text-slate-800"
        >
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Document Category *</label>
              <select name="category" className="w-full h-8 px-2 border rounded bg-white">
                <option value="Appointment Letter">Appointment Letter</option>
                <option value="Promotion Letter">Promotion Letter</option>
                <option value="Transfer Letter">Transfer Letter</option>
                <option value="Academic Certificate">Academic Certificate</option>
                <option value="Confirmation Letter">Confirmation Letter</option>
                <option value="Performance Appraisal">Performance Appraisal</option>
                <option value="Other">Other Civil Service Record</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Document Title / Subject *</label>
              <input name="title" required className="w-full h-8 px-2 border rounded" placeholder="e.g. Appointment Letter (OHCS/APPT/2026/01)" />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">File Name</label>
              <input name="filename" defaultValue="Appointment_Letter_Verified.pdf" className="w-full h-8 px-2 border rounded font-mono" />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Registry Notes</label>
              <textarea name="notes" rows={3} className="w-full p-2 border rounded" placeholder="Verified by Records Desk..." />
            </div>
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button type="button" onClick={() => setShowAddDocModal(false)} className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 rounded font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded">Upload to Repository</button>
          </div>
        </form>
      </SlideOverPanel>

      {/* --- PREVIEW DOCUMENT DRAWER --- */}
      <SlideOverPanel
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={activePreviewDoc?.documentTitle || 'Document Preview'}
        subtitle={`${personal.fullName} • ${employee.staffId}`}
        icon={<FileText className="w-4 h-4" />}
        maxWidthClass="max-w-2xl"
        overlayClassName="bg-black/40"
      >
        {activePreviewDoc && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs text-slate-800">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-2">
                <FileCheck className="w-12 h-12 text-blue-600 mx-auto" />
                <div className="font-bold text-slate-900 text-sm">{activePreviewDoc.fileName}</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Location: %ProgramData%\HarosHRMIS\Documents\{employee.staffId}\{activePreviewDoc.fileName}
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold">
                  Tamper-proof integrity verified (SHA-256 Checksum Valid)
                </div>
              </div>
              {activePreviewDoc.notes && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900">
                  <span className="font-bold">Registry Notes:</span> {activePreviewDoc.notes}
                </div>
              )}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button type="button" onClick={() => setPreviewDoc(null)} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded font-semibold">
                Close Preview
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* --- QUICK EDIT TRAINING & SKILLS DRAWER --- */}
      <SlideOverPanel
        isOpen={showEditSkillsModal}
        onClose={() => setShowEditSkillsModal(false)}
        title="Edit Training Capabilities & Staff Skills"
        subtitle={`${personal.fullName} • ${employee.staffId}`}
        icon={<Zap className="w-4 h-4" />}
        maxWidthClass="max-w-3xl"
        overlayClassName="bg-black/40"
      >
        <form onSubmit={handleSaveSkillsModal} className="flex-1 flex flex-col overflow-hidden text-xs text-slate-800">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900">
              Capture the officer's role-related training capabilities and key skills. Both sections are optional. Blank rows will be ignored on save.
            </div>

            <TrainingAndSkillsEditor
              capabilities={editCaps}
              onChangeCapabilities={setEditCaps}
              skills={editSkillsList}
              onChangeSkills={setEditSkillsList}
              validationError={skillsModalError}
            />
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowEditSkillsModal(false)}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition-colors"
            >
              Save Capabilities &amp; Skills
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* --- MASTER FULL EMPLOYEE EDIT WIZARD (4-Step Wizard Sliding Panel) --- */}
      <StaffRegistrationModal
        isOpen={showEditFullModal}
        employeeId={employeeId}
        initialTab="skills"
        onClose={() => setShowEditFullModal(false)}
        onRegistered={() => {
          setShowEditFullModal(false);
          setRefreshTrigger((prev) => prev + 1);
        }}
      />

      {/* --- EDIT QUALIFICATION DRAWER --- */}
      <SlideOverPanel
        isOpen={Boolean(editingQual)}
        onClose={() => setEditingQual(null)}
        title="Edit Educational Qualification"
        subtitle={editingQual?.qualificationTitle}
        icon={<GraduationCap className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {editingQual && (
          <form
            key={editingQual.id}
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as any;
              db.updateQualification(
                editingQual.id,
                {
                  qualificationLevel: form.level.value,
                  qualificationTitle: form.title.value.trim(),
                  institutionName: form.inst.value.trim(),
                  courseOfStudy: form.course.value.trim(),
                  yearObtained: Number(form.year.value),
                  certificateNumber: form.cert.value.trim(),
                  verificationStatus: form.verificationStatus.value,
                },
                currentUser?.username || 'admin'
              );
              setEditingQual(null);
              setRefreshTrigger((prev) => prev + 1);
            }}
            className="flex-1 flex flex-col overflow-hidden text-xs text-slate-800"
          >
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Qualification Level</label>
                <select
                  name="level"
                  defaultValue={editingQual.qualificationLevel}
                  className="w-full h-8 px-2 border rounded bg-white"
                >
                  <option value="Bachelor">Bachelor's Degree</option>
                  <option value="Master">Master's Degree</option>
                  <option value="Doctorate">Doctorate (PhD)</option>
                  <option value="HND">Higher National Diploma (HND)</option>
                  <option value="Diploma">Diploma</option>
                  <option value="WASSCE">WASSCE</option>
                  <option value="Professional">Professional Certification</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Qualification Title *</label>
                <input
                  name="title"
                  defaultValue={editingQual.qualificationTitle}
                  required
                  className="w-full h-8 px-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Institution Name *</label>
                <input
                  name="inst"
                  defaultValue={editingQual.institutionName}
                  required
                  className="w-full h-8 px-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Course / Discipline</label>
                <input
                  name="course"
                  defaultValue={editingQual.courseOfStudy}
                  required
                  className="w-full h-8 px-2 border rounded"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Year Obtained</label>
                  <input
                    name="year"
                    type="number"
                    defaultValue={editingQual.yearObtained}
                    className="w-full h-8 px-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Certificate Number</label>
                  <input
                    name="cert"
                    defaultValue={editingQual.certificateNumber || ''}
                    className="w-full h-8 px-2 border rounded"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Verification Status</label>
                <select
                  name="verificationStatus"
                  defaultValue={editingQual.verificationStatus}
                  className="w-full h-8 px-2 border rounded bg-white"
                >
                  <option value="Verified">Verified</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingQual(null)}
                className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 rounded font-semibold"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded">
                Save Qualification
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* --- DELETE QUALIFICATION CONFIRMATION DRAWER --- */}
      <SlideOverPanel
        isOpen={Boolean(deletingQual)}
        onClose={() => setDeletingQual(null)}
        title="Delete Qualification Record"
        subtitle={deletingQual?.qualificationTitle}
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingQual && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs text-slate-800">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1.5">
                <div className="font-bold">Remove "{deletingQual.qualificationTitle}"?</div>
                <p className="leading-relaxed">
                  This deletes the credential record ({deletingQual.institutionName}, {deletingQual.yearObtained}) from this officer&apos;s dossier.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingQual(null)}
                className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 rounded font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  db.deleteQualification(deletingQual.id, currentUser?.username || 'admin');
                  setDeletingQual(null);
                  setRefreshTrigger((prev) => prev + 1);
                }}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded"
              >
                Delete Qualification
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* --- EDIT MEMBERSHIP DRAWER --- */}
      <SlideOverPanel
        isOpen={Boolean(editingMember)}
        onClose={() => setEditingMember(null)}
        title="Edit Professional Membership"
        subtitle={editingMember?.professionalBody}
        icon={<Award className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {editingMember && (
          <form
            key={editingMember.id}
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as any;
              db.updateEmployeeMembership(
                editingMember.id,
                {
                  professionalBody: form.body.value.trim(),
                  membershipNumber: form.num.value.trim(),
                  membershipCategory: form.cat.value.trim(),
                  registrationDate: form.regDate.value,
                  membershipStatus: form.membershipStatus.value,
                },
                currentUser?.username || 'admin'
              );
              setEditingMember(null);
              setRefreshTrigger((prev) => prev + 1);
            }}
            className="flex-1 flex flex-col overflow-hidden text-xs text-slate-800"
          >
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Professional Body / Association *</label>
                <input
                  name="body"
                  defaultValue={editingMember.professionalBody}
                  required
                  className="w-full h-8 px-2 border rounded"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Membership Number *</label>
                  <input
                    name="num"
                    defaultValue={editingMember.membershipNumber}
                    required
                    className="w-full h-8 px-2 border rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Category</label>
                  <input
                    name="cat"
                    defaultValue={editingMember.membershipCategory}
                    className="w-full h-8 px-2 border rounded"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Registration Date</label>
                  <input
                    name="regDate"
                    type="date"
                    defaultValue={editingMember.registrationDate}
                    className="w-full h-8 px-2 border rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Status</label>
                  <select
                    name="membershipStatus"
                    defaultValue={editingMember.membershipStatus}
                    className="w-full h-8 px-2 border rounded bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Lapsed">Lapsed</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 rounded font-semibold"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded">
                Save Membership
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* --- DELETE MEMBERSHIP CONFIRMATION DRAWER --- */}
      <SlideOverPanel
        isOpen={Boolean(deletingMember)}
        onClose={() => setDeletingMember(null)}
        title="Delete Professional Membership"
        subtitle={deletingMember?.professionalBody}
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingMember && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs text-slate-800">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1.5">
                <div className="font-bold">Remove membership "{deletingMember.professionalBody}"?</div>
                <p className="leading-relaxed">
                  Deletes license/membership number <span className="font-mono">{deletingMember.membershipNumber}</span> from this officer&apos;s dossier.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingMember(null)}
                className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 rounded font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  db.deleteEmployeeMembership(deletingMember.id, currentUser?.username || 'admin');
                  setDeletingMember(null);
                  setRefreshTrigger((prev) => prev + 1);
                }}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded"
              >
                Delete Membership
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* --- DELETE DOCUMENT CONFIRMATION DRAWER --- */}
      <SlideOverPanel
        isOpen={Boolean(deletingDoc)}
        onClose={() => setDeletingDoc(null)}
        title="Delete Employee Document"
        subtitle={deletingDoc?.documentTitle}
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingDoc && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs text-slate-800">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1.5">
                <div className="font-bold">Delete "{deletingDoc.documentTitle}"?</div>
                <p className="leading-relaxed">
                  Removes <span className="font-mono">{deletingDoc.fileName}</span> ({deletingDoc.documentCategory}) from this officer&apos;s digital repository.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingDoc(null)}
                className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 rounded font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  db.deleteEmployeeDocument(deletingDoc.id, currentUser?.username || 'admin');
                  setDeletingDoc(null);
                  setRefreshTrigger((prev) => prev + 1);
                }}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded"
              >
                Delete Document
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>
    </div>
  );
};
