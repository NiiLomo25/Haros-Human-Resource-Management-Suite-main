/**
 * Haros HRMIS - Training & Development Management View
 * Features Capacity Building Programs, Civil Service Nominations,
 * GIMPA / CSTC Institution Management, Certifications, and Evaluation Scoring.
 */

import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  Filter,
  Download,
  CheckCircle2,
  Calendar,
  Building2,
  ChevronRight,
  User,
  Users,
  Award,
  BookOpen,
  DollarSign,
  FileCheck,
  Send,
  Eye,
  Star,
  Edit2,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { db } from '../../db/storage';
import { notificationService } from '../../services/notifications/notificationService';
import { useAuth } from '../../context/AuthContext';
import {
  TrainingProgram,
  TrainingCategory,
  TrainingNomination,
  Employee,
  Department,
} from '../../types';
import { SearchableSelect } from '../common/SearchableSelect';
import { SlideOverPanel } from '../common/SlideOverPanel';

export const CIVIL_SERVICE_TRAINING_CATEGORIES = [
  'Academic/Institution',
  'Scheme of Service',
  'Conferences / Workshops / Webinars',
  'Knowledge Sharing Fora',
  'Coaching and Mentoring',
  'On-the-Job Training',
  'Book Review / Personal Reading',
] as const;

interface TrainingManagementViewProps {
  onSelectEmployee?: (empId: number) => void;
}

