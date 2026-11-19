/**
 * Haros HRMIS - Local Relational Database Diagnostics & Info Modal
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Lock,
  Trash2,
} from 'lucide-react';
import { db } from '../../db/storage';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { SlideOverPanel } from '../common/SlideOverPanel';

interface DatabaseInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetComplete: () => void;
}

export const DatabaseInfoModal: React.FC<DatabaseInfoModalProps> = ({
  isOpen,
  onClose,
  onResetComplete,
}) => {
  const { currentUser, currentRole, isRole } = useAuth();
  const notifications = useNotifications();
  const [resetting, setResetting] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSystemAdmin = Boolean(
    currentUser &&
      isRole('System Administrator') &&
      currentUser.roleName === 'System Administrator'
  );

  useEffect(() => {
    if (!isOpen) {
      setConfirmPending(false);
      setErrorMsg(null);
    }
  }, [isOpen]);

  const handleRequestReset = () => {
    if (!isSystemAdmin) return;
    setErrorMsg(null);
    setConfirmPending(true);
  };

  const handleConfirmReset = () => {
    if (!isSystemAdmin || !currentUser || !currentRole) {
      const msg = 'Access Denied: Only the System Administrator can perform a Factory Reset.';
      setErrorMsg(msg);
      setConfirmPending(false);
      notifications.security('Factory Reset Access Denied', msg, {
        module: 'Database Engine',
        actor: currentUser?.username,
      });
      return;
    }

    setResetting(true);
    setErrorMsg(null);
    setTimeout(() => {
      try {
        db.factoryResetAllData(currentUser.username, currentRole.roleName);
        setConfirmPending(false);
        setResetting(false);
        onResetComplete();
      } catch (err: any) {
        const msg = err?.message || 'Factory reset failed.';
        setErrorMsg(msg);
        setResetting(false);
        notifications.error('Factory Reset Error', msg, {
          module: 'Database Engine',
          actor: currentUser.username,
        });
      }
    }, 350);
  };

  const tables = isOpen
    ? [
        { name: 'Employees', count: db.getEmployees().length, role: 'Master Employee Registry' },
        { name: 'EmployeePersonalInfo', count: db.getEmployees().length, role: 'Biographical & Next-of-Kin' },
        { name: 'EmployeeEmploymentInfo', count: db.getEmployees().length, role: 'Active Placement & Grade' },
        { name: 'Mdas', count: db.getMdas().length, role: 'Ministries, Departments & Agencies' },
        { name: 'Departments', count: db.getDepartments().length, role: 'Directorates & Units' },
        { name: 'Units', count: db.getUnits().length, role: 'Operational Sub-Units' },
        { name: 'EstablishmentPositions', count: db.getEstablishmentPositions().length, role: 'Cadre Quotas & Vacancies' },
        { name: 'StaffMovements', count: db.getStaffMovements().length, role: 'Active Movement Workflow' },
        { name: 'StaffMovementHistory', count: db.getStaffMovementHistory().length, role: 'Immutable Movement Ledger' },
        { name: 'LeaveApplications', count: db.getLeaveApplications().length, role: 'Leave Filings & Approvals' },
        { name: 'AttendanceRecords', count: db.getAttendanceRecords().length, role: 'Daily Timekeeping Logs' },
        { name: 'TrainingPrograms', count: db.getTrainingPrograms().length, role: 'Capacity Building Programs' },
        { name: 'PerformanceAppraisals', count: db.getPerformanceAppraisals().length, role: 'SPAS Evaluation Cycles' },
        { name: 'PayrollRuns', count: db.getPayrollRuns().length, role: 'Monthly Payroll Batches' },
        { name: 'EmployeePayslips', count: db.getEmployeePayslips().length, role: 'Generated Officer Payslips' },
        { name: 'SeparationRecords', count: db.getSeparationRecords().length, role: 'Retirement & Exit Clearances' },
        { name: 'DisciplinaryCases', count: db.getDisciplinaryCases().length, role: 'Disciplinary Inquiries' },
        { name: 'AuditTrailLogs', count: db.getAuditLogs().length, role: 'Tamper-Proof Audit Records' },
        { name: 'ComputerRegistrations', count: db.getRegisteredComputers().length, role: 'Workstation Activation & Hardware Bindings' },
        { name: 'Users', count: db.getUsers().length, role: 'Security Accounts & RBAC' },
        { name: 'GradeLevels', count: db.getGradeLevels().length, role: 'Statutory Civil Service Scale (Schema)' },
      ]
    : [];

  return (
    <SlideOverPanel
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={resetting}
      title="SQLite Relational Database Architecture"
      subtitle="ACID Compliant • Write-Ahead Logging (WAL)"
      icon={<Database className="w-4 h-4" />}
      maxWidthClass="max-w-2xl"
      overlayClassName="bg-black/40"
    >
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Storage Path Card */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 font-mono text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-sans font-semibold">Active Database Path:</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-sans font-bold">
              ACID Compliant
            </span>
          </div>
          <div className="text-cyan-800 font-bold break-all">
            %ProgramData%\HarosHRMIS\Data\hrmis.db
          </div>
          <div className="flex items-center space-x-3 text-[10px] text-slate-500 pt-1 font-sans">
            <span className="flex items-center">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 mr-1" />
              Journal Mode: WAL (Write-Ahead Logging)
            </span>
            <span>•</span>
            <span className="flex items-center">
              <ShieldCheck className="w-3 h-3 text-blue-600 mr-1" />
              Zero Cloud Egress
            </span>
          </div>
        </div>

        {/* Tables Overview */}
        <div>
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Relational Tables & Live Record Counts:
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 text-[11px]">
                <tr>
                  <th className="py-1.5 px-3">Table Name</th>
                  <th className="py-1.5 px-3">Subsystem Description</th>
                  <th className="py-1.5 px-3 text-right">Rows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tables.map((t) => (
                  <tr key={t.name} className="hover:bg-slate-50">
                    <td className="py-1.5 px-3 font-mono font-medium text-slate-900">{t.name}</td>
                    <td className="py-1.5 px-3 text-slate-600">{t.role}</td>
                    <td className="py-1.5 px-3 text-right font-mono font-bold text-blue-700">
                      {t.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Factory Reset Action - Strictly Restricted to System Administrator */}
        {isSystemAdmin ? (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start space-x-2.5 text-rose-950">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <div className="font-bold text-xs">
                    Factory Reset — Delete All System Data
                  </div>
                  <div className="text-[11px] text-rose-800 leading-relaxed">
                    Permanently deletes all staff records, MDAs, departments, movements, leave, attendance,
                    training, appraisals, payroll runs/payslips, separations, disciplinary cases, backups,
                    audit logs, and non-admin user accounts.
                  </div>
                </div>
              </div>
              {!confirmPending && (
                <button
                  type="button"
                  onClick={handleRequestReset}
                  disabled={resetting}
                  className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shrink-0 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Factory Reset</span>
                </button>
              )}
            </div>

            {confirmPending && (
              <div className="p-3 rounded-md bg-white border border-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-[11px] text-rose-900 font-medium">
                  <strong>Final Warning:</strong> All operational, organizational, staff, financial, and audit
                  records will be wiped to <span className="font-mono font-bold">0</span>. Only your{' '}
                  <strong>System Administrator</strong> account and statutory reference scales remain.
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmPending(false)}
                    disabled={resetting}
                    className="px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReset}
                    disabled={resetting}
                    className="px-3 py-1.5 rounded bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
                    <span>{resetting ? 'Deleting All Data...' : 'Confirm Delete All Data'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 flex items-center space-x-2.5 text-slate-700">
            <Lock className="w-4 h-4 shrink-0 text-slate-500" />
            <div>
              <div className="font-bold text-xs text-slate-800">
                Factory Reset Restricted — System Administrator Only
              </div>
              <div className="text-[11px] text-slate-600">
                Full system data deletion is locked for your current role (
                <span className="font-semibold text-slate-800">
                  {currentRole?.roleName || 'Unauthenticated'}
                </span>
                ). Sign in as <strong>System Administrator</strong> to access Factory Reset.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
        <button
          type="button"
          onClick={onClose}
          disabled={resetting}
          className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition-colors disabled:opacity-40"
        >
          Close Diagnostics
        </button>
      </div>
    </SlideOverPanel>
  );
};
