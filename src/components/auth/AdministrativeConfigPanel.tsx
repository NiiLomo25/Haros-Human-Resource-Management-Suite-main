/**
 * Haros HRMIS - Administrative Configuration Panel
 * Workstation Hardware Registration & Application Expiry (Trade EDate) Control.
 * Styled in Haros HRMIS emerald/gold/slate theme with the reference structural layout.
 */

import React, { useState, useMemo } from 'react';
import {
  Monitor,
  KeyRound,
  RefreshCw,
  Save,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Lock,
  Layers,
  X,
} from 'lucide-react';
import { db } from '../../db/storage';
import { RegisteredComputer, StartupValidationResult } from '../../types';
import { detectWindowsWorkstation } from '../../services/security/computerRegistrationService';
import { useNotifications } from '../../context/NotificationContext';

interface AdministrativeConfigPanelProps {
  authorizedAdminUsername: string;
  startupStatus: StartupValidationResult;
  onValidationChanged: () => void;
  onLockAndReturn: () => void;
}

type ConfigSubTab = 'etrade_date' | 'clock_security';
type GroupableColumnKey = 'status' | 'osPlatform' | 'registeredBy' | 'tradeEDate';

const GRID_COLUMNS: { key: keyof RegisteredComputer; label: string; groupable?: GroupableColumnKey }[] = [
  { key: 'id', label: 'ID' },
  { key: 'computerName', label: 'ComputerName' },
  { key: 'hardwareId', label: 'Hardware Identifier' },
  { key: 'osPlatform', label: 'OS Platform', groupable: 'osPlatform' },
  { key: 'registeredAt', label: 'Registered On' },
  { key: 'registeredBy', label: 'Registered By', groupable: 'registeredBy' },
  { key: 'tradeEDate', label: 'Trade EDate', groupable: 'tradeEDate' },
  { key: 'status', label: 'Status', groupable: 'status' },
];

