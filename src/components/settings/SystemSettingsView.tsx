/**
 * Haros HRMIS - System Configuration, Backup & Recovery, and Audit Trail Management
 * Handles institutional settings, SSSS base rates, full JSON database snapshots,
 * pre-restore safety snapshots, WAL validation, and forensic change history inspection.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Settings,
  Database,
  History,
  Save,
  Download,
  Upload,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  FileCode,
  Calendar,
  Search,
  Eye,
  EyeOff,
  KeyRound,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { db } from '../../db/storage';
import { SystemSetting, AuditTrailLog } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { SearchableSelect } from '../common/SearchableSelect';
import { SlideOverPanel } from '../common/SlideOverPanel';

export type SystemSettingsTab = 'config' | 'backup' | 'audit' | 'password';

interface SystemSettingsViewProps {
  initialTab?: SystemSettingsTab;
}

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({ initialTab = 'config' }) => {
  const { currentUser, currentRole, isRole, refreshCurrentUser } = useAuth();
  const notifications = useNotifications();
  const isSystemAdmin = Boolean(
    currentUser &&
      isRole('System Administrator') &&
      currentUser.roleName === 'System Administrator'
  );
  const [activeTab, setActiveTab] = useState<SystemSettingsTab>(initialTab);
  const lastAuditLogRef = useRef<AuditTrailLog | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // --- Configuration Tab State ---
  const [settings, setSettings] = useState<SystemSetting[]>(() => db.getSystemSettings());
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  const handleSettingChange = (key: string, value: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.settingKey === key ? { ...s, settingValue: value } : s))
    );
  };

  const handleSaveAllSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const map: Record<string, string> = {};
    settings.forEach((s) => {
      map[s.settingKey] = s.settingValue;
    });
    db.bulkUpdateSystemSettings(map, currentUser?.username || 'admin');
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 3000);
  };

  // --- Backup & Restore Tab State ---
  const [backupHistory, setBackupHistory] = useState(() => db.getBackupHistory());
  const [restoreJsonInput, setRestoreJsonInput] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [confirmRestorePending, setConfirmRestorePending] = useState(false);

  const handleDownloadBackup = () => {
    const jsonStr = db.exportDatabaseSnapshot();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HAROS_HRMIS_FULL_WAL_SNAPSHOT_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupHistory(db.getBackupHistory());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRestoreJsonInput(content);
      setRestoreStatus(null);
      setConfirmRestorePending(false);
      notifications.success(
        'Backup File Loaded',
        `Loaded snapshot "${file.name}" for review. Confirm restore to apply changes.`,
        { module: 'Backup and Restore', actor: currentUser?.username }
      );
    };
    reader.readAsText(file);
  };

  const handleRequestRestore = () => {
    if (!restoreJsonInput.trim()) {
      const msg = 'Please select or paste a valid JSON database archive before restoring.';
      setRestoreStatus({ success: false, message: msg });
      notifications.warning('Backup Archive Required', msg, {
        module: 'Backup and Restore',
        actor: currentUser?.username,
      });
      return;
    }
    setConfirmRestorePending(true);
    setRestoreStatus(null);
  };

  const handleExecuteRestore = () => {
    setConfirmRestorePending(false);
    setIsRestoring(true);
    setTimeout(() => {
      const result = db.restoreDatabaseSnapshot(restoreJsonInput, currentUser?.username || 'admin');
      setRestoreStatus(result);
      setBackupHistory(db.getBackupHistory());
      setSettings(db.getSystemSettings());
      setIsRestoring(false);
    }, 350);
  };

  // --- Audit Trail Tab State ---
  const [auditSearch, setAuditSearch] = useState('');
  const [auditModuleFilter, setAuditModuleFilter] = useState('ALL');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditTrailLog | null>(null);

  const allLogs = useMemo(() => db.getAuditLogs(), [activeTab]);

  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      if (auditModuleFilter !== 'ALL' && log.module !== auditModuleFilter) return false;
      if (auditActionFilter !== 'ALL' && log.actionType !== auditActionFilter) return false;
      if (auditSearch.trim() !== '') {
        const q = auditSearch.toLowerCase();
        return (
          log.username.toLowerCase().includes(q) ||
          log.entityName.toLowerCase().includes(q) ||
          log.recordId.toLowerCase().includes(q) ||
          log.machineName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allLogs, auditModuleFilter, auditActionFilter, auditSearch]);

  const auditModules = useMemo(() => Array.from(new Set(allLogs.map((l) => l.module))), [allLogs]);

  // --- Password Reset Tab State (Accessible to ALL Users) ---
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showOwnPwds, setShowOwnPwds] = useState(false);
  const [ownResetNotice, setOwnResetNotice] = useState<{ success: boolean; message: string } | null>(null);

  // Admin Reset Any User Password State (System Administrator Only)
  const [usersRefresh, setUsersRefresh] = useState(0);
  const allUsers = useMemo(() => db.getUsers(), [usersRefresh, activeTab]);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [adminNewPwd, setAdminNewPwd] = useState('');
  const [adminConfirmPwd, setAdminConfirmPwd] = useState('');
  const [showAdminPwds, setShowAdminPwds] = useState(false);
  const [adminResetNotice, setAdminResetNotice] = useState<{ success: boolean; message: string } | null>(null);

  const handleOwnPasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    setOwnResetNotice(null);
    if (!currentUser) return;
    if (!currentPwd || !newPwd || !confirmPwd) {
      const msg = 'Please complete all password fields.';
      setOwnResetNotice({ success: false, message: msg });
      notifications.warning('Incomplete Password Form', msg, { module: 'Security & Auth', actor: currentUser.username });
      return;
    }
    if (newPwd.length < 6) {
      const msg = 'New password must be at least 6 characters long.';
      setOwnResetNotice({ success: false, message: msg });
      notifications.warning('Password Policy Warning', msg, { module: 'Security & Auth', actor: currentUser.username });
      return;
    }
    if (newPwd !== confirmPwd) {
      const msg = 'New password and confirmation do not match.';
      setOwnResetNotice({ success: false, message: msg });
      notifications.warning('Password Mismatch', msg, { module: 'Security & Auth', actor: currentUser.username });
      return;
    }
    const res = db.resetOwnPassword(currentUser.username, currentPwd, newPwd);
    setOwnResetNotice({ success: res.success, message: res.message });
    if (res.success) {
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      refreshCurrentUser();
      setUsersRefresh((v) => v + 1);
    } else {
      notifications.error('Password Update Failed', res.message, { module: 'Security & Auth', actor: currentUser.username });
    }
  };

  const handleAdminPasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminResetNotice(null);
    if (!isSystemAdmin || !currentUser || !currentRole) {
      const msg = 'Access Denied: Only the System Administrator can reset other users\' passwords.';
      setAdminResetNotice({ success: false, message: msg });
      notifications.security('Unauthorized Password Reset', msg, { module: 'Security & Auth', actor: currentUser?.username });
      return;
    }
    if (!targetUserId) {
      const msg = 'Please select a target user account.';
      setAdminResetNotice({ success: false, message: msg });
      notifications.warning('Target User Required', msg, { module: 'Security & Auth', actor: currentUser.username });
      return;
    }
    if (adminNewPwd.length < 6) {
      const msg = 'New password must be at least 6 characters long.';
      setAdminResetNotice({ success: false, message: msg });
      notifications.warning('Password Policy Warning', msg, { module: 'Security & Auth', actor: currentUser.username });
      return;
    }
    if (adminNewPwd !== adminConfirmPwd) {
      const msg = 'Passwords do not match.';
      setAdminResetNotice({ success: false, message: msg });
      notifications.warning('Password Mismatch', msg, { module: 'Security & Auth', actor: currentUser.username });
      return;
    }
    const res = db.adminResetUserPassword(
      parseInt(targetUserId, 10),
      adminNewPwd,
      currentUser.username,
      currentRole.roleName
    );
    setAdminResetNotice({ success: res.success, message: res.message });
    if (res.success) {
      setAdminNewPwd('');
      setAdminConfirmPwd('');
      refreshCurrentUser();
      setUsersRefresh((v) => v + 1);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden text-slate-800 text-xs">
      {/* Top Header */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">System Configuration, Backups & Audit Trail</h1>
            <p className="text-[11px] text-slate-500">
              Institutional parameters, relational database snapshots, pre-restore recovery, and immutable event ledger
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap bg-slate-100 p-0.5 rounded border border-slate-200 gap-0.5">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 rounded font-semibold flex items-center space-x-1.5 transition-colors ${
              activeTab === 'config' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Parameters & Config</span>
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded font-semibold flex items-center space-x-1.5 transition-colors ${
              activeTab === 'backup' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Backup & Restore (WAL)</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded font-semibold flex items-center space-x-1.5 transition-colors ${
              activeTab === 'audit' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Forensic Audit Ledger</span>
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-3 py-1.5 rounded font-semibold flex items-center space-x-1.5 transition-colors ${
              activeTab === 'password' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Password Reset</span>
          </button>
        </div>
      </div>

      {/* Main Tab Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* TAB 1: SYSTEM PARAMETERS & CONFIGURATION */}
        {activeTab === 'config' && (
          <form onSubmit={handleSaveAllSettings} className="max-w-4xl mx-auto space-y-4">
            {isSavedNotice && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2 text-xs font-semibold shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Institutional parameters saved and committed to SQLite WAL engine with audit verification.</span>
              </div>
            )}

            {/* General Institution Parameters */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
                <Layers className="w-4 h-4 text-blue-600" />
                <h2 className="font-bold text-slate-900 text-sm">Institutional & Sovereign Parameters</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settings
                  .filter((s) => ['General', 'Payroll', 'Storage'].includes(s.category))
                  .map((item) => (
                    <div key={item.settingKey} className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">{item.description}</label>
                      <input
                        type="text"
                        value={item.settingValue}
                        onChange={(e) => handleSettingChange(item.settingKey, e.target.value)}
                        className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono"
                      />
                      <span className="text-[10px] text-slate-400 font-mono">Key: {item.settingKey}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Statutory Civil Service Policies */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h2 className="font-bold text-slate-900 text-sm">Statutory Civil Service Thresholds</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settings
                  .filter((s) => s.category === 'Civil Service Rules')
                  .map((item) => (
                    <div key={item.settingKey} className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">{item.description}</label>
                      <input
                        type="number"
                        value={item.settingValue}
                        onChange={(e) => handleSettingChange(item.settingKey, e.target.value)}
                        className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono"
                      />
                      <span className="text-[10px] text-slate-400 font-mono">Key: {item.settingKey}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Configurable Business Rules & Data Validation (Section 25) */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h2 className="font-bold text-slate-900 text-sm">Business Rules & Configurable Data Validation (Section 25)</h2>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                  12 Active Integrity Rules
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settings
                  .filter((s) => s.category === 'Validation Rules')
                  .map((item) => {
                    const isBool = item.settingValue === 'true' || item.settingValue === 'false';
                    return (
                      <div key={item.settingKey} className="p-3 rounded border border-slate-200 bg-slate-50/70 space-y-1.5">
                        <div className="flex items-start justify-between gap-3">
                          <label className="block text-[11px] font-semibold text-slate-800 leading-snug">
                            {item.description}
                          </label>
                          {isBool ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleSettingChange(
                                  item.settingKey,
                                  item.settingValue === 'true' ? 'false' : 'true'
                                )
                              }
                              className={`px-2.5 py-1 rounded text-[10px] font-bold shrink-0 transition-colors ${
                                item.settingValue === 'true'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-300 text-slate-700'
                              }`}
                            >
                              {item.settingValue === 'true' ? 'ENFORCED' : 'DISABLED'}
                            </button>
                          ) : null}
                        </div>
                        {!isBool && (
                          <input
                            type="number"
                            min={1}
                            value={item.settingValue}
                            onChange={(e) => handleSettingChange(item.settingKey, e.target.value)}
                            className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono"
                          />
                        )}
                        <div className="text-[10px] text-slate-400 font-mono">Rule Key: {item.settingKey}</div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="h-9 px-5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center space-x-2 shadow-xs transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save All System Parameters & Rules</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: BACKUP & RESTORE ENGINE (SECTION 21) */}
        {activeTab === 'backup' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Engine Overview Banner */}
            <div className="bg-slate-900 text-white rounded-lg p-5 shadow-sm flex items-start justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <Database className="w-5 h-5 text-amber-400" />
                  <h2 className="font-bold text-sm">Database Engine Snapshot & WAL Integrity</h2>
                </div>
                <p className="text-[11px] text-slate-300 max-w-2xl leading-relaxed">
                  Haros HRMIS operates an offline standalone relational architecture with Write-Ahead Logging (WAL)
                  guarantees. Create full JSON database archives or restore complete system states with automated
                  pre-restore safety snapshots.
                </p>
              </div>

              <button
                onClick={handleDownloadBackup}
                className="h-9 px-4 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center space-x-2 shadow-sm transition-colors shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Create Full Backup Now</span>
              </button>
            </div>

            {/* Restore Card */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Restore Database from Snapshot</h3>
                </div>
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  Pre-Restore Safety Snapshot Protected
                </span>
              </div>

              {restoreStatus && (
                <div
                  className={`p-3 rounded-lg border text-xs font-semibold flex items-center space-x-2 ${
                    restoreStatus.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {restoreStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{restoreStatus.message}</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Upload Snapshot JSON File or Paste Archive:
                  </label>
                  <label className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer border border-slate-300 transition-colors">
                    <span>Browse File...</span>
                    <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                <textarea
                  rows={4}
                  value={restoreJsonInput}
                  onChange={(e) => setRestoreJsonInput(e.target.value)}
                  placeholder="Paste database snapshot JSON here, or click Browse File above..."
                  className="w-full p-2.5 rounded border border-slate-300 font-mono text-[10px] text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {confirmRestorePending && (
                <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start space-x-2 text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Confirm Full Database Snapshot Restoration</div>
                      <div className="text-[11px] text-amber-800">
                        A pre-restore safety snapshot will automatically be archived before overwriting active tables.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setConfirmRestorePending(false)}
                      className="h-8 px-3 rounded bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteRestore}
                      className="h-8 px-3 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                    >
                      Confirm & Restore Archive
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="text-[10px] text-slate-500">
                  {restoreJsonInput ? `${restoreJsonInput.length.toLocaleString()} characters loaded` : 'No file loaded'}
                </div>
                <button
                  type="button"
                  disabled={isRestoring || !restoreJsonInput.trim()}
                  onClick={handleRequestRestore}
                  className={`h-8 px-4 rounded font-semibold flex items-center space-x-1.5 transition-colors ${
                    isRestoring || !restoreJsonInput.trim()
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                  <span>{isRestoring ? 'Restoring System...' : 'Execute Database Restore'}</span>
                </button>
              </div>
            </div>

            {/* Backup History Table */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">Recent Backup & Snapshot History</h3>
              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
                      <th className="p-2.5">Snapshot Reference</th>
                      <th className="p-2.5">Snapshot Type</th>
                      <th className="p-2.5">Size</th>
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5 text-right">Integrity Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {backupHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="p-2.5 font-mono font-bold text-slate-900">{item.filename}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.type.includes('Safety')
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-blue-50 text-blue-800'
                            }`}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono">{item.sizeKb} KB</td>
                        <td className="p-2.5 font-mono text-slate-600">
                          {new Date(item.timestamp).toLocaleString('en-GB')}
                        </td>
                        <td className="p-2.5 text-right">
                          <span className="inline-flex items-center text-emerald-700 font-semibold font-mono text-[10px]">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            VERIFIED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: IMMUTABLE AUDIT TRAIL LEDGER (SECTION 20) */}
        {activeTab === 'audit' && (
          <div className="max-w-7xl mx-auto space-y-4">
            {/* Filter toolbar */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-wrap gap-2.5 items-center justify-between">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search audit trail by actor, entity, record ID, or workstation..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 rounded border border-slate-300 bg-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="min-w-[170px]">
                  <SearchableSelect
                    value={auditModuleFilter}
                    onChange={(val) => setAuditModuleFilter(val)}
                    options={[
                      { value: 'ALL', label: `All Modules (${auditModules.length})` },
                      ...auditModules.map((m) => ({
                        value: m,
                        label: m,
                      })),
                    ]}
                    placeholder="All Modules"
                    searchPlaceholder="Filter modules..."
                  />
                </div>

                <div className="min-w-[130px]">
                  <SearchableSelect
                    value={auditActionFilter}
                    onChange={(val) => setAuditActionFilter(val)}
                    options={[
                      { value: 'ALL', label: 'All Actions' },
                      { value: 'INSERT', label: 'INSERT' },
                      { value: 'UPDATE', label: 'UPDATE' },
                      { value: 'DELETE', label: 'DELETE' },
                      { value: 'SYSTEM_INIT', label: 'SYSTEM_INIT' },
                    ]}
                    placeholder="All Actions"
                    searchPlaceholder="Filter actions..."
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-slate-500 font-mono text-[11px]">
                  Events Logged: <b className="text-slate-800">{filteredLogs.length}</b>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const headers = ['Timestamp (UTC)', 'Actor', 'Workstation', 'Module', 'Action', 'Entity', 'Record ID'];
                    const rows = filteredLogs.map((l) => [
                      l.timestampUtc,
                      `"${l.username}"`,
                      `"${l.machineName}"`,
                      `"${l.module}"`,
                      l.actionType,
                      `"${l.entityName}"`,
                      `"${l.recordId}"`,
                    ]);
                    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `AUDIT_TRAIL_${new Date().toISOString().slice(0, 10)}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    notifications.security(
                      'Audit Ledger Exported',
                      `Exported ${filteredLogs.length} immutable audit log entry(ies) to CSV.`,
                      { module: 'Security & Audit', actor: currentUser?.username }
                    );
                  }}
                  className="h-8 px-3 rounded bg-slate-800 hover:bg-slate-900 text-white font-semibold flex items-center space-x-1.5 text-[11px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Ledger</span>
                </button>
              </div>
            </div>

            {/* Audit Log Table */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
                      <th className="p-2.5">Timestamp (UTC)</th>
                      <th className="p-2.5">Actor</th>
                      <th className="p-2.5">Workstation</th>
                      <th className="p-2.5">Module</th>
                      <th className="p-2.5">Action</th>
                      <th className="p-2.5">Entity</th>
                      <th className="p-2.5">Record ID</th>
                      <th className="p-2.5 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 text-slate-500">
                          {new Date(log.timestampUtc).toLocaleString('en-GB')}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">{log.username}</td>
                        <td className="p-2.5 text-slate-600">{log.machineName}</td>
                        <td className="p-2.5 font-sans font-semibold text-slate-800">{log.module}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              log.actionType === 'INSERT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.actionType === 'UPDATE'
                                ? 'bg-blue-100 text-blue-800'
                                : log.actionType === 'DELETE'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {log.actionType}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-700">{log.entityName}</td>
                        <td className="p-2.5 font-bold text-blue-700">{log.recordId}</td>
                        <td className="p-2.5 text-right font-sans">
                          <button
                            onClick={() => setSelectedAuditLog(log)}
                            className="text-blue-600 hover:text-blue-800 font-semibold text-[11px] inline-flex items-center"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Diff
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PASSWORD RESET (ACCESSIBLE TO ALL AUTHENTICATED USERS) */}
        {activeTab === 'password' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Self-Service Password Reset Card (All Users) */}
            <form
              onSubmit={handleOwnPasswordReset}
              className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-sm">Reset My Account Password</h2>
                    <p className="text-[11px] text-slate-500">
                      Available to all Civil Service users for self-service credential rotation
                    </p>
                  </div>
                </div>
                {currentUser && (
                  <div className="px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700">
                    <UserCheck className="w-3.5 h-3.5 inline mr-1 text-emerald-600" />
                    {currentUser.username} ({currentRole?.roleName})
                  </div>
                )}
              </div>

              {currentUser?.passwordUpdatedAt && (
                <div className="text-[11px] text-slate-500">
                  Last password change:{' '}
                  <span className="font-mono font-semibold text-slate-700">
                    {new Date(currentUser.passwordUpdatedAt).toLocaleString('en-GB')}
                  </span>
                </div>
              )}

              {ownResetNotice && (
                <div
                  className={`p-3 rounded-lg border text-xs font-medium flex items-center space-x-2 ${
                    ownResetNotice.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {ownResetNotice.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{ownResetNotice.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Current Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showOwnPwds ? 'text' : 'password'}
                      required
                      value={currentPwd}
                      onChange={(e) => setCurrentPwd(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full h-9 px-3 pr-9 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOwnPwds(!showOwnPwds)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                      title={showOwnPwds ? 'Hide passwords' : 'Show passwords'}
                    >
                      {showOwnPwds ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    New Password * (min 6 chars)
                  </label>
                  <input
                    type={showOwnPwds ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full h-9 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Confirm New Password *
                  </label>
                  <input
                    type={showOwnPwds ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full h-9 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-500">
                  Password updates are encrypted locally and logged to the Audit Trail.
                </span>
                <button
                  type="submit"
                  className="h-9 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Reset My Password</span>
                </button>
              </div>
            </form>

            {/* System Administrator: Reset Password for Any User */}
            {isSystemAdmin ? (
              <form
                onSubmit={handleAdminPasswordReset}
                className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4"
              >
                <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Administrator User Password Reset &amp; Account Unlock
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      System Administrator control to reset credentials and clear failed-attempt locks for any user
                    </p>
                  </div>
                </div>

                {adminResetNotice && (
                  <div
                    className={`p-3 rounded-lg border text-xs font-medium flex items-center space-x-2 ${
                      adminResetNotice.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    {adminResetNotice.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{adminResetNotice.message}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Select User Account *
                    </label>
                    <SearchableSelect
                      value={targetUserId}
                      onChange={(val) => setTargetUserId(val)}
                      options={allUsers.map((u) => ({
                        value: u.id.toString(),
                        label: `${u.username} (${u.fullName})`,
                        subLabel: u.roleName,
                        badge: u.failedLoginAttempts >= 5 ? 'Locked' : u.isActive ? 'Active' : 'Inactive',
                      }))}
                      placeholder="Select user account..."
                      searchPlaceholder="Search username or name..."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      New Temporary Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminPwds ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={adminNewPwd}
                        onChange={(e) => setAdminNewPwd(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full h-9 px-3 pr-9 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPwds(!showAdminPwds)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                        title={showAdminPwds ? 'Hide passwords' : 'Show passwords'}
                      >
                        {showAdminPwds ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Confirm New Password *
                    </label>
                    <input
                      type={showAdminPwds ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={adminConfirmPwd}
                      onChange={(e) => setAdminConfirmPwd(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full h-9 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="submit"
                    className="h-9 px-4 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Reset User Password &amp; Unlock</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center space-x-2.5 text-xs text-slate-600">
                <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                <span>
                  Only the <strong>System Administrator</strong> can reset passwords or clear failed-login
                  locks for other users.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AUDIT LOG JSON DIFF DRAWER */}
      {(() => {
        if (selectedAuditLog) lastAuditLogRef.current = selectedAuditLog;
        const activeAuditLog = selectedAuditLog || lastAuditLogRef.current;

        return (
          <SlideOverPanel
            isOpen={Boolean(selectedAuditLog)}
            onClose={() => setSelectedAuditLog(null)}
            title={
              activeAuditLog
                ? `Audit Event #${activeAuditLog.id} • ${activeAuditLog.actionType}`
                : 'Audit Event Inspector'
            }
            subtitle={
              activeAuditLog
                ? `${activeAuditLog.entityName} • ${activeAuditLog.module}`
                : 'Forensic JSON State Diff'
            }
            icon={<FileCode className="w-4 h-4" />}
            maxWidthClass="max-w-2xl"
            overlayClassName="bg-black/40"
          >
            {activeAuditLog && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-5 space-y-3 font-mono text-[11px]">
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded border border-slate-200">
                    <div>
                      <span className="text-slate-500">Actor:</span> <b>{activeAuditLog.username}</b>
                    </div>
                    <div>
                      <span className="text-slate-500">Workstation:</span> <b>{activeAuditLog.machineName}</b>
                    </div>
                    <div>
                      <span className="text-slate-500">Module:</span> <b>{activeAuditLog.module}</b>
                    </div>
                    <div>
                      <span className="text-slate-500">Timestamp:</span>{' '}
                      <b>{new Date(activeAuditLog.timestampUtc).toLocaleString('en-GB')}</b>
                    </div>
                  </div>

                  {activeAuditLog.oldValuesJson && (
                    <div className="space-y-1">
                      <div className="font-bold text-rose-700">PREVIOUS VALUE (OLD):</div>
                      <pre className="p-2.5 bg-rose-50/70 border border-rose-200 rounded text-rose-950 text-[10px] overflow-x-auto max-h-56">
                        {JSON.stringify(JSON.parse(activeAuditLog.oldValuesJson), null, 2)}
                      </pre>
                    </div>
                  )}

                  {activeAuditLog.newValuesJson && (
                    <div className="space-y-1">
                      <div className="font-bold text-emerald-700">NEW VALUE (COMMITTED):</div>
                      <pre className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded text-emerald-950 text-[10px] overflow-x-auto max-h-72">
                        {JSON.stringify(JSON.parse(activeAuditLog.newValuesJson), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedAuditLog(null)}
                    className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs"
                  >
                    Close Inspector
                  </button>
                </div>
              </div>
            )}
          </SlideOverPanel>
        );
      })()}
    </div>
  );
};