export const TrainingManagementView: React.FC<TrainingManagementViewProps> = ({
  onSelectEmployee,
}) => {
  const { currentUser, hasPermission } = useAuth();
  const [dataVersion, setDataVersion] = useState(0);

  // Active Tab: 'programs' | 'nominations'
  const [activeTab, setActiveTab] = useState<'programs' | 'nominations'>('programs');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modals state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<TrainingProgram | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<{ prog: TrainingProgram; nomCount: number } | null>(null);
  const [deleteProgramError, setDeleteProgramError] = useState('');
  const [showNominateModal, setShowNominateModal] = useState(false);
  const [editingNomination, setEditingNomination] = useState<TrainingNomination | null>(null);
  const [deletingNomination, setDeletingNomination] = useState<{ nom: TrainingNomination; staffName: string; progTitle: string } | null>(null);
  const [targetProgramId, setTargetProgramId] = useState<number | null>(null);

  // Fetch data
  const programs = useMemo(() => db.getTrainingPrograms(), [dataVersion]);
  const nominations = useMemo(() => db.getTrainingNominations(), [dataVersion]);
  const employees = useMemo(() => db.getEmployees(), [dataVersion]);
  const departments = useMemo(() => db.getDepartments(), [dataVersion]);

  // Filtered Programs
  const filteredPrograms = useMemo(() => {
    return programs.filter((prog) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchCode = prog.programCode.toLowerCase().includes(q);
        const matchTitle = prog.title.toLowerCase().includes(q);
        const matchInst = prog.institutionName.toLowerCase().includes(q);
        if (!matchCode && !matchTitle && !matchInst) return false;
      }
      if (filterCategory !== 'all' && prog.category !== filterCategory) return false;
      if (filterStatus !== 'all' && prog.status !== filterStatus) return false;
      return true;
    });
  }, [programs, searchTerm, filterCategory, filterStatus]);

  // Combined Nominations
  const nominationList = useMemo(() => {
    return nominations.map((nom) => {
      const prog = programs.find((p) => p.id === nom.trainingProgramId);
      const emp = db.getEmployeeById(nom.employeeId);
      const pers = db.getEmployeePersonalInfo(nom.employeeId);
      const empInfo = db.getEmployeeEmploymentInfo(nom.employeeId);
      const dept = departments.find((d) => d.id === empInfo?.currentDepartmentId);

      return {
        nom,
        prog,
        emp,
        pers,
        empInfo,
        dept,
      };
    });
  }, [nominations, programs, departments]);

  // Filtered Nominations
  const filteredNominations = useMemo(() => {
    return nominationList.filter((item) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchStaff = item.emp?.staffId.toLowerCase().includes(q) || false;
        const matchName = item.pers?.fullName?.toLowerCase().includes(q) || false;
        const matchProg = item.prog?.title.toLowerCase().includes(q) || false;
        if (!matchStaff && !matchName && !matchProg) return false;
      }
      return true;
    });
  }, [nominationList, searchTerm]);

  // Metrics
  const metrics = useMemo(() => {
    const totalPrograms = programs.length;
    const completedPrograms = programs.filter((p) => p.status === 'Completed').length;
    const totalNominations = nominations.length;
    const certifiedOfficers = nominations.filter((n) => n.status === 'Certified').length;
    const totalCostGhs = programs.reduce((sum, p) => sum + p.costGhs, 0);
    return { totalPrograms, completedPrograms, totalNominations, certifiedOfficers, totalCostGhs };
  }, [programs, nominations]);

  // Form State for Planning Program
  const [progTitle, setProgTitle] = useState('');
  const [progCategory, setProgCategory] = useState<TrainingCategory>('Academic/Institution');
  const [progInstitution, setProgInstitution] = useState('Ghana Institute of Management and Public Administration (GIMPA)');
  const [progLocation, setProgLocation] = useState('Greenhill Campus, Accra');
  const [progStartDate, setProgStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [progEndDate, setProgEndDate] = useState(
    new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  );
  const [progDurationDays, setProgDurationDays] = useState<number>(5);
  const [progCostGhs, setProgCostGhs] = useState<number>(3500);
  const defaultSponsor = db.getSettingValue('INSTITUTION_NAME', 'Office of the Head of Civil Service');
  const [progSponsor, setProgSponsor] = useState(defaultSponsor);
  const [progStatus, setProgStatus] = useState<TrainingProgram['status']>('Planned');

  // Form State for Editing Nomination
  const [editNomStatus, setEditNomStatus] = useState<TrainingNomination['status']>('Nominated');
  const [editNomScore, setEditNomScore] = useState<string>('');
  const [editNomCertNo, setEditNomCertNo] = useState<string>('');
  const [editNomNotes, setEditNomNotes] = useState<string>('');

  const handleOpenPlanModal = () => {
    setEditingProgram(null);
    setProgTitle('');
    setProgCategory('Academic/Institution');
    setProgInstitution('Ghana Institute of Management and Public Administration (GIMPA)');
    setProgLocation('Greenhill Campus, Accra');
    setProgStartDate(new Date().toISOString().slice(0, 10));
    setProgEndDate(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
    setProgDurationDays(5);
    setProgCostGhs(3500);
    setProgSponsor(db.getSettingValue('INSTITUTION_NAME', 'Office of the Head of Civil Service'));
    setProgStatus('Planned');
    setShowPlanModal(true);
  };

  const handleOpenEditProgram = (prog: TrainingProgram) => {
    setEditingProgram(prog);
    setProgTitle(prog.title);
    setProgCategory(prog.category);
    setProgInstitution(prog.institutionName);
    setProgLocation(prog.location);
    setProgStartDate(prog.startDate);
    setProgEndDate(prog.endDate);
    setProgDurationDays(prog.durationDays);
    setProgCostGhs(prog.costGhs);
    setProgSponsor(prog.sponsoredBy);
    setProgStatus(prog.status);
    setShowPlanModal(true);
  };

  const handleSaveProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!progTitle.trim()) return;

    const payload = {
      title: progTitle.trim(),
      category: progCategory,
      institutionName: progInstitution.trim(),
      location: progLocation.trim(),
      startDate: progStartDate,
      endDate: progEndDate,
      durationDays: progDurationDays,
      costGhs: progCostGhs,
      sponsoredBy: progSponsor.trim(),
      status: progStatus,
    };

    if (editingProgram) {
      db.updateTrainingProgram(editingProgram.id, payload, currentUser?.username || 'admin');
    } else {
      db.createTrainingProgram(payload, currentUser?.username || 'admin');
    }

    setEditingProgram(null);
    setShowPlanModal(false);
    setDataVersion((v) => v + 1);
  };

  const handleConfirmDeleteProgram = () => {
    if (!deletingProgram) return;
    const res = db.deleteTrainingProgram(deletingProgram.prog.id, currentUser?.username || 'admin');
    if (!res.success) {
      setDeleteProgramError(res.message);
      return;
    }
    setDeletingProgram(null);
    setDeleteProgramError('');
    setDataVersion((v) => v + 1);
  };

  const handleOpenEditNomination = (nom: TrainingNomination) => {
    setEditingNomination(nom);
    setEditNomStatus(nom.status);
    setEditNomScore(nom.evaluationScore ? String(nom.evaluationScore) : '');
    setEditNomCertNo(nom.certificateNumber || '');
    setEditNomNotes(nom.feedbackNotes || '');
  };

  const handleSaveNominationEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNomination) return;
    db.updateTrainingNomination(
      editingNomination.id,
      {
        status: editNomStatus,
        evaluationScore: editNomScore ? Number(editNomScore) : undefined,
        certificateNumber: editNomCertNo.trim() || undefined,
        feedbackNotes: editNomNotes.trim() || undefined,
      },
      currentUser?.username || 'admin'
    );
    setEditingNomination(null);
    setDataVersion((v) => v + 1);
  };

  const handleConfirmDeleteNomination = () => {
    if (!deletingNomination) return;
    db.deleteTrainingNomination(deletingNomination.nom.id, currentUser?.username || 'admin');
    setDeletingNomination(null);
    setDataVersion((v) => v + 1);
  };

  // Form State for Nominating Officer
  const [nomEmpId, setNomEmpId] = useState<number>(employees[0]?.id || 1);
  const [nomProgId, setNomProgId] = useState<number>(programs[0]?.id || 1);

  const handleOpenNominateModal = (preselectedProgId?: number) => {
    setNomProgId(preselectedProgId || programs[0]?.id || 1);
    setNomEmpId(employees[0]?.id || 1);
    setShowNominateModal(true);
  };

  const handleSaveNomination = (e: React.FormEvent) => {
    e.preventDefault();

    db.nominateEmployeeForTraining(
      {
        trainingProgramId: nomProgId,
        employeeId: nomEmpId,
      },
      currentUser?.username || 'admin'
    );

    setShowNominateModal(false);
    setDataVersion((v) => v + 1);
    setActiveTab('nominations');
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Program Code',
      'Course Title',
      'Category',
      'Institution',
      'Duration (Days)',
      'Cost (GHS)',
      'Start Date',
      'End Date',
      'Status',
    ];

    const rows = filteredPrograms.map((p) => [
      `"${p.programCode}"`,
      `"${p.title}"`,
      `"${p.category}"`,
      `"${p.institutionName}"`,
      p.durationDays,
      p.costGhs,
      `"${p.startDate}"`,
      `"${p.endDate}"`,
      `"${p.status}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Civil_Service_Training_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notificationService.success(
      'Training Directory Exported',
      `Exported ${filteredPrograms.length} training program(s) to CSV.`,
      { module: 'Training & Development', actor: currentUser?.username }
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
            <span className="text-blue-700">Training & Development</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 flex items-center">
            <GraduationCap className="w-5 h-5 mr-2 text-blue-700" />
            Civil Service Training & Human Capital Development
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Coordinate ministerial capacity building programs, manage institutional sponsorships, and track officer certifications.
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

          {hasPermission('training.manage') && (
            <>
              <button
                onClick={() => handleOpenNominateModal()}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Nominate Officer</span>
              </button>

              <button
                onClick={handleOpenPlanModal}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Plan Training Program</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Training Programs</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.totalPrograms}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Civil service courses cataloged</div>
        </div>

        <div className="bg-blue-50/60 rounded-lg border border-blue-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-blue-800 uppercase flex items-center justify-between">
            <span>Officers Nominated</span>
            <Users className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-1">{metrics.totalNominations}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">Enrolled across all MDAs</div>
        </div>

        <div className="bg-emerald-50/60 rounded-lg border border-emerald-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-800 uppercase flex items-center justify-between">
            <span>Certified Graduates</span>
            <Award className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{metrics.certifiedOfficers}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Certificates archived in dossier</div>
        </div>

        <div className="bg-amber-50/60 rounded-lg border border-amber-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-800 uppercase">Sponsored Budget</div>
          <div className="text-2xl font-black text-amber-900 mt-1">
            GHS {metrics.totalCostGhs.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-700 mt-0.5">Allocated capacity building fund</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('programs')}
          className={`flex items-center space-x-2 py-2 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'programs'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Training Programs Directory ({programs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('nominations')}
          className={`flex items-center space-x-2 py-2 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'nominations'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Nominated Officers & Certifications ({nominations.length})</span>
        </button>
      </div>

      {/* TAB 1: PROGRAMS */}
      {activeTab === 'programs' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search programs by code, course title, or training institution..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
              <div className="w-56 min-w-[200px]">
                <SearchableSelect
                  value={filterCategory}
                  onChange={(val) => setFilterCategory(val)}
                  placeholder="All Categories"
                  searchPlaceholder="Filter category..."
                  options={[
                    { value: 'all', label: 'All Categories' },
                    ...CIVIL_SERVICE_TRAINING_CATEGORIES.map((cat) => ({
                      value: cat,
                      label: cat,
                    })),
                  ]}
                  buttonClassName="h-8 px-2.5 py-1.5 bg-slate-50 border-slate-300 hover:border-slate-400 text-slate-700 text-xs shadow-2xs"
                />
              </div>

              <div className="w-36 min-w-[130px]">
                <SearchableSelect
                  value={filterStatus}
                  onChange={(val) => setFilterStatus(val)}
                  placeholder="All Statuses"
                  searchPlaceholder="Filter status..."
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'Planned', label: 'Planned' },
                    { value: 'In Progress', label: 'In Progress' },
                    { value: 'Completed', label: 'Completed' },
                  ]}
                  buttonClassName="h-8 px-2.5 py-1.5 bg-slate-50 border-slate-300 hover:border-slate-400 text-slate-700 text-xs shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Programs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPrograms.map((prog) => {
              const progNoms = nominations.filter((n) => n.trainingProgramId === prog.id);

              return (
                <div
                  key={prog.id}
                  className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs hover:border-blue-400 hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                        {prog.programCode}
                      </span>
                      <div className="flex items-center space-x-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            prog.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : prog.status === 'In Progress'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {prog.status}
                        </span>
                        {hasPermission('training.manage') && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditProgram(prog)}
                              title="Edit Training Program"
                              className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteProgramError('');
                                setDeletingProgram({ prog, nomCount: progNoms.length });
                              }}
                              title="Delete Training Program"
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm mt-2">{prog.title}</h3>
                    <div className="text-[11px] text-blue-700 font-semibold mt-0.5">
                      {prog.category}
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
                      <div>
                        Institution: <strong className="text-slate-800">{prog.institutionName}</strong>
                      </div>
                      <div>
                        Location: <span className="text-slate-700">{prog.location}</span>
                      </div>
                      <div>
                        Dates: <span className="font-mono text-slate-800">{prog.startDate} to {prog.endDate}</span> ({prog.durationDays} Days)
                      </div>
                      <div>
                        Cost: <strong className="text-slate-900">GHS {prog.costGhs.toLocaleString()}</strong> per officer
                      </div>
                      <div>
                        Sponsor: <span className="text-slate-700">{prog.sponsoredBy}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      {progNoms.length} Officers Nominated
                    </span>

                    {hasPermission('training.manage') && (
                      <button
                        onClick={() => handleOpenNominateModal(prog.id)}
                        className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-700 hover:text-white font-semibold transition-colors"
                      >
                        + Nominate Staff
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: NOMINATIONS */}
      {activeTab === 'nominations' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden p-4 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-2.5">Staff ID</th>
                  <th className="p-2.5">Officer Name</th>
                  <th className="p-2.5">Department</th>
                  <th className="p-2.5">Training Program</th>
                  <th className="p-2.5">Nomination Date</th>
                  <th className="p-2.5 text-center">Score / Rating</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNominations.map((item) => (
                  <tr key={item.nom.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold text-blue-700 whitespace-nowrap">
                      {item.emp?.staffId}
                    </td>
                    <td className="p-2.5 font-semibold text-slate-900">
                      {item.pers?.fullName || `${item.pers?.firstName} ${item.pers?.surname}`}
                    </td>
                    <td className="p-2.5 text-slate-600">{item.dept?.departmentName}</td>
                    <td className="p-2.5 text-slate-800 font-medium">
                      {item.prog?.title}
                    </td>
                    <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">
                      {item.nom.nominationDate}
                    </td>
                    <td className="p-2.5 text-center whitespace-nowrap">
                      {item.nom.evaluationScore ? (
                        <div className="flex items-center justify-center space-x-1 font-bold text-amber-600">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          <span>{item.nom.evaluationScore} / 5</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Pending</span>
                      )}
                    </td>
                    <td className="p-2.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.nom.status === 'Certified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.nom.status === 'Completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.nom.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1">
                        {hasPermission('training.manage') && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditNomination(item.nom)}
                              title="Edit / Evaluate Nomination"
                              className="p-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeletingNomination({
                                  nom: item.nom,
                                  staffName:
                                    item.pers?.fullName ||
                                    `${item.pers?.firstName || ''} ${item.pers?.surname || ''}`.trim() ||
                                    item.emp?.staffId ||
                                    'Officer',
                                  progTitle: item.prog?.title || 'Training Program',
                                })
                              }
                              title="Withdraw / Delete Nomination"
                              className="p-1.5 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {onSelectEmployee && item.emp && (
                          <button
                            onClick={() => onSelectEmployee(item.emp!.id)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                          >
                            Dossier
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PLAN / EDIT PROGRAM SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={showPlanModal}
        onClose={() => {
          setShowPlanModal(false);
          setEditingProgram(null);
        }}
        title={editingProgram ? `Edit Training Program: ${editingProgram.programCode}` : 'Plan Civil Service Training Program'}
        subtitle={editingProgram ? 'Training & Development • Update Course Specifications' : 'Training & Development • New Capacity Building Course'}
        icon={<BookOpen className="w-4 h-4" />}
        maxWidthClass="max-w-lg"
        overlayClassName="bg-black/40"
      >
        <form onSubmit={handleSaveProgram} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Training Program Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Advanced Public Procurement Regulation & Auditing"
                value={progTitle}
                onChange={(e) => setProgTitle(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={progCategory}
                  onChange={(val) => setProgCategory(val as TrainingCategory)}
                  placeholder="--Select Option--"
                  searchPlaceholder="Type to filter categories..."
                  options={CIVIL_SERVICE_TRAINING_CATEGORIES.map((cat) => ({
                    value: cat,
                    label: cat,
                  }))}
                  buttonClassName="h-9 px-2.5 py-1.5 bg-slate-50 border-slate-300 hover:border-slate-400 text-slate-800 shadow-2xs focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Training Institution</label>
                <input
                  type="text"
                  value={progInstitution}
                  onChange={(e) => setProgInstitution(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={progStartDate}
                  onChange={(e) => setProgStartDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={progEndDate}
                  onChange={(e) => setProgEndDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cost per Head (GHS)</label>
                <input
                  type="number"
                  value={progCostGhs}
                  onChange={(e) => setProgCostGhs(parseInt(e.target.value) || 0)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Sponsoring Agency / Fund</label>
                <input
                  type="text"
                  value={progSponsor}
                  onChange={(e) => setProgSponsor(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Program Status</label>
                <SearchableSelect
                  value={progStatus}
                  onChange={(val) => setProgStatus(val as TrainingProgram['status'])}
                  options={[
                    { value: 'Planned', label: 'Planned' },
                    { value: 'In Progress', label: 'In Progress' },
                    { value: 'Completed', label: 'Completed' },
                  ]}
                  placeholder="Select status..."
                  searchPlaceholder="Filter statuses..."
                  buttonClassName="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 h-10"
                />
              </div>
            </div>
          </div>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowPlanModal(false);
                setEditingProgram(null);
              }}
              className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs transition-colors"
            >
              {editingProgram ? 'Save Program Changes' : 'Save Training Program'}
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* NOMINATE OFFICER SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={showNominateModal}
        onClose={() => setShowNominateModal(false)}
        title="Nominate Civil Service Officer"
        subtitle="Training & Development • Course Enrollment"
        icon={<Users className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        <form onSubmit={handleSaveNomination} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Training Program <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={nomProgId}
                onChange={(val) => setNomProgId(parseInt(val))}
                placeholder="--Select Training Program--"
                searchPlaceholder="Type to filter programs..."
                options={programs.map((p) => ({
                  value: p.id,
                  label: `${p.programCode} - ${p.title}`,
                  subLabel: p.category,
                  badge: p.status,
                }))}
                buttonClassName="h-9 px-2.5 py-1.5 bg-slate-50 border-slate-300 hover:border-slate-400 text-slate-800 shadow-2xs focus:ring-1 focus:ring-blue-600 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Civil Service Officer <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={nomEmpId}
                onChange={(val) => setNomEmpId(parseInt(val))}
                placeholder="--Select Officer--"
                searchPlaceholder="Type to filter officers by name or staff ID..."
                options={employees.map((emp) => {
                  const pers = db.getEmployeePersonalInfo(emp.id);
                  const empInfo = db.getEmployeeEmploymentInfo(emp.id);
                  const dept = departments.find((d) => d.id === empInfo?.currentDepartmentId);
                  const fullName = pers?.fullName || `${pers?.firstName || ''} ${pers?.surname || ''}`.trim() || emp.staffId;
                  return {
                    value: emp.id,
                    label: `${emp.staffId} - ${fullName}`,
                    subLabel: dept?.departmentName,
                    badge: empInfo?.currentPositionTitle,
                  };
                })}
                buttonClassName="h-9 px-2.5 py-1.5 bg-slate-50 border-slate-300 hover:border-slate-400 text-slate-800 shadow-2xs focus:ring-1 focus:ring-blue-600 font-semibold"
                required
              />
            </div>
          </div>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowNominateModal(false)}
              className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs transition-colors"
            >
              Submit Nomination
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* DELETE PROGRAM SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(deletingProgram)}
        onClose={() => {
          setDeletingProgram(null);
          setDeleteProgramError('');
        }}
        title="Delete Training Program"
        subtitle={deletingProgram ? `${deletingProgram.prog.programCode} — ${deletingProgram.prog.title}` : undefined}
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingProgram && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
                Permanently remove training program{' '}
                <strong>
                  {deletingProgram.prog.programCode} — {deletingProgram.prog.title}
                </strong>
                ?
              </div>

              {(deletingProgram.nomCount > 0 || deleteProgramError) && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-2 text-[11px]">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    {deleteProgramError ||
                      `Cannot delete while ${deletingProgram.nomCount} officer nomination(s) are linked to this course. Withdraw nominations first.`}
                  </span>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDeletingProgram(null);
                  setDeleteProgramError('');
                }}
                className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingProgram.nomCount > 0}
                onClick={handleConfirmDeleteProgram}
                className="px-4 py-2 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* EDIT / EVALUATE NOMINATION SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(editingNomination)}
        onClose={() => setEditingNomination(null)}
        title="Edit & Evaluate Training Nomination"
        subtitle="Certification, Completion Status & Rating"
        icon={<Award className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {editingNomination && (
          <form onSubmit={handleSaveNominationEdit} className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nomination Status</label>
                <SearchableSelect
                  value={editNomStatus}
                  onChange={(val) => setEditNomStatus(val as TrainingNomination['status'])}
                  options={[
                    { value: 'Nominated', label: 'Nominated' },
                    { value: 'Approved', label: 'Approved' },
                    { value: 'Attending', label: 'Attending' },
                    { value: 'Completed', label: 'Completed' },
                    { value: 'Certified', label: 'Certified' },
                  ]}
                  placeholder="Select status..."
                  searchPlaceholder="Filter statuses..."
                  buttonClassName="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 h-10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Evaluation Score (1–5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.5"
                    placeholder="e.g. 4.5"
                    value={editNomScore}
                    onChange={(e) => setEditNomScore(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Certificate Number</label>
                  <input
                    type="text"
                    placeholder="e.g. GIMPA-2026-014"
                    value={editNomCertNo}
                    onChange={(e) => setEditNomCertNo(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Evaluation Feedback Notes</label>
                <textarea
                  rows={3}
                  value={editNomNotes}
                  onChange={(e) => setEditNomNotes(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingNomination(null)}
                className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold"
              >
                Save Nomination Update
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* DELETE NOMINATION SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(deletingNomination)}
        onClose={() => setDeletingNomination(null)}
        title="Withdraw Training Nomination"
        subtitle={deletingNomination?.staffName}
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingNomination && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5">
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
                Withdraw and remove <strong>{deletingNomination.staffName}</strong> from{' '}
                <strong>{deletingNomination.progTitle}</strong>?
              </div>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingNomination(null)}
                className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteNomination}
                className="px-4 py-2 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold"
              >
                Confirm Withdrawal
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>
    </div>
  );
};