export const AdministrativeConfigPanel: React.FC<AdministrativeConfigPanelProps> = ({
  authorizedAdminUsername,
  startupStatus,
  onValidationChanged,
  onLockAndReturn,
}) => {
  const notifications = useNotifications();

  // Left-panel Workstation Registration controls
  const [detectedComputerName, setDetectedComputerName] = useState('');
  const [detectedHardwareId, setDetectedHardwareId] = useState('');
  const [detectedOsPlatform, setDetectedOsPlatform] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);

  // Left-panel ETradeDate sub-tab & Trade EDate controls
  const [activeSubTab, setActiveSubTab] = useState<ConfigSubTab>('etrade_date');
  const [tradeEDateInput, setTradeEDateInput] = useState(() => db.getApplicationExpiryConfig().tradeEDate || '');

  // Grid & status feedback
  const [registeredComputers, setRegisteredComputers] = useState<RegisteredComputer[]>(() =>
    db.getRegisteredComputers()
  );
  const [expiryConfig, setExpiryConfig] = useState(() => db.getApplicationExpiryConfig());
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Drag-to-group state for Registered Computers grid
  const [groupByCol, setGroupByCol] = useState<GroupableColumnKey | null>(null);
  const [isDragOverGroupBar, setIsDragOverGroupBar] = useState(false);

  const handleGetComputerName = async () => {
    setIsDetecting(true);
    setFeedback(null);
    try {
      const identity = await detectWindowsWorkstation();
      setDetectedComputerName(identity.computerName);
      setDetectedHardwareId(identity.hardwareId);
      setDetectedOsPlatform(identity.osPlatform);
      setFeedback({
        type: 'info',
        message: `Detected workstation "${identity.computerName}" (${identity.hardwareId}).`,
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const handleRegisterComputer = () => {
    setFeedback(null);
    if (!detectedComputerName.trim() || !detectedHardwareId.trim()) {
      const msg = 'Click "Get This ComputerName" first to retrieve this computer\'s Windows name and hardware ID.';
      setFeedback({ type: 'error', message: msg });
      notifications.warning('Computer Detection Required', msg, {
        module: 'Computer Registration',
        actor: authorizedAdminUsername,
      });
      return;
    }

    const res = db.registerComputer(
      {
        computerName: detectedComputerName,
        hardwareId: detectedHardwareId,
        osPlatform: detectedOsPlatform || startupStatus.osPlatform,
      },
      authorizedAdminUsername
    );

    if (!res.success) {
      const msg = res.error || 'Unable to register computer.';
      setFeedback({ type: 'error', message: msg });
      notifications.security('Computer Registration Rejected', msg, {
        module: 'Computer Registration',
        actor: authorizedAdminUsername,
      });
      return;
    }

    setRegisteredComputers(db.getRegisteredComputers());
    setFeedback({
      type: 'success',
      message: `Workstation "${res.record?.computerName}" permanently registered (${res.record?.hardwareId}).`,
    });
    notifications.success(
      'Computer Registered',
      `Registered "${res.record?.computerName}" in local SQLite & permanent offline vault.`,
      { module: 'Computer Registration', actor: authorizedAdminUsername }
    );
    onValidationChanged();
  };

  const handleRefreshAll = () => {
    const latestComputers = db.getRegisteredComputers();
    const latestExpiry = db.getApplicationExpiryConfig();
    setRegisteredComputers(latestComputers);
    setExpiryConfig(latestExpiry);
    setTradeEDateInput(latestExpiry.tradeEDate || '');
    onValidationChanged();
    setFeedback({
      type: 'info',
      message: `Refreshed ${latestComputers.length} registered computer record(s) and expiry configuration.`,
    });
  };

  const handleSaveChanges = () => {
    setFeedback(null);
    if (!tradeEDateInput) {
      const msg = 'Please select a Trade EDate before saving changes.';
      setFeedback({ type: 'error', message: msg });
      notifications.warning('Trade EDate Required', msg, {
        module: 'Expiry Control',
        actor: authorizedAdminUsername,
      });
      return;
    }

    const machineName = detectedComputerName || startupStatus.detectedComputerName;
    const res = db.saveApplicationExpiryDate(tradeEDateInput, machineName, authorizedAdminUsername);
    if (!res.success || !res.config) {
      const msg = res.error || 'Failed to save Trade EDate.';
      setFeedback({ type: 'error', message: msg });
      return;
    }

    setExpiryConfig(res.config);
    setRegisteredComputers(db.getRegisteredComputers());
    onValidationChanged();
    setFeedback({
      type: 'success',
      message: `Trade EDate saved as ${res.config.tradeEDate}. Clock integrity watermark synchronized.`,
    });
    notifications.success(
      'Trade EDate Updated',
      `Authorized HRMIS access expiry set to ${res.config.tradeEDate}.`,
      { module: 'Expiry Control', actor: authorizedAdminUsername }
    );
  };

  const groupedComputers = useMemo(() => {
    if (!groupByCol) return null;
    const groups = new Map<string, RegisteredComputer[]>();
    registeredComputers.forEach((comp) => {
      const rawVal = comp[groupByCol];
      const key = rawVal ? String(rawVal) : 'Not Set';
      const bucket = groups.get(key) || [];
      bucket.push(comp);
      groups.set(key, bucket);
    });
    return Array.from(groups.entries());
  }, [registeredComputers, groupByCol]);

  const handleDropOnGroupBar = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOverGroupBar(false);
    const colKey = e.dataTransfer.getData('text/plain') as GroupableColumnKey;
    if (colKey && ['status', 'osPlatform', 'registeredBy', 'tradeEDate'].includes(colKey)) {
      setGroupByCol(colKey);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Top Status & Authorization Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/90 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#006B3F]/10 border border-[#006B3F]/20 flex items-center justify-center text-[#006B3F]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#0F1F1A]">
              Administrative Configuration — Workstation Activation &amp; Expiry Control
            </div>
            <div className="text-xs text-[#4A5A55]">
              Authorized Admin:{' '}
              <span className="font-mono font-semibold text-[#006B3F]">
                {authorizedAdminUsername}
              </span>{' '}
              · Current Workstation:{' '}
              <span className="font-mono font-semibold text-[#0F1F1A]">
                {startupStatus.hardwareId}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLockAndReturn}
          className="px-3.5 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 flex items-center gap-1.5 transition-colors"
        >
          <Lock className="w-3.5 h-3.5 text-[#006B3F]" />
          <span>Lock &amp; Return to Login</span>
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : feedback.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-950'
              : 'bg-sky-50 border-sky-200 text-sky-950'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : feedback.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
          ) : (
            <Monitor className="w-4 h-4 text-sky-700 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Two-Column Interface matching Reference Screenshot Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* LEFT CONTROL COLUMN (5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Top Card: Computer Detection & One-Time Registration */}
          <div className="rounded-xl bg-white border border-slate-200 shadow-xs p-4 space-y-3">
            <button
              type="button"
              onClick={handleGetComputerName}
              disabled={isDetecting}
              className="w-full h-10 px-4 rounded-lg bg-[#0F1F1A] hover:bg-[#19332b] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-60"
            >
              <Monitor className="w-4 h-4 text-[#edd6a8]" />
              <span>{isDetecting ? 'Detecting ComputerName...' : 'Get This ComputerName'}</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-2">
              <label
                htmlFor="admin-computer-name-field"
                className="sm:col-span-4 text-xs font-semibold text-[#0F1F1A]"
              >
                ComputerName
              </label>
              <div className="sm:col-span-8">
                <input
                  id="admin-computer-name-field"
                  type="text"
                  readOnly
                  value={detectedComputerName}
                  placeholder="Click Get This ComputerName"
                  className="w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-300 font-mono text-xs font-semibold text-[#0F1F1A] placeholder:text-slate-400 focus:outline-hidden"
                />
              </div>
            </div>

            {detectedHardwareId && (
              <div className="px-3 py-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-medium">Hardware ID:</span>
                <span className="font-mono font-bold text-[#006B3F]">{detectedHardwareId}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleRegisterComputer}
              className="w-full h-10 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all hover:brightness-105 shadow-xs"
              style={{
                background: 'linear-gradient(135deg, #edd6a8 0%, #dfc07c 50%, #c9a24d 100%)',
                color: '#0F1F1A',
              }}
            >
              <KeyRound className="w-4 h-4" />
              <span>Register Computer</span>
            </button>

            <button
              type="button"
              onClick={handleRefreshAll}
              className="w-full h-9 px-4 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#006B3F]" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Bottom Card: ETradeDate Sub-Tab Panel */}
          <div className="rounded-xl bg-white border border-slate-200 shadow-xs overflow-hidden flex-1 flex flex-col">
            {/* Sub-Tab Strip */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50 px-2 pt-2 gap-1">
              <button
                type="button"
                onClick={() => setActiveSubTab('etrade_date')}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-lg border-t border-l border-r transition-colors ${
                  activeSubTab === 'etrade_date'
                    ? 'bg-white text-[#006B3F] border-slate-200 -mb-px'
                    : 'bg-transparent text-slate-500 border-transparent hover:text-slate-800'
                }`}
              >
                ETradeDate
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('clock_security')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-t border-l border-r transition-colors ${
                  activeSubTab === 'clock_security'
                    ? 'bg-white text-[#006B3F] border-slate-200 -mb-px'
                    : 'bg-transparent text-slate-500 border-transparent hover:text-slate-800'
                }`}
              >
                Clock-Tamper Info
              </button>
            </div>

            {activeSubTab === 'etrade_date' ? (
              <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-2">
                    <label
                      htmlFor="trade-edate-input"
                      className="sm:col-span-4 text-xs font-semibold text-[#0F1F1A] flex items-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5 text-[#006B3F]" />
                      <span>Trade EDate</span>
                    </label>
                    <div className="sm:col-span-8">
                      <input
                        id="trade-edate-input"
                        type="date"
                        value={tradeEDateInput}
                        onChange={(e) => setTradeEDateInput(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 font-mono text-xs font-semibold text-[#0F1F1A] focus:outline-hidden focus:ring-2 focus:ring-[#006B3F]"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveChanges}
                    className="w-full h-10 px-4 rounded-lg bg-[#006B3F] hover:bg-[#005532] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </button>

                  {/* Live Configured Summary */}
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Saved Expiry Date:</span>
                      <span className="font-mono font-bold text-[#0F1F1A]">
                        {expiryConfig.tradeEDate || 'Not Configured'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Access Status:</span>
                      <span
                        className={`font-bold ${
                          startupStatus.clockTamperDetected || startupStatus.isExpired
                            ? 'text-rose-700'
                            : startupStatus.hasExpiryConfigured && startupStatus.isComputerRegistered
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {startupStatus.clockTamperDetected
                          ? 'Locked (Clock/Integrity Tamper)'
                          : startupStatus.isExpired
                          ? 'Expired (Access Blocked)'
                          : !startupStatus.isComputerRegistered
                          ? 'Awaiting Computer Registration'
                          : startupStatus.hasExpiryConfigured
                          ? `Authorized (${startupStatus.daysRemaining ?? 0} day(s) left)`
                          : 'Awaiting Trade EDate'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRefreshAll}
                  className="w-full h-9 px-4 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#006B3F]" />
                  <span>Refresh</span>
                </button>
              </div>
            ) : (
              <div className="p-4 space-y-2.5 text-[11px] text-slate-700 leading-relaxed">
                <div className="font-bold text-[#0F1F1A]">
                  Offline Clock-Tampering Protection &amp; Documented Limitations
                </div>
                <p>
                  HRMIS records a signed monotonic UTC high-water mark (
                  <span className="font-mono text-[#006B3F]">
                    {new Date(expiryConfig.maxSeenUtcMs).toISOString().slice(0, 19).replace('T', ' ')} UTC
                  </span>
                  ) and verifies SHA-256 integrity tags across both local SQLite storage and the
                  separate IndexedDB vault. Rolling the Windows clock backward (&gt;2 min) or editing
                  local license fields locks access immediately.
                </p>
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-950">
                  <strong>Offline Limitations:</strong> Without an external trusted NTP time server or
                  kernel-level hardware TPM counter, an offline system cannot detect clock rollback
                  performed <em>before</em> HRMIS is first launched or before the system clock ever
                  exceeds the expiry boundary. In browser-hosted mode, clearing all browser site data
                  removes client IndexedDB; packaging with a Windows native host stores bindings in{' '}
                  <span className="font-mono">HKLM\SOFTWARE</span> and{' '}
                  <span className="font-mono">%ProgramData%</span>.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Registered Computers Grid (7 cols on lg) */}
        <div className="lg:col-span-7 rounded-xl bg-white border border-slate-200 shadow-xs overflow-hidden flex flex-col min-h-[380px]">
          {/* Group-By Header Bar (mirrors screenshot's "Drag a column header here to group by that column") */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOverGroupBar(true);
            }}
            onDragLeave={() => setIsDragOverGroupBar(false)}
            onDrop={handleDropOnGroupBar}
            className={`px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2 text-xs transition-colors ${
              isDragOverGroupBar
                ? 'bg-emerald-50 border-emerald-300 text-[#006B3F]'
                : 'bg-[#0F1F1A] text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#edd6a8] shrink-0" />
              {groupByCol ? (
                <span className="flex items-center gap-2">
                  <span>Grouped by:</span>
                  <span className="px-2 py-0.5 rounded bg-[#006B3F] text-white font-semibold">
                    {GRID_COLUMNS.find((c) => c.key === groupByCol)?.label || groupByCol}
                  </span>
                </span>
              ) : (
                <span className="text-slate-300">
                  Drag a column header here to group by that column
                </span>
              )}
            </div>

            {groupByCol && (
              <button
                type="button"
                onClick={() => setGroupByCol(null)}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Ungroup</span>
              </button>
            )}
          </div>

          {/* Registered Computers Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  {GRID_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      draggable={Boolean(col.groupable)}
                      onDragStart={(e) => {
                        if (col.groupable) {
                          e.dataTransfer.setData('text/plain', col.groupable);
                        }
                      }}
                      title={col.groupable ? 'Drag to group bar above' : undefined}
                      className={`py-2.5 px-3 border-r last:border-r-0 border-slate-200 whitespace-nowrap select-none ${
                        col.groupable ? 'cursor-grab active:cursor-grabbing hover:bg-slate-200/70' : ''
                      }`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {registeredComputers.length === 0 ? (
                  <tr>
                    <td colSpan={GRID_COLUMNS.length} className="p-8 text-center text-slate-500">
                      No computers registered yet. Click <strong>Get This ComputerName</strong> and{' '}
                      <strong>Register Computer</strong> to register this workstation.
                    </td>
                  </tr>
                ) : groupedComputers ? (
                  groupedComputers.map(([groupVal, items]) => (
                    <React.Fragment key={groupVal}>
                      <tr className="bg-emerald-50/70 border-b border-emerald-200">
                        <td
                          colSpan={GRID_COLUMNS.length}
                          className="py-1.5 px-3 font-bold text-[#006B3F] text-[11px]"
                        >
                          {GRID_COLUMNS.find((c) => c.key === groupByCol)?.label}: {groupVal} (
                          {items.length})
                        </td>
                      </tr>
                      {items.map((comp) => {
                        const isCurrent =
                          comp.hardwareId.toUpperCase() === startupStatus.hardwareId.toUpperCase();
                        return (
                          <tr key={comp.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono text-slate-700">{comp.id}</td>
                            <td className="py-2 px-3 font-mono font-bold text-[#0F1F1A] whitespace-nowrap">
                              {comp.computerName}
                              {isCurrent && (
                                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-sans font-semibold">
                                  Current PC
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                              {comp.hardwareId}
                            </td>
                            <td className="py-2 px-3 text-slate-700">{comp.osPlatform}</td>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {comp.registeredAt.slice(0, 19).replace('T', ' ')}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-800">
                              {comp.registeredBy}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-800 whitespace-nowrap">
                              {comp.tradeEDate || 'Not Set'}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  comp.status === 'Active' && !startupStatus.isExpired
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {startupStatus.clockTamperDetected
                                  ? 'Tampered'
                                  : startupStatus.isExpired
                                  ? 'Expired'
                                  : comp.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                ) : (
                  registeredComputers.map((comp) => {
                    const isCurrent =
                      comp.hardwareId.toUpperCase() === startupStatus.hardwareId.toUpperCase();
                    return (
                      <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-700">{comp.id}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#0F1F1A] whitespace-nowrap">
                          {comp.computerName}
                          {isCurrent && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-sans font-semibold">
                              Current PC
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {comp.hardwareId}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{comp.osPlatform}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {comp.registeredAt.slice(0, 19).replace('T', ' ')}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {comp.registeredBy}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-800 whitespace-nowrap">
                          {comp.tradeEDate || 'Not Set'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              comp.status === 'Active' && !startupStatus.isExpired
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {startupStatus.clockTamperDetected
                              ? 'Tampered'
                              : startupStatus.isExpired
                              ? 'Expired'
                              : comp.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Registered Workstations: <strong className="text-[#0F1F1A]">{registeredComputers.length}</strong>
            </span>
            <span>
              Offline Vault:{' '}
              <strong className="text-[#006B3F]">
                {startupStatus.persistenceVaultActive ? 'Active (SQLite + IndexedDB)' : 'SQLite Local'}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
