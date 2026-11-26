/**
 * Haros HRMIS - Scheduled Training Directory
 * Annual training calendar with 30/14/7/1-day reminders, RBAC-gated
 * scheduling/approval/cancellation, post-completion tracking, and
 * PDF/Excel/CSV exports plus .ics calendar invites.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Plus,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  FileText,
  AlertTriangle,
  Users,
  MapPin,
  Wallet,
  Trash2,
  Paperclip,
} from 'lucide-react';
import { db, DatabaseService } from '../../db/storage';
import { notificationService } from '../../services/notifications/notificationService';
import { useAuth } from '../../context/AuthContext';
import {
  ScheduledTraining,
  ScheduledTrainingType,
  ScheduledTrainingMode,
  ScheduledTrainingFunding,
  ScheduledTrainingCertification,
  ScheduledTrainingStatus,
  ScheduledTrainingParticipant,
} from '../../types';
import { SearchableSelect } from '../common/SearchableSelect';
import { SlideOverPanel } from '../common/SlideOverPanel';
import {
  exportReportToCsv,
  exportReportToExcel,
  exportReportToPdf,
  ReportExportMeta,
  ReportTabularData,
} from '../../services/reports/reportExporter';

const TRAINING_TYPES: ScheduledTrainingType[] = ['Goods', 'Works', 'Technical Services', 'Consultancy'];
const DELIVERY_MODES: ScheduledTrainingMode[] = ['In-Person', 'Online'];
const FUNDING_TYPES: ScheduledTrainingFunding[] = ['Paid', 'Free'];
const CERTIFICATIONS: ScheduledTrainingCertification[] = ['Certified', 'Non-Certified'];
const ACTIVE_STATUSES: ScheduledTrainingStatus[] = ['Scheduled', 'Approved'];

function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toIcsDateTime(date: string, allDay: boolean): string {
  const d = new Date(`${date}T00:00:00`);
  const p = (n: number) => String(n).padStart(2, '0');
  if (allDay) return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T090000`;
}

export function buildTrainingIcs(training: ScheduledTraining, mdaName: string): string {
  const uid = `${training.scheduleCode}@haros-hrmis.local`;
  const dtStart = toIcsDateTime(training.trainingDate, true);
  const dtEnd = toIcsDateTime(training.endDate || training.trainingDate, true);
  const alarms = DatabaseService.TRAINING_REMINDER_MARKERS.map(
    (days) =>
      `BEGIN:VALARM\r\nTRIGGER:-P${days}D\r\nACTION:DISPLAY\r\nDESCRIPTION:${icsEscape(
        `${days}-day reminder: ${training.trainingTitle}`
      )}\r\nEND:VALARM`
  ).join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Haros HRMIS//Scheduled Training//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsDateTime(new Date().toISOString().slice(0, 10), false)}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${icsEscape(`[${training.scheduleCode}] ${training.trainingTitle}`)}`,
    `DESCRIPTION:${icsEscape(
      `${training.trainingType} • ${training.deliveryMode} • ${training.fundingType} • ${training.certification}\nProvider: ${training.provider}\nVenue/Platform: ${training.venueOrPlatform}\nTarget MDA: ${mdaName}\nBudget: GHS ${training.budgetGhs.toLocaleString()}`
    )}`,
    `LOCATION:${icsEscape(training.venueOrPlatform)}`,
    alarms,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadIcs(training: ScheduledTraining, mdaName: string): void {
  const blob = new Blob([buildTrainingIcs(training, mdaName)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${training.scheduleCode}_invite.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface ScheduledTrainingViewProps {
  onSelectEmployee?: (empId: number) => void;
}

export const ScheduledTrainingView: React.FC<ScheduledTrainingViewProps> = ({ onSelectEmployee }) => {
  const { currentUser, hasPermission } = useAuth();
  const [dataVersion, setDataVersion] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [radarFilter, setRadarFilter] = useState('all');

  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const [editingTraining, setEditingTraining] = useState<ScheduledTraining | null>(null);
  const [completionTarget, setCompletionTarget] = useState<ScheduledTraining | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ScheduledTraining | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Schedule form state
  const [fTitle, setFTitle] = useState('');
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10));
  const [fEndDate, setFEndDate] = useState('');
  const [fType, setFType] = useState<ScheduledTrainingType>('Technical Services');
  const [fMode, setFMode] = useState<ScheduledTrainingMode>('In-Person');
  const [fFunding, setFFunding] = useState<ScheduledTrainingFunding>('Paid');
  const [fCert, setFCert] = useState<ScheduledTrainingCertification>('Certified');
  const [fProvider, setFProvider] = useState('');
  const [fVenue, setFVenue] = useState('');
  const [fBudget, setFBudget] = useState<number>(0);
  const [fMdaId, setFMdaId] = useState<number>(1);
  const [fExpected, setFExpected] = useState<number>(10);
  const [fStatus, setFStatus] = useState<ScheduledTrainingStatus>('Scheduled');

  // Completion form state
  const [cParticipants, setCParticipants] = useState<ScheduledTrainingParticipant[]>([]);
  const [cAddEmpId, setCAddEmpId] = useState<number | ''>('');
  const [cActualCost, setCActualCost] = useState<string>('');
  const [cOutcomes, setCOutcomes] = useState('');
  const [cLessons, setCLessons] = useState('');
  const [cRecs, setCRecs] = useState('');
  const [cDocs, setCDocs] = useState<ScheduledTraining['documents']>([]);
  const [formError, setFormError] = useState('');

  const trainings = useMemo(() => db.getScheduledTrainings(), [dataVersion]);
  const mdas = useMemo(() => db.getMdas(), [dataVersion]);
  const employees = useMemo(() => db.getEmployees(), [dataVersion]);

  const mdaName = (id: number) => mdas.find((m) => m.id === id)?.name || `MDA #${id}`;
  const empLabel = (id: number) => {
    const emp = db.getEmployeeById(id);
    const pers = db.getEmployeePersonalInfo(id);
    return emp ? `${emp.staffId} — ${pers?.fullName || 'Officer'}` : `Employee #${id}`;
  };

  // Fire due 30/14/7/1-day reminders into the Notification Center on open/refresh
  useEffect(() => {
    const dispatched = db.syncScheduledTrainingReminders();
    if (dispatched > 0) setDataVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enriched = useMemo(
    () =>
      trainings.map((t) => ({
        ...t,
        daysUntil: DatabaseService.daysUntilTraining(t.trainingDate),
      })),
    [trainings]
  );

  const filtered = useMemo(() => {
    return enriched.filter((t) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const hay = `${t.scheduleCode} ${t.trainingTitle} ${t.provider} ${t.venueOrPlatform} ${mdaName(t.targetMdaId)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterType !== 'all' && t.trainingType !== filterType) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (radarFilter !== 'all') {
        const window = Number(radarFilter);
        const inWindow = t.daysUntil >= 0 && t.daysUntil <= window;
        const overdue = t.daysUntil < 0 && t.status !== 'Completed' && t.status !== 'Cancelled';
        if (radarFilter === 'past') {
          if (!overdue) return false;
        } else if (!inWindow) {
          return false;
        }
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched, searchTerm, filterType, filterStatus, radarFilter, mdas]);

  const radarCounts = useMemo(() => {
    const upcoming = enriched.filter((t) => t.status === 'Scheduled' || t.status === 'Approved');
    return {
      d30: upcoming.filter((t) => t.daysUntil >= 0 && t.daysUntil <= 30).length,
      d14: upcoming.filter((t) => t.daysUntil >= 0 && t.daysUntil <= 14).length,
      d7: upcoming.filter((t) => t.daysUntil >= 0 && t.daysUntil <= 7).length,
      d1: upcoming.filter((t) => t.daysUntil >= 0 && t.daysUntil <= 1).length,
      past: upcoming.filter((t) => t.daysUntil < 0).length,
    };
  }, [enriched]);

  const budgetTotals = useMemo(() => {
    const budgeted = filtered.reduce((s, t) => s + (t.budgetGhs || 0), 0);
    const actual = filtered.reduce((s, t) => s + (t.actualCostGhs || 0), 0);
    return { budgeted, actual, variance: actual - budgeted };
  }, [filtered]);

  const resetScheduleForm = () => {
    setFTitle('');
    setFDate(new Date().toISOString().slice(0, 10));
    setFEndDate('');
    setFType('Technical Services');
    setFMode('In-Person');
    setFFunding('Paid');
    setFCert('Certified');
    setFProvider('');
    setFVenue('');
    setFBudget(0);
    setFMdaId(mdas[0]?.id || 1);
    setFExpected(10);
    setFStatus('Scheduled');
    setFormError('');
  };

  const openSchedulePanel = (existing?: ScheduledTraining) => {
    if (existing) {
      setEditingTraining(existing);
      setFTitle(existing.trainingTitle);
      setFDate(existing.trainingDate);
      setFEndDate(existing.endDate || '');
      setFType(existing.trainingType);
      setFMode(existing.deliveryMode);
      setFFunding(existing.fundingType);
      setFCert(existing.certification);
      setFProvider(existing.provider);
      setFVenue(existing.venueOrPlatform);
      setFBudget(existing.budgetGhs);
      setFMdaId(existing.targetMdaId);
      setFExpected(existing.expectedParticipants);
      setFStatus(existing.status === 'Completed' || existing.status === 'Cancelled' ? 'Scheduled' : existing.status);
    } else {
      setEditingTraining(null);
      resetScheduleForm();
    }
    setShowSchedulePanel(true);
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fTitle.trim() || !fProvider.trim() || !fVenue.trim()) {
      setFormError('Training title, provider, and venue/platform are required.');
      return;
    }
    if (!fDate) {
      setFormError('Training date is required.');
      return;
    }
    const payload = {
      trainingTitle: fTitle.trim(),
      trainingDate: fDate,
      endDate: fEndDate || undefined,
      trainingType: fType,
      deliveryMode: fMode,
      fundingType: fFunding,
      certification: fCert,
      provider: fProvider.trim(),
      venueOrPlatform: fVenue.trim(),
      budgetGhs: Number(fBudget) || 0,
      targetMdaId: fMdaId,
      expectedParticipants: Math.max(0, Math.floor(Number(fExpected) || 0)),
      status: fStatus,
      participants: editingTraining?.participants || [],
      documents: editingTraining?.documents || [],
      reminderMarkersSent: editingTraining?.reminderMarkersSent || [],
    };
    const actor = currentUser?.username || 'admin';
    try {
      if (editingTraining) {
        db.updateScheduledTraining(editingTraining.id, payload, actor);
      } else {
        db.createScheduledTraining(payload, actor);
      }
      setShowSchedulePanel(false);
      setDataVersion((v) => v + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save scheduled training.');
    }
  };

  const openCompletionPanel = (t: ScheduledTraining) => {
    setCompletionTarget(t);
    setCParticipants(t.participants.map((p) => ({ ...p })));
    setCAddEmpId('');
    setCActualCost(t.actualCostGhs !== undefined ? String(t.actualCostGhs) : '');
    setCOutcomes(t.outcomes || '');
    setCLessons(t.lessonsLearned || '');
    setCRecs(t.recommendations || '');
    setCDocs([...(t.documents || [])]);
    setFormError('');
  };

  const completionReadOnly = completionTarget?.status === 'Completed' || completionTarget?.status === 'Cancelled';

  const addParticipant = () => {
    if (!cAddEmpId) return;
    const id = Number(cAddEmpId);
    if (cParticipants.some((p) => p.employeeId === id)) return;
    setCParticipants((prev) => [...prev, { employeeId: id }]);
    setCAddEmpId('');
  };

  const updateParticipant = (employeeId: number, patch: Partial<ScheduledTrainingParticipant>) => {
    setCParticipants((prev) => prev.map((p) => (p.employeeId === employeeId ? { ...p, ...patch } : p)));
  };

  const removeParticipant = (employeeId: number) => {
    setCParticipants((prev) => prev.filter((p) => p.employeeId !== employeeId));
  };

  const handleDocPick = (files: FileList | null) => {
    if (!files) return;
    const additions = Array.from(files).map((f) => ({
      documentName: f.name.replace(/\.[^.]+$/, '') || f.name,
      fileName: f.name,
      fileSize: f.size,
      uploadedAt: new Date().toISOString(),
    }));
    setCDocs((prev) => [...prev, ...additions]);
  };

  const handleSaveCompletion = () => {
    if (!completionTarget) return;
    const actor = currentUser?.username || 'admin';
    try {
      db.completeScheduledTraining(
        completionTarget.id,
        {
          participants: cParticipants,
          actualCostGhs: cActualCost.trim() === '' ? undefined : Number(cActualCost),
          outcomes: cOutcomes.trim() || undefined,
          lessonsLearned: cLessons.trim() || undefined,
          recommendations: cRecs.trim() || undefined,
          documents: cDocs,
        },
        actor
      );
      setCompletionTarget(null);
      setDataVersion((v) => v + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to record completion.');
    }
  };

  const handleApprove = (t: ScheduledTraining) => {
    try {
      db.approveScheduledTraining(t.id, currentUser?.username || 'admin');
      setDataVersion((v) => v + 1);
    } catch (err) {
      notificationService.error('Approval Failed', err instanceof Error ? err.message : 'Could not approve.', {
        module: 'Training & Development',
        actor: currentUser?.username,
      });
    }
  };

  const handleCancel = () => {
    if (!cancelTarget) return;
    try {
      db.cancelScheduledTraining(cancelTarget.id, cancelReason.trim(), currentUser?.username || 'admin');
      setCancelTarget(null);
      setCancelReason('');
      setDataVersion((v) => v + 1);
    } catch (err) {
      notificationService.error('Cancellation Failed', err instanceof Error ? err.message : 'Could not cancel.', {
        module: 'Training & Development',
        actor: currentUser?.username,
      });
    }
  };

  const buildReportMeta = (): ReportExportMeta => ({
    reportCode: 'TRN-SCH',
    reportTitle: 'Scheduled Training Directory',
    reportDescription: 'Annual scheduled training calendar with delivery, funding, certification, budget, and status tracking.',
    institutionName: db.getSettingValue('INSTITUTION_NAME', 'Office of the Head of Civil Service'),
    institutionCountry: 'REPUBLIC OF GHANA',
    reportingPeriod: `All scheduled sessions • Generated ${new Date().toISOString().slice(0, 10)}`,
    generatedAt: new Date().toLocaleString(),
    generatedBy: currentUser?.username || 'System',
    appliedFiltersSummary: `Type: ${filterType} | Status: ${filterStatus} | Radar: ${radarFilter} | Search: ${searchTerm || 'None'}`,
    kpis: [
      { label: 'Sessions', value: String(filtered.length) },
      { label: 'Budgeted (GHS)', value: budgetTotals.budgeted.toLocaleString() },
      { label: 'Actual Cost (GHS)', value: budgetTotals.actual.toLocaleString() },
      { label: 'Variance (GHS)', value: budgetTotals.variance.toLocaleString() },
    ],
  });

  const buildReportData = (): ReportTabularData => ({
    headers: [
      'Code', 'Training Title', 'Date', 'End Date', 'Type', 'Mode', 'Funding',
      'Certification', 'Provider', 'Venue / Platform', 'Budget (GHS)', 'Actual Cost (GHS)',
      'Variance (GHS)', 'Target MDA', 'Expected', 'Attended', 'Certificates',
      'Status', 'Days Until',
    ],
    rows: filtered.map((t) => [
      t.scheduleCode,
      t.trainingTitle,
      t.trainingDate,
      t.endDate || '',
      t.trainingType,
      t.deliveryMode,
      t.fundingType,
      t.certification,
      t.provider,
      t.venueOrPlatform,
      t.budgetGhs,
      t.actualCostGhs ?? '',
      t.actualCostGhs !== undefined ? t.actualCostGhs - t.budgetGhs : '',
      mdaName(t.targetMdaId),
      t.expectedParticipants,
      t.participants.filter((p) => p.attended).length,
      t.participants.filter((p) => p.certificateIssued).length,
      t.status,
      t.daysUntil < 0 ? 'Past' : String(t.daysUntil),
    ]),
  });

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    const meta = buildReportMeta();
    const data = buildReportData();
    const stamp = new Date().toISOString().slice(0, 10);
    try {
      if (format === 'csv') exportReportToCsv(meta, data, `Scheduled_Training_Directory_${stamp}.csv`);
      else if (format === 'excel') await exportReportToExcel(meta, data, `Scheduled_Training_Directory_${stamp}.xlsx`);
      else await exportReportToPdf(meta, data, `Scheduled_Training_Directory_${stamp}.pdf`);
      notificationService.success(
        'Scheduled Training Report Exported',
        `${filtered.length} session(s) exported to ${format.toUpperCase()}.`,
        { module: 'Training & Development', actor: currentUser?.username }
      );
    } catch {
      notificationService.error('Export Failed', 'Could not generate the scheduled training report.', {
        module: 'Training & Development',
        actor: currentUser?.username,
      });
    }
  };

  const statusBadge = (status: ScheduledTrainingStatus) => {
    const map: Record<ScheduledTrainingStatus, string> = {
      Scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
      Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Completed: 'bg-slate-100 text-slate-700 border-slate-300',
      Cancelled: 'bg-red-50 text-red-700 border-red-200',
    };
    return map[status];
  };

  const daysBadge = (t: (typeof enriched)[number]) => {
    if (t.status === 'Completed') return <span className="text-[10px] font-semibold text-slate-500">Completed</span>;
    if (t.status === 'Cancelled') return <span className="text-[10px] font-semibold text-red-600">Cancelled</span>;
    if (t.daysUntil < 0) return <span className="text-[10px] font-bold text-red-600">Past due</span>;
    if (t.daysUntil === 0) return <span className="text-[10px] font-bold text-amber-600">Today</span>;
    const urgent = t.daysUntil <= 7;
    return (
      <span className={`text-[10px] font-bold ${urgent ? 'text-red-600' : t.daysUntil <= 30 ? 'text-amber-600' : 'text-slate-500'}`}>
        {t.daysUntil}d left
      </span>
    );
  };

  const canView = hasPermission('TRAINING_SCHEDULE_VIEW') || hasPermission('TRAINING_VIEW');
  const canCreate = hasPermission('TRAINING_SCHEDULE_CREATE');
  const canEdit = hasPermission('TRAINING_SCHEDULE_EDIT');
  const canApprove = hasPermission('TRAINING_SCHEDULE_APPROVE');
  const canCancel = hasPermission('TRAINING_SCHEDULE_CANCEL');
  const canReport = hasPermission('TRAINING_SCHEDULE_REPORT');

  if (!canView) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="text-sm font-semibold text-amber-800">Scheduled Training Directory access restricted.</p>
        <p className="text-xs text-amber-700 mt-1">Your role lacks the TRAINING_SCHEDULE_VIEW permission.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by code, title, provider, venue, or target MDA..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCreate && (
              <button
                onClick={() => openSchedulePanel()}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule Training for the Year</span>
              </button>
            )}
            {canReport && (
              <div className="flex items-center rounded border border-slate-300 overflow-hidden">
                {(['csv', 'excel', 'pdf'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => handleExport(fmt)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 border-r border-slate-200 last:border-r-0 uppercase"
                  >
                    <Download className="w-3 h-3" />
                    <span>{fmt}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="w-44">
            <SearchableSelect
              value={filterType}
              onChange={setFilterType}
              placeholder="All Types"
              searchPlaceholder="Filter type..."
              options={[
                { value: 'all', label: 'All Training Types' },
                ...TRAINING_TYPES.map((t) => ({ value: t, label: t })),
              ]}
            />
          </div>
          <div className="w-40">
            <SearchableSelect
              value={filterStatus}
              onChange={setFilterStatus}
              placeholder="All Statuses"
              searchPlaceholder="Filter status..."
              options={[
                { value: 'all', label: 'All Statuses' },
                ...(['Scheduled', 'Approved', 'Completed', 'Cancelled'] as const).map((s) => ({
                  value: s,
                  label: s,
                })),
              ]}
            />
          </div>
          <div className="w-48">
            <SearchableSelect
              value={radarFilter}
              onChange={setRadarFilter}
              placeholder="Reminder Radar"
              searchPlaceholder="Filter by reminder window..."
              options={[
                { value: 'all', label: 'Reminder Radar: All' },
                { value: '30', label: `Due ≤ 30 days (${radarCounts.d30})` },
                { value: '14', label: `Due ≤ 14 days (${radarCounts.d14})` },
                { value: '7', label: `Due ≤ 7 days (${radarCounts.d7})` },
                { value: '1', label: `Due ≤ 1 day (${radarCounts.d1})` },
                { value: 'past', label: `Past due / Unfinished (${radarCounts.past})` },
              ]}
            />
          </div>
          <div className="ml-auto flex items-center space-x-3 text-[11px] text-slate-500">
            <span className="flex items-center"><Wallet className="w-3.5 h-3.5 mr-1 text-slate-400" />Budget GHS {budgetTotals.budgeted.toLocaleString()}</span>
            <span className="flex items-center"><FileText className="w-3.5 h-3.5 mr-1 text-slate-400" />Actual GHS {budgetTotals.actual.toLocaleString()}</span>
            <span className={`font-semibold ${budgetTotals.variance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              Variance {budgetTotals.variance >= 0 ? '+' : ''}{budgetTotals.variance.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5 font-semibold">Code / Title</th>
                <th className="px-3 py-2.5 font-semibold">Date</th>
                <th className="px-3 py-2.5 font-semibold">Type / Mode</th>
                <th className="px-3 py-2.5 font-semibold">Funding / Cert</th>
                <th className="px-3 py-2.5 font-semibold">Provider & Venue</th>
                <th className="px-3 py-2.5 font-semibold">Budget</th>
                <th className="px-3 py-2.5 font-semibold">Target MDA</th>
                <th className="px-3 py-2.5 font-semibold">Participants</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                    <CalendarClock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No scheduled trainings match the current filters.
                  </td>
                </tr>
              )}
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-slate-800">{t.scheduleCode}</div>
                    <div className="text-slate-600 max-w-[220px] truncate" title={t.trainingTitle}>{t.trainingTitle}</div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="font-semibold text-slate-700">{t.trainingDate}</div>
                    {t.endDate && <div className="text-[10px] text-slate-400">to {t.endDate}</div>}
                    <div className="mt-0.5">{daysBadge(t)}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-700">{t.trainingType}</div>
                    <div className="text-[10px] text-slate-400 flex items-center"><MapPin className="w-3 h-3 mr-0.5" />{t.deliveryMode}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-700">{t.fundingType}</div>
                    <div className="text-[10px] text-slate-400">{t.certification}</div>
                  </td>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <div className="font-medium text-slate-700 truncate" title={t.provider}>{t.provider}</div>
                    <div className="text-[10px] text-slate-400 truncate" title={t.venueOrPlatform}>{t.venueOrPlatform}</div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="font-semibold text-slate-700">GHS {t.budgetGhs.toLocaleString()}</div>
                    {t.actualCostGhs !== undefined && (
                      <div className={`text-[10px] font-semibold ${t.actualCostGhs - t.budgetGhs > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        Act: GHS {t.actualCostGhs.toLocaleString()}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-700">{mdaName(t.targetMdaId)}</div>
                    <div className="text-[10px] text-slate-400">{t.expectedParticipants} expected</div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center text-slate-700 font-medium">
                      <Users className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      {t.participants.filter((p) => p.attended).length}/{t.participants.length || t.expectedParticipants}
                    </div>
                    {t.participants.filter((p) => p.certificateIssued).length > 0 && (
                      <div className="text-[10px] text-emerald-600 font-semibold">
                        {t.participants.filter((p) => p.certificateIssued).length} certified
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${statusBadge(t.status)}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end space-x-1">
                      {(t.status === 'Scheduled' || t.status === 'Approved' || t.status === 'Completed') && (
                        <button
                          onClick={() => openCompletionPanel(t)}
                          title={t.status === 'Completed' ? 'View completion record' : 'Attendance & completion tracking'}
                          className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                        >
                          {t.status === 'Completed' ? <CheckCircle2 className="w-4 h-4" /> : <ClipboardCheck className="w-4 h-4" />}
                        </button>
                      )}
                      {canEdit && ACTIVE_STATUSES.includes(t.status) && (
                        <button onClick={() => openSchedulePanel(t)} title="Edit scheduled training" className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                      {canApprove && t.status === 'Scheduled' && (
                        <button onClick={() => handleApprove(t)} title="Approve training" className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      {canCancel && ACTIVE_STATUSES.includes(t.status) && (
                        <button onClick={() => { setCancelTarget(t); setCancelReason(''); }} title="Cancel training" className="p-1.5 rounded hover:bg-red-50 text-red-500">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      {canReport && (
                        <button onClick={() => downloadIcs(t, mdaName(t.targetMdaId))} title="Download .ics calendar invite" className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500">
                          <CalendarClock className="w-4 h-4" />
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

      {/* Schedule / Edit Panel */}
      <SlideOverPanel
        isOpen={showSchedulePanel}
        onClose={() => setShowSchedulePanel(false)}
        title={editingTraining ? `Edit ${editingTraining.scheduleCode}` : 'Schedule Training for the Year'}
        subtitle="Annual training calendar entry"
        icon={<CalendarClock className="w-5 h-5 text-blue-700" />}
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSaveSchedule} className="space-y-4 p-1">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-2.5">{formError}</div>
          )}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Training Title *</label>
            <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600" placeholder="e.g. Public Procurement Act Compliance" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Start Date *</label>
              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">End Date</label>
              <input type="date" value={fEndDate} onChange={(e) => setFEndDate(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Training Type *</label>
              <SearchableSelect value={fType} onChange={(v) => setFType(v as ScheduledTrainingType)} options={TRAINING_TYPES.map((t) => ({ value: t, label: t }))} placeholder="Select type" searchPlaceholder="Filter type..." />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Delivery Mode *</label>
              <SearchableSelect value={fMode} onChange={(v) => setFMode(v as ScheduledTrainingMode)} options={DELIVERY_MODES.map((m) => ({ value: m, label: m }))} placeholder="Select mode" searchPlaceholder="Filter mode..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Funding *</label>
              <SearchableSelect value={fFunding} onChange={(v) => setFFunding(v as ScheduledTrainingFunding)} options={FUNDING_TYPES.map((f) => ({ value: f, label: f }))} placeholder="Select funding" searchPlaceholder="Filter..." />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Certification *</label>
              <SearchableSelect value={fCert} onChange={(v) => setFCert(v as ScheduledTrainingCertification)} options={CERTIFICATIONS.map((c) => ({ value: c, label: c }))} placeholder="Select certification" searchPlaceholder="Filter..." />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Provider / Institution *</label>
            <input value={fProvider} onChange={(e) => setFProvider(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600" placeholder="e.g. GIMPA, CSTC, NCSC" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">{fMode === 'Online' ? 'Platform / URL *' : 'Venue *'}</label>
            <input value={fVenue} onChange={(e) => setFVenue(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600" placeholder={fMode === 'Online' ? 'e.g. Microsoft Teams — NCSC Portal' : 'e.g. CSTC Auditorium, Accra'} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Budget (GHS)</label>
              <input type="number" min={0} step="0.01" value={fBudget} onChange={(e) => setFBudget(Number(e.target.value))} className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Expected Participants</label>
              <input type="number" min={0} value={fExpected} onChange={(e) => setFExpected(Number(e.target.value))} className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Target MDA *</label>
              <SearchableSelect
                value={String(fMdaId)}
                onChange={(v) => setFMdaId(Number(v))}
                options={mdas.filter((m) => m.isActive).map((m) => ({ value: String(m.id), label: `${m.code} — ${m.name}` }))}
                placeholder="Select MDA"
                searchPlaceholder="Search MDAs..."
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Status</label>
            <SearchableSelect
              value={fStatus}
              onChange={(v) => setFStatus(v as ScheduledTrainingStatus)}
              options={ACTIVE_STATUSES.map((s) => ({ value: s, label: s }))}
              placeholder="Select status"
              searchPlaceholder="Filter..."
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
            <button type="button" onClick={() => setShowSchedulePanel(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded">
              {editingTraining ? 'Save Changes' : 'Schedule Training'}
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* Completion / Post-Training Tracking Panel */}
      <SlideOverPanel
        isOpen={!!completionTarget}
        onClose={() => setCompletionTarget(null)}
        title={completionTarget ? `${completionTarget.scheduleCode} — Completion` : ''}
        subtitle={completionTarget?.trainingTitle}
        icon={<ClipboardCheck className="w-5 h-5 text-emerald-700" />}
        maxWidthClass="max-w-2xl"
      >
        {completionTarget && (
          <div className="space-y-4 p-1">
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-2.5">{formError}</div>}

            {/* Summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-slate-50 rounded p-2"><div className="text-slate-400 font-semibold uppercase">Date</div><div className="font-bold text-slate-800">{completionTarget.trainingDate}</div></div>
              <div className="bg-slate-50 rounded p-2"><div className="text-slate-400 font-semibold uppercase">Budget</div><div className="font-bold text-slate-800">GHS {completionTarget.budgetGhs.toLocaleString()}</div></div>
              <div className="bg-slate-50 rounded p-2"><div className="text-slate-400 font-semibold uppercase">Status</div><div className="font-bold text-slate-800">{completionTarget.status}</div></div>
              <div className="bg-slate-50 rounded p-2"><div className="text-slate-400 font-semibold uppercase">Expected</div><div className="font-bold text-slate-800">{completionTarget.expectedParticipants} officers</div></div>
            </div>

            {/* Participants */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-600 uppercase">Participant Attendance & Certificates</label>
                <span className="text-[10px] text-slate-400">{cParticipants.filter((p) => p.attended).length} attended • {cParticipants.filter((p) => p.certificateIssued).length} certified</span>
              </div>
              {!completionReadOnly && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1">
                    <SearchableSelect
                      value={cAddEmpId === '' ? '' : String(cAddEmpId)}
                      onChange={(v) => setCAddEmpId(v === '' ? '' : Number(v))}
                      options={employees
                        .filter((e) => e.isActive && !e.isDeleted && !cParticipants.some((p) => p.employeeId === e.id))
                        .map((e) => ({ value: String(e.id), label: empLabel(e.id) }))}
                      placeholder="Add participating officer..."
                      searchPlaceholder="Search officers..."
                    />
                  </div>
                  <button type="button" onClick={addParticipant} className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded">Add</button>
                </div>
              )}
              <div className="border border-slate-200 rounded divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {cParticipants.length === 0 && (
                  <div className="px-3 py-4 text-center text-[11px] text-slate-400">No participants recorded yet.</div>
                )}
                {cParticipants.map((p) => (
                  <div key={p.employeeId} className="px-3 py-2 flex items-center gap-2 text-xs">
                    <span className="flex-1 font-medium text-slate-700">{empLabel(p.employeeId)}</span>
                    <label className="flex items-center gap-1 text-[10px] text-slate-500">
                      <input type="checkbox" checked={!!p.attended} disabled={completionReadOnly} onChange={(e) => updateParticipant(p.employeeId, { attended: e.target.checked })} className="accent-blue-600" />
                      Attended
                    </label>
                    <label className="flex items-center gap-1 text-[10px] text-slate-500">
                      <input type="checkbox" checked={!!p.certificateIssued} disabled={completionReadOnly} onChange={(e) => updateParticipant(p.employeeId, { certificateIssued: e.target.checked })} className="accent-emerald-600" />
                      Certified
                    </label>
                    {p.certificateIssued && (
                      <input
                        value={p.certificateNumber || ''}
                        disabled={completionReadOnly}
                        onChange={(e) => updateParticipant(p.employeeId, { certificateNumber: e.target.value })}
                        placeholder="Cert no."
                        className="w-28 px-2 py-1 text-[10px] border border-slate-300 rounded"
                      />
                    )}
                    {!completionReadOnly && (
                      <button type="button" onClick={() => removeParticipant(p.employeeId)} className="p-1 text-slate-300 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Cost & outcomes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Actual Cost (GHS)</label>
                <input type="number" min={0} step="0.01" value={cActualCost} disabled={completionReadOnly} onChange={(e) => setCActualCost(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded disabled:bg-slate-50" />
                {completionTarget.actualCostGhs !== undefined && completionTarget.budgetGhs > 0 && (
                  <div className={`text-[10px] mt-1 font-semibold ${completionTarget.actualCostGhs - completionTarget.budgetGhs > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    Variance: {completionTarget.actualCostGhs - completionTarget.budgetGhs >= 0 ? '+' : ''}GHS {(completionTarget.actualCostGhs - completionTarget.budgetGhs).toLocaleString()}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Supporting Documents</label>
                {!completionReadOnly ? (
                  <label className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-50">
                    <Paperclip className="w-3.5 h-3.5" />
                    Attach files
                    <input type="file" multiple className="hidden" onChange={(e) => handleDocPick(e.target.files)} />
                  </label>
                ) : (
                  <div className="px-3 py-2 text-[11px] text-slate-400">{cDocs.length} document(s) attached</div>
                )}
              </div>
            </div>

            {cDocs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {cDocs.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-600">
                    <Paperclip className="w-3 h-3" />{d.fileName}
                    {!completionReadOnly && (
                      <button type="button" onClick={() => setCDocs((prev) => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Outcomes</label>
              <textarea value={cOutcomes} disabled={completionReadOnly} onChange={(e) => setCOutcomes(e.target.value)} rows={2} className="w-full px-3 py-2 text-xs border border-slate-300 rounded disabled:bg-slate-50" placeholder="What was achieved?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Lessons Learned</label>
                <textarea value={cLessons} disabled={completionReadOnly} onChange={(e) => setCLessons(e.target.value)} rows={2} className="w-full px-3 py-2 text-xs border border-slate-300 rounded disabled:bg-slate-50" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Recommendations</label>
                <textarea value={cRecs} disabled={completionReadOnly} onChange={(e) => setCRecs(e.target.value)} rows={2} className="w-full px-3 py-2 text-xs border border-slate-300 rounded disabled:bg-slate-50" />
              </div>
            </div>

            {!completionReadOnly && (
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button type="button" onClick={() => setCompletionTarget(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded">Close</button>
                <button type="button" onClick={handleSaveCompletion} className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded">
                  Mark Completed & Save Record
                </button>
              </div>
            )}
          </div>
        )}
      </SlideOverPanel>

      {/* Cancel Confirmation Panel */}
      <SlideOverPanel
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Scheduled Training"
        subtitle={cancelTarget?.trainingTitle}
        icon={<XCircle className="w-5 h-5 text-red-600" />}
        maxWidthClass="max-w-md"
      >
        {cancelTarget && (
          <div className="space-y-4 p-1">
            <p className="text-xs text-slate-600">
              Cancelling <span className="font-bold">{cancelTarget.scheduleCode}</span> will mark it Cancelled and stop future reminders. This action is audited.
            </p>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Reason</label>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500" placeholder="e.g. Budget reallocation, provider postponement..." />
            </div>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setCancelTarget(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded">Keep Training</button>
              <button onClick={handleCancel} className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded">Confirm Cancellation</button>
            </div>
          </div>
        )}
      </SlideOverPanel>
    </div>
  );
};
