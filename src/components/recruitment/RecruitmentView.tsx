/**
 * Haros HRMIS - Recruitment and Appointment Processing View
 * Implements Vacancy Tracking, Applicant Records, Interview Scoring, Selection,
 * and One-Click Automated Appointment Processing without double entry.
 */

import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  Plus,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  GraduationCap,
  Briefcase,
  ChevronRight,
  ArrowRight,
  Send,
  Eye,
  Check,
  Scale,
  Calendar,
  Phone,
  Mail,
  Award,
  Sparkles,
  Edit2,
  Trash2,
} from 'lucide-react';
import { db } from '../../db/storage';
import { notificationService } from '../../services/notifications/notificationService';
import { useAuth } from '../../context/AuthContext';
import {
  RecruitmentApplicant,
  EmployeeCategory,
  Gender,
  Department,
  Mda,
  GradeLevel,
  EmploymentType,
} from '../../types';
import { SearchableSelect } from '../common/SearchableSelect';
import { SlideOverPanel } from '../common/SlideOverPanel';

interface RecruitmentViewProps {
  onSelectEmployee?: (empId: number) => void;
}

export const RecruitmentView: React.FC<RecruitmentViewProps> = ({ onSelectEmployee }) => {
  const { currentUser, hasPermission } = useAuth();
  const [dataVersion, setDataVersion] = useState(0);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCadre, setFilterCadre] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMdaId, setFilterMdaId] = useState<string>('all');

  // Modals state
  const [showAddApplicantModal, setShowAddApplicantModal] = useState(false);
  const [editingApplicant, setEditingApplicant] = useState<RecruitmentApplicant | null>(null);
  const [deletingApplicant, setDeletingApplicant] = useState<RecruitmentApplicant | null>(null);
  const [selectedApplicantForScore, setSelectedApplicantForScore] = useState<RecruitmentApplicant | null>(null);
  const lastScoreApplicantRef = React.useRef<RecruitmentApplicant | null>(null);
  if (selectedApplicantForScore) {
    lastScoreApplicantRef.current = selectedApplicantForScore;
  }
  const activeScoreApplicant = selectedApplicantForScore || lastScoreApplicantRef.current;

  const [selectedApplicantForAppoint, setSelectedApplicantForAppoint] = useState<RecruitmentApplicant | null>(null);
  const lastAppointApplicantRef = React.useRef<RecruitmentApplicant | null>(null);
  if (selectedApplicantForAppoint) {
    lastAppointApplicantRef.current = selectedApplicantForAppoint;
  }
  const activeAppointApplicant = selectedApplicantForAppoint || lastAppointApplicantRef.current;

  const [appointmentLetterPreview, setAppointmentLetterPreview] = useState<{
    applicant: RecruitmentApplicant;
    staffId: string;
    date: string;
  } | null>(null);
  const lastWarrantPreviewRef = React.useRef<{
    applicant: RecruitmentApplicant;
    staffId: string;
    date: string;
  } | null>(null);
  if (appointmentLetterPreview) {
    lastWarrantPreviewRef.current = appointmentLetterPreview;
  }
  const activeWarrantPreview = appointmentLetterPreview || lastWarrantPreviewRef.current;

  // Fetch data
  const applicants = useMemo(() => db.getRecruitmentApplicants(), [dataVersion]);
  const mdas = useMemo(() => db.getMdas(), []);
  const departments = useMemo(() => db.getDepartments(), [dataVersion]);
  const gradeLevels = useMemo(() => db.getGradeLevels(), []);
  const establishments = useMemo(() => db.getEstablishmentPositions(), [dataVersion]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = applicants.length;
    const shortlisted = applicants.filter((a) => a.status === 'Shortlisted').length;
    const selected = applicants.filter((a) => a.status === 'Selected').length;
    const appointed = applicants.filter((a) => a.status === 'Appointed').length;
    const professional = applicants.filter((a) => a.cadreCategory === 'Professional').length;
    const subProfessional = applicants.filter((a) => a.cadreCategory === 'Sub-Professional').length;
    return { total, shortlisted, selected, appointed, professional, subProfessional };
  }, [applicants]);

  // Filtered applicants
  const filteredApplicants = useMemo(() => {
    return applicants.filter((app) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchNum = app.applicantNumber.toLowerCase().includes(q);
        const matchName = `${app.firstName} ${app.surname}`.toLowerCase().includes(q);
        const matchTitle = app.vacancyPositionTitle.toLowerCase().includes(q);
        const matchNin = app.nationalIdentificationNumber?.toLowerCase().includes(q) || false;
        if (!matchNum && !matchName && !matchTitle && !matchNin) return false;
      }

      if (filterCadre !== 'all' && app.cadreCategory !== filterCadre) return false;
      if (filterStatus !== 'all' && app.status !== filterStatus) return false;
      if (filterMdaId !== 'all' && app.mdaId.toString() !== filterMdaId) return false;

      return true;
    });
  }, [applicants, searchTerm, filterCadre, filterStatus, filterMdaId]);

  // Form State for Adding an Applicant
  const [formFirstName, setFormFirstName] = useState('');
  const [formSurname, setFormSurname] = useState('');
  const [formOtherNames, setFormOtherNames] = useState('');
  const [formGender, setFormGender] = useState<Gender>('Male');
  const [formDob, setFormDob] = useState('1996-05-15');
  const [formNin, setFormNin] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formMdaId, setFormMdaId] = useState<number>(mdas[0]?.id || 1);
  const [formDeptId, setFormDeptId] = useState<number>(departments[0]?.id || 1);
  const [formGradeId, setFormGradeId] = useState<number>(gradeLevels[0]?.id || 1);
  const [formCadre, setFormCadre] = useState<EmployeeCategory>('Professional');
  const [formHighestQual, setFormHighestQual] = useState('');
  const [formInstitution, setFormInstitution] = useState('');
  const [formExpYears, setFormExpYears] = useState<number>(2);

  const handleOpenAddApplicant = () => {
    setEditingApplicant(null);
    setFormFirstName('');
    setFormSurname('');
    setFormOtherNames('');
    setFormGender('Male');
    setFormDob('1996-05-15');
    setFormNin(`GHA-${Math.floor(100000000 + Math.random() * 900000000)}-${Math.floor(1 + Math.random() * 9)}`);
    setFormPhone('+233 24 000 0000');
    setFormEmail('');
    setFormTitle('Assistant Administrative Officer');
    setFormMdaId(mdas[0]?.id || 1);
    setFormDeptId(departments[0]?.id || 1);
    setFormGradeId(gradeLevels[3]?.id || 4);
    setFormCadre('Professional');
    setFormHighestQual('Bachelor of Science / Arts');
    setFormInstitution('University of Ghana');
    setFormExpYears(2);
    setShowAddApplicantModal(true);
  };

  const handleOpenEditApplicant = (app: RecruitmentApplicant) => {
    setEditingApplicant(app);
    setFormFirstName(app.firstName);
    setFormSurname(app.surname);
    setFormOtherNames(app.otherNames || '');
    setFormGender(app.gender);
    setFormDob(app.dateOfBirth);
    setFormNin(app.nationalIdentificationNumber || '');
    setFormPhone(app.telephoneNumber);
    setFormEmail(app.emailAddress);
    setFormTitle(app.vacancyPositionTitle);
    setFormMdaId(app.mdaId);
    setFormDeptId(app.departmentId);
    setFormGradeId(app.gradeId);
    setFormCadre(app.cadreCategory);
    setFormHighestQual(app.highestQualification);
    setFormInstitution(app.institutionName);
    setFormExpYears(app.yearsOfExperience);
    setShowAddApplicantModal(true);
  };

  const handleSaveApplicant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFirstName.trim() || !formSurname.trim() || !formTitle.trim()) return;

    const payload = {
      vacancyPositionTitle: formTitle.trim(),
      departmentId: formDeptId,
      mdaId: formMdaId,
      gradeId: formGradeId,
      cadreCategory: formCadre,
      firstName: formFirstName.trim(),
      surname: formSurname.trim(),
      otherNames: formOtherNames.trim() || undefined,
      gender: formGender,
      dateOfBirth: formDob,
      nationalIdentificationNumber: formNin.trim(),
      telephoneNumber: formPhone.trim(),
      emailAddress: formEmail.trim(),
      highestQualification: formHighestQual.trim(),
      institutionName: formInstitution.trim(),
      yearsOfExperience: formExpYears,
    };

    if (editingApplicant) {
      db.updateRecruitmentApplicant(
        editingApplicant.id,
        payload,
        currentUser?.username || 'admin'
      );
    } else {
      db.createRecruitmentApplicant(payload, currentUser?.username || 'admin');
    }

    setEditingApplicant(null);
    setShowAddApplicantModal(false);
    setDataVersion((v) => v + 1);
  };

  const handleConfirmDeleteApplicant = () => {
    if (!deletingApplicant) return;
    const res = db.deleteRecruitmentApplicant(deletingApplicant.id, currentUser?.username || 'admin');
    if (!res.success) {
      notificationService.error('Cannot Remove Candidate', res.message, {
        module: 'Recruitment & Appointments',
        actor: currentUser?.username,
      });
    }
    setDeletingApplicant(null);
    setDataVersion((v) => v + 1);
  };

  // Interview Scoring Form State
  const [scoreVal, setScoreVal] = useState<number>(85);
  const [scoreNotes, setScoreNotes] = useState('');
  const [scoreStatus, setScoreStatus] = useState<'Shortlisted' | 'Interviewed' | 'Selected' | 'Rejected'>('Selected');

  const handleOpenScoreModal = (app: RecruitmentApplicant) => {
    setSelectedApplicantForScore(app);
    setScoreVal(app.interviewScore || 85);
    setScoreNotes(app.interviewNotes || '');
    setScoreStatus(app.status === 'Applied' || app.status === 'Shortlisted' ? 'Selected' : (app.status as any));
  };

  const handleSaveScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplicantForScore) return;

    db.updateRecruitmentApplicant(
      selectedApplicantForScore.id,
      {
        interviewScore: scoreVal,
        interviewNotes: scoreNotes.trim(),
        interviewDate: new Date().toISOString().slice(0, 10),
        status: scoreStatus,
      },
      currentUser?.username || 'admin'
    );

    setSelectedApplicantForScore(null);
    setDataVersion((v) => v + 1);
  };

  // Appointment Processing Form State
  const [appointStaffId, setAppointStaffId] = useState('');
  const [appointEmpType, setAppointEmpType] = useState<EmploymentType>('Permanent & Pensionable');
  const [appointFirstApptDate, setAppointFirstApptDate] = useState(new Date().toISOString().slice(0, 10));
  const [appointDutyDate, setAppointDutyDate] = useState(new Date().toISOString().slice(0, 10));
  const [appointSalaryStep, setAppointSalaryStep] = useState<number>(1);

  const handleOpenAppointModal = (app: RecruitmentApplicant) => {
    setSelectedApplicantForAppoint(app);
    setAppointStaffId(`EMP-${Math.floor(10000 + Math.random() * 90000)}`);
    setAppointEmpType('Permanent & Pensionable');
    setAppointFirstApptDate(new Date().toISOString().slice(0, 10));
    setAppointDutyDate(new Date().toISOString().slice(0, 10));
    setAppointSalaryStep(1);
  };

  const handleExecuteAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplicantForAppoint) return;

    const result = db.appointApplicantToStaff(
      selectedApplicantForAppoint.id,
      {
        staffId: appointStaffId.trim().toUpperCase(),
        employmentType: appointEmpType,
        dateOfFirstAppointment: appointFirstApptDate,
        dateOfAssumptionOfDuty: appointDutyDate,
        salaryStep: appointSalaryStep,
      },
      currentUser?.username || 'admin'
    );

    // Show Appointment Warrant Letter Preview
    setAppointmentLetterPreview({
      applicant: selectedApplicantForAppoint,
      staffId: appointStaffId.trim().toUpperCase(),
      date: appointFirstApptDate,
    });

    setSelectedApplicantForAppoint(null);
    setDataVersion((v) => v + 1);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Applicant No',
      'Full Name',
      'Gender',
      'Cadre Category',
      'Applied Position',
      'Highest Qualification',
      'Interview Score',
      'Application Date',
      'Status',
      'Appointed Staff ID',
    ];

    const rows = filteredApplicants.map((a) => {
      const appointedEmp = a.appointedEmployeeId ? db.getEmployeeById(a.appointedEmployeeId) : null;

      return [
        `"${a.applicantNumber}"`,
        `"${a.firstName} ${a.surname}"`,
        `"${a.gender}"`,
        `"${a.cadreCategory}"`,
        `"${a.vacancyPositionTitle}"`,
        `"${a.highestQualification}"`,
        a.interviewScore || 'N/A',
        `"${a.applicationDate}"`,
        `"${a.status}"`,
        `"${appointedEmp?.staffId || ''}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Recruitment_Applicants_Register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notificationService.success(
      'Recruitment Register Exported',
      `Exported ${filteredApplicants.length} applicant record(s) to CSV.`,
      { module: 'Recruitment & Appointments', actor: currentUser?.username }
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Staff Administration</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-blue-700">Recruitment & Appointments</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 flex items-center">
            <UserPlus className="w-5 h-5 mr-2 text-blue-700" />
            Recruitment & Civil Service Appointment Processing
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Applicant tracking, interview evaluation, selection, and one-click conversion to employee records without double entry.
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

          {hasPermission('recruitment.manage') && (
            <button
              onClick={handleOpenAddApplicant}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Candidate</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Applicants</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Civil Service applicants on file</div>
        </div>

        <div className="bg-blue-50/60 rounded-lg border border-blue-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-blue-800 uppercase flex items-center justify-between">
            <span>Professional Track</span>
            <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-1">{metrics.professional}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">Degree / Officer cadre</div>
        </div>

        <div className="bg-amber-50/60 rounded-lg border border-amber-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-800 uppercase flex items-center justify-between">
            <span>Sub-Professional</span>
            <Briefcase className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{metrics.subProfessional}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">Technical & Executive cadre</div>
        </div>

        <div className="bg-purple-50/60 rounded-lg border border-purple-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-purple-800 uppercase flex items-center justify-between">
            <span>Selected for Appt.</span>
            <Award className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-900 mt-1">{metrics.selected}</div>
          <div className="text-[10px] text-purple-700 mt-0.5">Awaiting appointment warrant</div>
        </div>

        <div className="bg-emerald-50/60 rounded-lg border border-emerald-200 p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-800 uppercase flex items-center justify-between">
            <span>Appointed Officers</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{metrics.appointed}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Converted directly into staff</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by applicant number (e.g. APP-2026-0101), candidate name, applied post, or NIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-500 shrink-0">
            <span>Showing:</span>
            <span className="font-bold text-slate-800">{filteredApplicants.length}</span>
            <span>of {applicants.length} candidates</span>
          </div>
        </div>

        {/* Dropdowns */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Cadre Filter: Professional vs Sub-Professional */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Cadre Categorization
            </label>
            <SearchableSelect
              value={filterCadre}
              onChange={(val) => setFilterCadre(val)}
              options={[
                { value: 'all', label: 'All Cadre Streams' },
                { value: 'Professional', label: 'Professional Cadre', badge: 'Tier 1' },
                { value: 'Sub-Professional', label: 'Sub-Professional Cadre', badge: 'Tier 2' },
                { value: 'Technical', label: 'Technical Cadre' },
                { value: 'Administrative', label: 'Administrative Cadre' },
              ]}
              placeholder="All Cadres"
              searchPlaceholder="Filter cadres..."
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Recruitment Status
            </label>
            <SearchableSelect
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'Applied', label: 'Applied' },
                { value: 'Shortlisted', label: 'Shortlisted' },
                { value: 'Interviewed', label: 'Interviewed' },
                { value: 'Selected', label: 'Selected for Appointment' },
                { value: 'Appointed', label: 'Appointed & Onboarded' },
                { value: 'Rejected', label: 'Rejected' },
              ]}
              placeholder="All Statuses"
              searchPlaceholder="Filter statuses..."
            />
          </div>

          {/* MDA */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Hiring MDA
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

      {/* Applicant Grid */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
                <th className="p-3">Applicant No</th>
                <th className="p-3">Candidate Name</th>
                <th className="p-3">Cadre Stream</th>
                <th className="p-3">Applied Position & MDA</th>
                <th className="p-3">Qualifications</th>
                <th className="p-3 text-center">Interview Score</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredApplicants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-slate-600">No applicants found matching criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredApplicants.map((app) => {
                  const mda = mdas.find((m) => m.id === app.mdaId);
                  const dept = departments.find((d) => d.id === app.departmentId);
                  const isProf = app.cadreCategory === 'Professional';
                  const isSubProf = app.cadreCategory === 'Sub-Professional';
                  const appointedEmp = app.appointedEmployeeId ? db.getEmployeeById(app.appointedEmployeeId) : null;

                  return (
                    <tr key={app.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {app.applicantNumber}
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-slate-900">
                          {app.firstName} {app.otherNames ? `${app.otherNames} ` : ''}{app.surname}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center space-x-2">
                          <span>{app.gender}</span>
                          <span>•</span>
                          <span>{app.telephoneNumber}</span>
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        {isProf ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            <GraduationCap className="w-3 h-3 mr-1" />
                            Professional
                          </span>
                        ) : isSubProf ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            <Briefcase className="w-3 h-3 mr-1" />
                            Sub-Professional
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">
                            {app.cadreCategory}
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{app.vacancyPositionTitle}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {dept?.departmentName} ({mda?.code})
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="text-slate-800 font-medium">{app.highestQualification}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-xs">{app.institutionName}</div>
                      </td>

                      <td className="p-3 text-center whitespace-nowrap">
                        {app.interviewScore !== undefined ? (
                          <span
                            className={`font-black text-xs px-2 py-0.5 rounded ${
                              app.interviewScore >= 80
                                ? 'bg-emerald-100 text-emerald-800'
                                : app.interviewScore >= 60
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {app.interviewScore}%
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">Not Scored</span>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            app.status === 'Appointed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : app.status === 'Selected'
                              ? 'bg-purple-100 text-purple-800'
                              : app.status === 'Shortlisted'
                              ? 'bg-blue-100 text-blue-800'
                              : app.status === 'Applied'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              app.status === 'Appointed'
                                ? 'bg-emerald-500'
                                : app.status === 'Selected'
                                ? 'bg-purple-500'
                                : app.status === 'Shortlisted'
                                ? 'bg-blue-500'
                                : app.status === 'Applied'
                                ? 'bg-slate-400'
                                : 'bg-red-500'
                            }`}
                          ></span>
                          {app.status === 'Appointed' && appointedEmp
                            ? `Appointed (${appointedEmp.staffId})`
                            : app.status}
                        </span>
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1">
                          {app.status !== 'Appointed' && hasPermission('recruitment.manage') && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditApplicant(app)}
                                title="Edit Candidate Profile"
                                className="p-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingApplicant(app)}
                                title="Delete Candidate Record"
                                className="p-1 rounded bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {app.status !== 'Appointed' && hasPermission('recruitment.score') && (
                            <button
                              onClick={() => handleOpenScoreModal(app)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                            >
                              Score / Status
                            </button>
                          )}

                          {app.status === 'Selected' && hasPermission('recruitment.appoint') && (
                            <button
                              onClick={() => handleOpenAppointModal(app)}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-xs"
                            >
                              Appoint & Onboard
                            </button>
                          )}

                          {app.status === 'Appointed' && appointedEmp && onSelectEmployee && (
                            <button
                              onClick={() => onSelectEmployee(appointedEmp.id)}
                              className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-700 hover:text-white text-blue-700 font-semibold transition-colors"
                            >
                              View Staff Dossier
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTER / EDIT CANDIDATE SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={showAddApplicantModal}
        onClose={() => {
          setShowAddApplicantModal(false);
          setEditingApplicant(null);
        }}
        title={
          editingApplicant
            ? `Edit Candidate: ${editingApplicant.applicantNumber}`
            : 'Register Civil Service Candidate'
        }
        subtitle={
          editingApplicant
            ? 'Recruitment & Appointment Processing • Update Applicant Profile'
            : 'Recruitment & Appointment Processing • New Applicant Record'
        }
        icon={editingApplicant ? <Edit2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
        maxWidthClass="max-w-2xl"
        overlayClassName="bg-black/40"
      >
        <form onSubmit={handleSaveApplicant} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Names */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formFirstName}
                  onChange={(e) => setFormFirstName(e.target.value)}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Surname <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formSurname}
                  onChange={(e) => setFormSurname(e.target.value)}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Other Names
                </label>
                <input
                  type="text"
                  value={formOtherNames}
                  onChange={(e) => setFormOtherNames(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Bio & Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gender</label>
                <select
                  value={formGender}
                  onChange={(e) => setFormGender(e.target.value as Gender)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formDob}
                  onChange={(e) => setFormDob(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Telephone Number</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">National ID (NIN / Ghana Card)</label>
                <input
                  type="text"
                  value={formNin}
                  onChange={(e) => setFormNin(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Applied Position & Cadre Stream */}
            <div className="p-3.5 bg-slate-50 rounded border border-slate-200 space-y-3">
              <div className="text-[10px] font-semibold text-slate-600 uppercase">Target Post & Cadre Stream:</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    Applied Position Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Assistant Budget Analyst"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    required
                    className="w-full p-2 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-blue-800 mb-1 uppercase">
                    Cadre Stream <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formCadre}
                    onChange={(e) => setFormCadre(e.target.value as EmployeeCategory)}
                    className="w-full p-2 bg-blue-50/50 border border-blue-200 rounded text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  >
                    <option value="Professional">Professional Cadre (Degree / Officer)</option>
                    <option value="Sub-Professional">Sub-Professional Cadre (HND / Technical / Clerical)</option>
                    <option value="Technical">Technical Cadre</option>
                    <option value="Administrative">Administrative Cadre</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Hiring MDA</label>
                  <select
                    value={formMdaId}
                    onChange={(e) => {
                      const mdaId = parseInt(e.target.value);
                      setFormMdaId(mdaId);
                      const firstDept = departments.find((d) => d.mdaId === mdaId);
                      if (firstDept) setFormDeptId(firstDept.id);
                    }}
                    className="w-full p-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  >
                    {mdas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} - {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Target Department</label>
                  <select
                    value={formDeptId}
                    onChange={(e) => setFormDeptId(parseInt(e.target.value))}
                    className="w-full p-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  >
                    {departments
                      .filter((d) => d.mdaId === formMdaId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.departmentCode} - {d.departmentName}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Entry Grade Level</label>
                  <select
                    value={formGradeId}
                    onChange={(e) => setFormGradeId(parseInt(e.target.value))}
                    className="w-full p-1.5 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  >
                    {gradeLevels.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.gradeName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Qualifications */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Highest Academic Qualification
                </label>
                <input
                  type="text"
                  placeholder="e.g. BSc Computer Science, HND Accounting"
                  value={formHighestQual}
                  onChange={(e) => setFormHighestQual(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Institution Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. University of Ghana"
                  value={formInstitution}
                  onChange={(e) => setFormInstitution(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Years of Relevant Experience
                </label>
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={formExpYears}
                  onChange={(e) => setFormExpYears(parseInt(e.target.value) || 0)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowAddApplicantModal(false);
                setEditingApplicant(null);
              }}
              className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs transition-colors"
            >
              {editingApplicant ? 'Save Candidate Changes' : 'Save Applicant Record'}
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* SCORE & STATUS SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(selectedApplicantForScore)}
        onClose={() => setSelectedApplicantForScore(null)}
        title="Interview Score & Selection Status"
        subtitle={
          activeScoreApplicant
            ? `${activeScoreApplicant.applicantNumber} • ${activeScoreApplicant.vacancyPositionTitle}`
            : undefined
        }
        icon={<Award className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {activeScoreApplicant && (
          <form onSubmit={handleSaveScore} className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-semibold text-slate-900">
                  {activeScoreApplicant.firstName} {activeScoreApplicant.surname}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {activeScoreApplicant.applicantNumber} • {activeScoreApplicant.vacancyPositionTitle}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Interview Evaluation Score (0 - 100%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scoreVal}
                  onChange={(e) => setScoreVal(parseInt(e.target.value) || 0)}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Recruitment / Selection Status
                </label>
                <select
                  value={scoreStatus}
                  onChange={(e) => setScoreStatus(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                >
                  <option value="Shortlisted">Shortlisted</option>
                  <option value="Interviewed">Interviewed</option>
                  <option value="Selected">Selected for Appointment</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Interview Committee Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Record panel notes, technical aptitude, and civil service readiness..."
                  value={scoreNotes}
                  onChange={(e) => setScoreNotes(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedApplicantForScore(null)}
                className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs transition-colors"
              >
                Save Assessment
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* APPOINTMENT PROCESSING SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(selectedApplicantForAppoint)}
        onClose={() => setSelectedApplicantForAppoint(null)}
        title="Civil Service Appointment Processing & Onboarding"
        subtitle={
          activeAppointApplicant
            ? `${activeAppointApplicant.applicantNumber} • ${activeAppointApplicant.vacancyPositionTitle}`
            : undefined
        }
        icon={<Sparkles className="w-4 h-4" />}
        maxWidthClass="max-w-lg"
        overlayClassName="bg-black/40"
      >
        {activeAppointApplicant && (
          <form onSubmit={handleExecuteAppointment} className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-3 bg-emerald-50/60 rounded border border-emerald-200 space-y-1">
                <div className="text-[10px] uppercase font-bold text-emerald-800">Selected Candidate:</div>
                <div className="font-bold text-slate-900 text-sm">
                  {activeAppointApplicant.firstName} {activeAppointApplicant.surname}
                </div>
                <div className="text-[11px] text-slate-600">
                  Target Post: <strong>{activeAppointApplicant.vacancyPositionTitle}</strong> • Cadre:{' '}
                  <strong>{activeAppointApplicant.cadreCategory}</strong>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Assign Civil Service Staff ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={appointStaffId}
                  onChange={(e) => setAppointStaffId(e.target.value)}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-blue-700 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Terms of Appointment <span className="text-red-500">*</span>
                </label>
                <select
                  value={appointEmpType}
                  onChange={(e) => setAppointEmpType(e.target.value as EmploymentType)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                >
                  <option value="Permanent & Pensionable">Permanent & Pensionable (Subject to 1 yr probation)</option>
                  <option value="Fixed-Term Contract">Fixed-Term Contract</option>
                  <option value="Casual">Casual</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Date of First Appointment <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={appointFirstApptDate}
                    onChange={(e) => setAppointFirstApptDate(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Assumption of Duty Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={appointDutyDate}
                    onChange={(e) => setAppointDutyDate(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Initial Salary Step on SSSS Scale <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={appointSalaryStep}
                  onChange={(e) => setAppointSalaryStep(parseInt(e.target.value) || 1)}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-blue-50/60 rounded border border-blue-200 text-[11px] text-blue-800">
                Notice: Converted officer record will automatically inherit candidate personal data, national ID, academic credentials, and departmental placement without requiring redundant data entry.
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedApplicantForAppoint(null)}
                className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Issue Warrant & Onboard Staff</span>
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* APPOINTMENT WARRANT LETTER PREVIEW SLIDING DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(appointmentLetterPreview)}
        onClose={() => setAppointmentLetterPreview(null)}
        title="Official Warrant of Appointment Issued"
        subtitle={
          activeWarrantPreview
            ? `Ref: OHCS/APPT/${new Date().getFullYear()}/${activeWarrantPreview.staffId}`
            : undefined
        }
        icon={<FileText className="w-4 h-4" />}
        maxWidthClass="max-w-xl"
        overlayClassName="bg-black/40"
      >
        {activeWarrantPreview && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-6 bg-white space-y-4 font-serif text-slate-800 leading-relaxed">
              <div className="text-center border-b border-slate-300 pb-3 font-sans">
                <div className="font-bold uppercase tracking-wider text-slate-900 text-sm">
                  REPUBLIC OF GHANA CIVIL SERVICE
                </div>
                <div className="text-xs text-slate-500 font-semibold">
                  OFFICE OF THE HEAD OF CIVIL SERVICE (OHCS)
                </div>
                <div className="text-[10px] text-slate-400">
                  Ref No: OHCS/APPT/{new Date().getFullYear()}/{activeWarrantPreview.staffId}
                </div>
              </div>

              <div className="flex justify-between text-[11px] font-sans">
                <div>
                  <strong>To:</strong> {activeWarrantPreview.applicant.firstName} {activeWarrantPreview.applicant.surname}
                  <br />
                  <strong>Address:</strong> Residential File Archive
                  <br />
                  <strong>NIN / Ghana Card:</strong>{' '}
                  {activeWarrantPreview.applicant.nationalIdentificationNumber || 'Verified'}
                </div>
                <div>
                  <strong>Date:</strong> {activeWarrantPreview.date}
                </div>
              </div>

              <div className="font-bold uppercase underline font-sans text-xs text-center pt-2">
                OFFICIAL OFFER OF APPOINTMENT: {activeWarrantPreview.applicant.vacancyPositionTitle}
              </div>

              <p>
                I have the pleasure to inform you that, in accordance with the advice of the Public Services Commission,
                you have been offered appointment into the Civil Service as{' '}
                <strong>{activeWarrantPreview.applicant.vacancyPositionTitle}</strong> in the
                <strong> {activeWarrantPreview.applicant.cadreCategory} Cadre</strong>.
              </p>

              <p>
                Your Staff Identification Number is{' '}
                <strong className="font-mono text-blue-700">{activeWarrantPreview.staffId}</strong>. You are posted to{' '}
                <strong>
                  {departments.find((d) => d.id === activeWarrantPreview.applicant.departmentId)?.departmentName}
                </strong>{' '}
                with effect from your assumption of duty.
              </p>

              <div className="pt-4 flex justify-between items-end font-sans text-[11px]">
                <div>
                  <div className="font-bold text-slate-900">Dr. Evans Quartey</div>
                  <div className="text-slate-500">For: Head of Civil Service</div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-bold font-mono text-[10px]">
                    STATUS: ACTIVE ON PROBATION
                  </span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setAppointmentLetterPreview(null)}
                className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold text-xs transition-colors"
              >
                Close Warrant
              </button>

              {onSelectEmployee && (
                <button
                  type="button"
                  onClick={() => {
                    const allEmp = db.getEmployees();
                    const newEmp = allEmp.find((e) => e.staffId === activeWarrantPreview.staffId);
                    setAppointmentLetterPreview(null);
                    if (newEmp) {
                      onSelectEmployee(newEmp.id);
                    }
                  }}
                  className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  Open Newly Created Employee Dossier →
                </button>
              )}
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* DELETE CANDIDATE CONFIRMATION DRAWER */}
      <SlideOverPanel
        isOpen={Boolean(deletingApplicant)}
        onClose={() => setDeletingApplicant(null)}
        title="Remove Candidate Record"
        subtitle={deletingApplicant?.applicantNumber}
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingApplicant && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
                Permanently delete applicant{' '}
                <strong>
                  {deletingApplicant.firstName} {deletingApplicant.surname}
                </strong>{' '}
                (<span className="font-mono">{deletingApplicant.applicantNumber}</span>) from the recruitment pipeline?
              </div>
              <p className="text-[11px] text-slate-600">
                Candidates already appointed to the Nominal Roll are protected and cannot be removed.
              </p>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingApplicant(null)}
                className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteApplicant}
                className="px-4 py-2 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>
    </div>
  );
};
