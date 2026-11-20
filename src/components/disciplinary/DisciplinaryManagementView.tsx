/**
 * Haros HRMIS - Disciplinary Management Module (Section 15)
 * Strict Confidentiality RBAC, Allegation Registers, Disciplinary Committee Dockets,
 * Hearing Findings, Civil Service Statutory Sanctions, and Audit Trails.
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  ShieldAlert,
  Plus,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
  Gavel,
  Calendar,
  Building2,
  ChevronRight,
  User,
  Users,
  Eye,
  Check,
  X,
  Printer,
  Shield,
  AlertTriangle,
  Scale,
  FileCheck,
  Edit2,
  Trash2,
} from 'lucide-react';
import { db } from '../../db/storage';
import { notificationService } from '../../services/notifications/notificationService';
import { useAuth } from '../../context/AuthContext';
import {
  DisciplinaryCase,
  DisciplinaryOffence,
  DisciplinarySanction,
  DisciplinaryCaseStatus,
  Employee,
  Department,
  GradeLevel,
} from '../../types';
import { SearchableSelect } from '../common/SearchableSelect';
import { SlideOverPanel } from '../common/SlideOverPanel';
import { BrandCrest } from '../common/BrandCrest';
import { useInstitutionInfo } from '../../hooks/useInstitutionInfo';

interface DisciplinaryManagementViewProps {
  onSelectEmployee?: (empId: number) => void;
}

export const DisciplinaryManagementView: React.FC<DisciplinaryManagementViewProps> = ({
  onSelectEmployee,
}) => {
  const { currentUser, currentRole, hasPermission, canAccessModule } = useAuth();
  const { institutionName, institutionCountry } = useInstitutionInfo();
  const [dataVersion, setDataVersion] = useState(0);

  // Confidentiality Barrier Check (Section 15 & 19)
  const canAccessDisciplinary =
    canAccessModule('disciplinary') ||
    hasPermission('DISCIPLINARY_MANAGE') ||
    hasPermission('DISCIPLINARY_VIEW') ||
    hasPermission('CONFIDENTIAL_VIEW') ||
    hasPermission('ALL');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [offenceFilter, setOffenceFilter] = useState<string>('All');

  // Modals & Previews
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [selectedCaseForReview, setSelectedCaseForReview] = useState<DisciplinaryCase | null>(null);
  const lastReviewCaseRef = useRef<DisciplinaryCase | null>(null);
  if (selectedCaseForReview) lastReviewCaseRef.current = selectedCaseForReview;
  const activeReviewCase = selectedCaseForReview || lastReviewCaseRef.current;

  const [editingCase, setEditingCase] = useState<DisciplinaryCase | null>(null);
  const [deletingCase, setDeletingCase] = useState<DisciplinaryCase | null>(null);

  const [previewDocketCase, setPreviewDocketCase] = useState<DisciplinaryCase | null>(null);
  const lastPreviewDocketRef = useRef<DisciplinaryCase | null>(null);
  if (previewDocketCase) lastPreviewDocketRef.current = previewDocketCase;
  const activePreviewDocket = previewDocketCase || lastPreviewDocketRef.current;

  // Data fetching
  const disciplinaryCases = useMemo(() => {
    return db.getDisciplinaryCases(undefined, !canAccessDisciplinary);
  }, [canAccessDisciplinary, dataVersion]);

  const employees = useMemo(() => db.getEmployees(), [dataVersion]);
  const departments = useMemo(() => db.getDepartments(), []);
  const gradeLevels = useMemo(() => db.getGradeLevels(), []);

  // Filtered cases
  const filteredCases = useMemo(() => {
    return disciplinaryCases.filter((c) => {
      const emp = db.getEmployeeById(c.employeeId);
      const personal = db.getEmployeePersonalInfo(c.employeeId);
      const name = personal?.fullName || `${personal?.firstName} ${personal?.surname}`;

      const matchSearch =
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp?.staffId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.caseReference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.allegationSummary.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'All' || c.caseStatus === statusFilter;
      const matchOffence = offenceFilter === 'All' || c.natureOfOffence === offenceFilter;

      return matchSearch && matchStatus && matchOffence;
    });
  }, [disciplinaryCases, searchTerm, statusFilter, offenceFilter]);

  // Confidentiality Lock Screen
  if (!canAccessDisciplinary) {
    return (
      <div className="p-8 max-w-4xl mx-auto my-12 bg-white rounded-xl border border-slate-200 shadow-sm text-center space-y-4">
        <div className="w-14 h-14 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Restricted Confidential Records: Disciplinary Dockets</h2>
        <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
          Disciplinary inquiries, investigation reports, and sanction recommendations are classified state records
          under Section 15 of the Civil Service Master Directives and Civil Service Commission Regulations.
          Access is limited to the Disciplinary Committee, HR Director, and System Administrators.
        </p>
        <div className="p-3 bg-slate-50 rounded-lg inline-block text-xs font-mono text-slate-700 border border-slate-200">
          Current Role: <span className="font-bold text-rose-700">{currentRole?.roleName}</span> ({currentUser?.username})
        </div>
        <div className="pt-2">
          <p className="text-[11px] text-slate-400">
            To view this module, switch to <strong>HR Director</strong> or <strong>System Administrator</strong> via the top-right profile switcher.
          </p>
        </div>
      </div>
    );
  }

  const handleExportCsv = () => {
    const headers = [
      'Case Ref',
      'Staff ID',
      'Officer Name',
      'Incident Date',
      'Nature of Offence',
      'Hearing Date',
      'Outcome',
      'Sanction Recommended',
      'Decision Date',
      'Case Status',
    ];

    const rows = filteredCases.map((c) => {
      const emp = db.getEmployeeById(c.employeeId);
      const personal = db.getEmployeePersonalInfo(c.employeeId);
      return [
        c.caseReference,
        emp?.staffId || '',
        `"${personal?.fullName || ''}"`,
        c.incidentDate,
        `"${c.natureOfOffence}"`,
        c.hearingDate || 'N/A',
        c.outcome,
        `"${c.sanctionRecommended || 'None'}"`,
        c.decisionDate || 'N/A',
        c.caseStatus,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Civil_Service_Disciplinary_Register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notificationService.security(
      'Disciplinary Register Exported',
      `Exported ${filteredCases.length} confidential disciplinary docket(s) to CSV.`,
      { module: 'Disciplinary Management', actor: currentUser?.username }
    );
  };

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-5">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-amber-700 text-white flex items-center justify-center shadow-xs">
            <Gavel className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900">Disciplinary Management</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-900 border border-rose-200 flex items-center">
                <Lock className="w-3 h-3 mr-1" />
                Classified Civil Service Records
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Allegation dockets, inquiry committee hearings, statutory sanctions, and appeal records (Section 15)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {hasPermission('DISCIPLINARY_MANAGE') && (
            <button
              onClick={() => setShowNewCaseModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Log Disciplinary Case</span>
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Dockets (CSV)</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Logged Cases
          </span>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{disciplinaryCases.length}</div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Active Investigations
          </span>
          <div className="text-xl font-extrabold text-amber-700 mt-1">
            {disciplinaryCases.filter((c) => c.caseStatus === 'Under Investigation' || c.caseStatus === 'Reported').length}
          </div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Committee Hearings
          </span>
          <div className="text-xl font-extrabold text-blue-700 mt-1">
            {disciplinaryCases.filter((c) => c.caseStatus === 'Committee Hearing').length}
          </div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Sanctions Imposed / Closed
          </span>
          <div className="text-xl font-extrabold text-emerald-700 mt-1">
            {disciplinaryCases.filter((c) => c.caseStatus === 'Sanction Imposed' || c.caseStatus === 'Closed').length}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search reference, officer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs rounded border border-slate-300 bg-white focus:outline-blue-600 w-56 sm:w-64"
            />
          </div>

          <div className="min-w-[150px]">
            <SearchableSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { value: 'All', label: 'All Statuses' },
                { value: 'Reported', label: 'Reported' },
                { value: 'Under Investigation', label: 'Under Investigation' },
                { value: 'Committee Hearing', label: 'Committee Hearing' },
                { value: 'Sanction Imposed', label: 'Sanction Imposed' },
                { value: 'Exonerated', label: 'Exonerated' },
                { value: 'Appealed', label: 'Appealed' },
                { value: 'Closed', label: 'Closed' },
              ]}
              placeholder="All Statuses"
              searchPlaceholder="Filter statuses..."
            />
          </div>

          <div className="min-w-[180px]">
            <SearchableSelect
              value={offenceFilter}
              onChange={(val) => setOffenceFilter(val)}
              options={[
                { value: 'All', label: 'All Offence Categories' },
                { value: 'Insubordination & Disregard of Lawful Order', label: 'Insubordination' },
                { value: 'Gross Misconduct & Civil Disorder', label: 'Gross Misconduct' },
                { value: 'Absence Without Official Leave (AWOL)', label: 'AWOL' },
                { value: 'Financial Malfeasance & Misappropriation', label: 'Financial Malfeasance' },
                { value: 'Breach of Official Oath & Code of Conduct', label: 'Breach of Oath' },
                { value: 'Unauthorized Leakage of Classified Information', label: 'Information Leakage' },
                { value: 'Negligence in the Discharge of Duty', label: 'Negligence' },
              ]}
              placeholder="All Offences"
              searchPlaceholder="Filter offences..."
            />
          </div>
        </div>
      </div>

      {/* Case Dockets Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Case Ref</th>
                <th className="py-2.5 px-3">Officer</th>
                <th className="py-2.5 px-3">Nature of Offence</th>
                <th className="py-2.5 px-3">Incident Date</th>
                <th className="py-2.5 px-3">Hearing Date</th>
                <th className="py-2.5 px-3">Sanction / Outcome</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCases.map((c) => {
                const emp = db.getEmployeeById(c.employeeId);
                const personal = db.getEmployeePersonalInfo(c.employeeId);

                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-900">
                      {c.caseReference}
                      {c.isConfidential && (
                        <span className="ml-1.5 inline-block text-[9px] bg-rose-100 text-rose-800 px-1 rounded font-bold">
                          SECRET
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900 block">{personal?.fullName}</span>
                      <span className="font-mono text-[10px] text-blue-700">{emp?.staffId}</span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 max-w-[200px] truncate" title={c.natureOfOffence}>
                      {c.natureOfOffence}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{c.incidentDate}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{c.hearingDate || 'Pending'}</td>
                    <td className="py-2.5 px-3">
                      {c.sanctionRecommended ? (
                        <span className="font-semibold text-rose-800 text-[11px] block">
                          {c.sanctionRecommended}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Under Adjudication</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.caseStatus === 'Closed' || c.caseStatus === 'Exonerated'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.caseStatus === 'Sanction Imposed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.caseStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => setPreviewDocketCase(c)}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-amber-50 text-amber-800 font-semibold text-[11px] transition-colors"
                        >
                          Docket
                        </button>

                        {hasPermission('DISCIPLINARY_MANAGE') && (
                          <>
                            <button
                              onClick={() => setSelectedCaseForReview(c)}
                              className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-[11px]"
                            >
                              Adjudicate
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCase(c)}
                              title="Edit Case Details"
                              className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingCase(c)}
                              title="Delete Case Docket"
                              className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {onSelectEmployee && (
                          <button
                            onClick={() => onSelectEmployee(c.employeeId)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px]"
                          >
                            Dossier
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No disciplinary cases found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRAWER 1: NEW DISCIPLINARY CASE */}
      <SlideOverPanel
        isOpen={showNewCaseModal}
        onClose={() => setShowNewCaseModal(false)}
        title="Initiate Civil Service Disciplinary Docket"
        subtitle="Confidential Integrity & Conduct Registry"
        icon={<ShieldAlert className="w-4 h-4" />}
        maxWidthClass="max-w-lg"
        overlayClassName="bg-black/40"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            db.createDisciplinaryCase(
              {
                employeeId: Number(form.employeeId.value),
                incidentDate: form.incidentDate.value,
                natureOfOffence: form.natureOfOffence.value as DisciplinaryOffence,
                allegationSummary: form.allegationSummary.value.trim(),
                investigationDetails: form.investigationDetails.value.trim(),
                disciplinaryCommitteeMembers: form.disciplinaryCommitteeMembers.value.trim(),
                hearingDate: form.hearingDate.value || undefined,
                outcome: 'Pending Investigation',
                caseStatus: form.caseStatus.value as DisciplinaryCaseStatus,
                isConfidential: form.isConfidential.checked,
                recordedBy: currentUser?.username || 'admin',
              },
              currentUser?.username || 'admin'
            );

            setDataVersion((prev) => prev + 1);
            setShowNewCaseModal(false);
          }}
          className="flex-1 flex flex-col overflow-hidden text-xs"
        >
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Select Officer</label>
              <select name="employeeId" required className="w-full p-2 rounded border border-slate-300 bg-white">
                {employees.map((emp) => {
                  const personal = db.getEmployeePersonalInfo(emp.id);
                  return (
                    <option key={emp.id} value={emp.id}>
                      {emp.staffId} — {personal?.fullName}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Incident Date</label>
                <input
                  name="incidentDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full p-2 rounded border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Scheduled Hearing Date</label>
                <input
                  name="hearingDate"
                  type="date"
                  className="w-full p-2 rounded border border-slate-300 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Nature of Offence</label>
              <select name="natureOfOffence" className="w-full p-2 rounded border border-slate-300 bg-white">
                <option value="Insubordination & Disregard of Lawful Order">Insubordination &amp; Disregard of Lawful Order</option>
                <option value="Gross Misconduct & Civil Disorder">Gross Misconduct &amp; Civil Disorder</option>
                <option value="Absence Without Official Leave (AWOL)">Absence Without Official Leave (AWOL)</option>
                <option value="Financial Malfeasance & Misappropriation">Financial Malfeasance &amp; Misappropriation</option>
                <option value="Breach of Official Oath & Code of Conduct">Breach of Official Oath &amp; Code of Conduct</option>
                <option value="Unauthorized Leakage of Classified Information">Unauthorized Leakage of Classified Information</option>
                <option value="Negligence in the Discharge of Duty">Negligence in the Discharge of Duty</option>
                <option value="Other Infraction">Other Infraction</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Allegation Summary / Formal Charge</label>
              <textarea
                name="allegationSummary"
                rows={2}
                required
                placeholder="Detail the exact allegations, date, and circumstances..."
                className="w-full p-2 rounded border border-slate-300"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Investigation Details &amp; Preliminary Findings</label>
              <textarea
                name="investigationDetails"
                rows={2}
                placeholder="Summary of preliminary inquiry or audit findings..."
                className="w-full p-2 rounded border border-slate-300"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Disciplinary Committee Panelists</label>
              <input
                name="disciplinaryCommitteeMembers"
                defaultValue="Director HR (Chair), Legal Officer, Staff Union Representative, Internal Audit Rep"
                required
                className="w-full p-2 rounded border border-slate-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Initial Status</label>
                <select name="caseStatus" className="w-full p-2 rounded border border-slate-300 bg-white">
                  <option value="Reported">Reported</option>
                  <option value="Under Investigation">Under Investigation</option>
                  <option value="Committee Hearing">Committee Hearing</option>
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center space-x-2 text-rose-800 font-semibold cursor-pointer">
                  <input type="checkbox" name="isConfidential" defaultChecked className="rounded text-rose-700" />
                  <span>Enforce Strict Confidentiality</span>
                </label>
              </div>
            </div>
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowNewCaseModal(false)}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-amber-700 hover:bg-amber-800 text-white font-semibold"
            >
              Register Case
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* DRAWER 2: ADJUDICATE CASE & IMPOSE SANCTIONS */}
      <SlideOverPanel
        isOpen={Boolean(selectedCaseForReview)}
        onClose={() => setSelectedCaseForReview(null)}
        title={activeReviewCase ? `Adjudicate Docket: ${activeReviewCase.caseReference}` : 'Adjudicate Docket'}
        subtitle="Committee Findings & Statutory Civil Service Sanctions"
        icon={<Gavel className="w-4 h-4" />}
        maxWidthClass="max-w-lg"
        overlayClassName="bg-black/40"
      >
        {activeReviewCase && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              db.updateDisciplinaryCase(
                activeReviewCase.id,
                {
                  outcome: form.outcome.value as DisciplinaryCase['outcome'],
                  sanctionRecommended: form.sanctionRecommended.value as DisciplinarySanction,
                  decisionDate: form.decisionDate.value,
                  caseStatus: form.caseStatus.value as DisciplinaryCaseStatus,
                },
                currentUser?.username || 'admin'
              );

              setDataVersion((prev) => prev + 1);
              setSelectedCaseForReview(null);
            }}
            className="flex-1 flex flex-col overflow-hidden text-xs"
          >
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900">{activeReviewCase.natureOfOffence}</span>
                <p className="text-[11px] text-slate-600 leading-snug">{activeReviewCase.allegationSummary}</p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Committee Finding / Outcome</label>
                <select name="outcome" defaultValue={activeReviewCase.outcome} className="w-full p-2 rounded border border-slate-300 bg-white">
                  <option value="Charge Established">Charge Established</option>
                  <option value="Exonerated">Exonerated (Officer Cleared)</option>
                  <option value="Dismissed">Dismissed for Lack of Evidence</option>
                  <option value="Pending Investigation">Pending Investigation</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Statutory Sanction (Civil Service Code)</label>
                <select
                  name="sanctionRecommended"
                  defaultValue={activeReviewCase.sanctionRecommended || 'Written Warning & Reprimand'}
                  className="w-full p-2 rounded border border-slate-300 bg-white"
                >
                  <option value="Exonerated (No Action)">Exonerated (No Action)</option>
                  <option value="Verbal Admonition">Verbal Admonition</option>
                  <option value="Written Warning & Reprimand">Written Warning &amp; Reprimand</option>
                  <option value="Withholding of Annual Increment">Withholding of Annual Increment</option>
                  <option value="Reduction in Rank (Demotion)">Reduction in Rank (Demotion)</option>
                  <option value="Interdiction with Half Salary">Interdiction with Half Salary</option>
                  <option value="Suspension from Service">Suspension from Service</option>
                  <option value="Summary Dismissal">Summary Dismissal</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Decision Ratification Date</label>
                  <input
                    name="decisionDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full p-2 rounded border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Docket Case Status</label>
                  <select name="caseStatus" defaultValue="Sanction Imposed" className="w-full p-2 rounded border border-slate-300 bg-white">
                    <option value="Sanction Imposed">Sanction Imposed</option>
                    <option value="Closed">Closed</option>
                    <option value="Exonerated">Exonerated</option>
                    <option value="Appealed">Appealed</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCaseForReview(null)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-amber-700 hover:bg-amber-800 text-white font-semibold"
              >
                Ratify Sanction
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* DRAWER 3: DISCIPLINARY DOCKET PREVIEW & PRINT */}
      <SlideOverPanel
        isOpen={Boolean(previewDocketCase)}
        onClose={() => setPreviewDocketCase(null)}
        title="Formal Disciplinary Inquiry Docket"
        subtitle={activePreviewDocket ? `Case Docket Ref: ${activePreviewDocket.caseReference}` : 'Inquiry Docket'}
        icon={<FileText className="w-4 h-4" />}
        maxWidthClass="max-w-2xl"
        overlayClassName="bg-black/40"
      >
        {activePreviewDocket && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                <BrandCrest
                  sizeClass="w-12 h-12"
                  className="mx-auto mb-1.5 border border-[#C9A24D] bg-white"
                />
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500">{institutionCountry}</div>
                <h2 className="text-lg font-extrabold text-slate-900">{institutionName}</h2>
                <div className="text-xs font-serif font-bold text-rose-800 uppercase tracking-wider">
                  Formal Disciplinary Inquiry Docket
                </div>
                <div className="text-[10px] font-mono text-slate-500">Case Docket Ref: {activePreviewDocket.caseReference}</div>
              </div>

              {(() => {
                const emp = db.getEmployeeById(activePreviewDocket.employeeId);
                const personal = db.getEmployeePersonalInfo(activePreviewDocket.employeeId);
                const employment = db.getEmployeeEmploymentInfo(activePreviewDocket.employeeId);
                const dept = departments.find((d) => d.id === employment?.currentDepartmentId);

                return (
                  <div className="space-y-4 text-xs font-sans leading-relaxed text-slate-800">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Accused Officer:</span>
                        <div className="font-bold text-slate-900">{personal?.fullName}</div>
                        <div className="font-mono text-blue-700">Staff ID: {emp?.staffId}</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Department:</span>
                        <div className="font-medium text-slate-800">{dept?.departmentName}</div>
                        <div className="text-[10px] text-slate-500">Incident Date: {activePreviewDocket.incidentDate}</div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700 block">
                        Nature of Allegation:
                      </span>
                      <div className="p-2.5 rounded bg-amber-50 border border-amber-200 font-bold text-amber-950">
                        {activePreviewDocket.natureOfOffence}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700 block">
                        Particulars of Charge:
                      </span>
                      <p className="p-2.5 rounded bg-white border border-slate-200 text-slate-700">
                        {activePreviewDocket.allegationSummary}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700 block">
                        Inquiry Committee &amp; Hearing:
                      </span>
                      <div className="p-2.5 rounded bg-white border border-slate-200 space-y-1 text-slate-600">
                        <div>Panel: <strong>{activePreviewDocket.disciplinaryCommitteeMembers}</strong></div>
                        <div>Hearing Date: <span className="font-mono font-bold text-slate-800">{activePreviewDocket.hearingDate || 'Scheduled'}</span></div>
                        <div>Investigation Findings: {activePreviewDocket.investigationDetails || 'Preliminary depositions recorded.'}</div>
                      </div>
                    </div>

                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-1">
                      <span className="font-bold text-rose-900 text-xs block uppercase tracking-wider">
                        Adjudicated Sanction / Ratification:
                      </span>
                      <div className="text-sm font-extrabold text-rose-950 font-serif">
                        {activePreviewDocket.sanctionRecommended || 'Pending final ratification'}
                      </div>
                      {activePreviewDocket.decisionDate && (
                        <div className="text-[10px] text-rose-800 font-mono">
                          Ratified on {activePreviewDocket.decisionDate} by Disciplinary Authority
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  notificationService.security(
                    'Official Docket Print Prepared',
                    'Prepared confidential disciplinary docket for controlled printing.',
                    { module: 'Disciplinary Management', actor: currentUser?.username }
                  );
                  window.print();
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Docket</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewDocketCase(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* DRAWER 4: EDIT DISCIPLINARY CASE DETAILS */}
      <SlideOverPanel
        isOpen={Boolean(editingCase)}
        onClose={() => setEditingCase(null)}
        title={editingCase ? `Edit Case Docket: ${editingCase.caseReference}` : 'Edit Case Docket'}
        subtitle="Update Allegation, Hearing Date & Investigation Particulars"
        icon={<Edit2 className="w-4 h-4" />}
        maxWidthClass="max-w-lg"
        overlayClassName="bg-black/40"
      >
        {editingCase && (
          <form
            key={editingCase.id}
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              db.updateDisciplinaryCase(
                editingCase.id,
                {
                  incidentDate: form.incidentDate.value,
                  hearingDate: form.hearingDate.value || undefined,
                  natureOfOffence: form.natureOfOffence.value as DisciplinaryOffence,
                  allegationSummary: form.allegationSummary.value.trim(),
                  investigationDetails: form.investigationDetails.value.trim(),
                  disciplinaryCommitteeMembers: form.disciplinaryCommitteeMembers.value.trim(),
                  caseStatus: form.caseStatus.value as DisciplinaryCaseStatus,
                  isConfidential: form.isConfidential.checked,
                },
                currentUser?.username || 'admin'
              );
              setDataVersion((prev) => prev + 1);
              setEditingCase(null);
            }}
            className="flex-1 flex flex-col overflow-hidden text-xs"
          >
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Incident Date</label>
                  <input
                    name="incidentDate"
                    type="date"
                    required
                    defaultValue={editingCase.incidentDate}
                    className="w-full p-2 rounded border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Hearing Date</label>
                  <input
                    name="hearingDate"
                    type="date"
                    defaultValue={editingCase.hearingDate || ''}
                    className="w-full p-2 rounded border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nature of Offence</label>
                <select
                  name="natureOfOffence"
                  defaultValue={editingCase.natureOfOffence}
                  className="w-full p-2 rounded border border-slate-300 bg-white"
                >
                  <option value="Insubordination & Disregard of Lawful Order">Insubordination &amp; Disregard of Lawful Order</option>
                  <option value="Gross Misconduct & Civil Disorder">Gross Misconduct &amp; Civil Disorder</option>
                  <option value="Absence Without Official Leave (AWOL)">Absence Without Official Leave (AWOL)</option>
                  <option value="Financial Malfeasance & Misappropriation">Financial Malfeasance &amp; Misappropriation</option>
                  <option value="Breach of Official Oath & Code of Conduct">Breach of Official Oath &amp; Code of Conduct</option>
                  <option value="Unauthorized Leakage of Classified Information">Unauthorized Leakage of Classified Information</option>
                  <option value="Negligence in the Discharge of Duty">Negligence in the Discharge of Duty</option>
                  <option value="Other Infraction">Other Infraction</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Allegation Summary / Formal Charge</label>
                <textarea
                  name="allegationSummary"
                  rows={2}
                  required
                  defaultValue={editingCase.allegationSummary}
                  className="w-full p-2 rounded border border-slate-300"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Investigation Details</label>
                <textarea
                  name="investigationDetails"
                  rows={2}
                  defaultValue={editingCase.investigationDetails}
                  className="w-full p-2 rounded border border-slate-300"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Disciplinary Committee Panelists</label>
                <input
                  name="disciplinaryCommitteeMembers"
                  required
                  defaultValue={editingCase.disciplinaryCommitteeMembers}
                  className="w-full p-2 rounded border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Case Status</label>
                  <select
                    name="caseStatus"
                    defaultValue={editingCase.caseStatus}
                    className="w-full p-2 rounded border border-slate-300 bg-white"
                  >
                    <option value="Reported">Reported</option>
                    <option value="Under Investigation">Under Investigation</option>
                    <option value="Committee Hearing">Committee Hearing</option>
                    <option value="Sanction Imposed">Sanction Imposed</option>
                    <option value="Exonerated">Exonerated</option>
                    <option value="Appealed">Appealed</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2 text-rose-800 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      name="isConfidential"
                      defaultChecked={editingCase.isConfidential}
                      className="rounded text-rose-700"
                    />
                    <span>Strict Confidentiality</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingCase(null)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold"
              >
                Save Case Changes
              </button>
            </div>
          </form>
        )}
      </SlideOverPanel>

      {/* DRAWER 5: DELETE DISCIPLINARY CASE CONFIRMATION */}
      <SlideOverPanel
        isOpen={Boolean(deletingCase)}
        onClose={() => setDeletingCase(null)}
        title="Delete Disciplinary Docket"
        subtitle={deletingCase?.caseReference}
        icon={<Trash2 className="w-4 h-4" />}
        maxWidthClass="max-w-md"
        overlayClassName="bg-black/40"
      >
        {deletingCase && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
                Permanently remove disciplinary docket{' '}
                <strong className="font-mono">{deletingCase.caseReference}</strong> ({deletingCase.natureOfOffence})?
              </div>
              <p className="text-[11px] text-slate-600">
                This deletion will be permanently recorded in the tamper-evident Civil Service Audit Trail.
              </p>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeletingCase(null)}
                className="px-3.5 py-2 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  db.deleteDisciplinaryCase(deletingCase.id, currentUser?.username || 'admin');
                  setDeletingCase(null);
                  setDataVersion((prev) => prev + 1);
                }}
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
