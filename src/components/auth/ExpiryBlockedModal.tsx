/**
 * Haros HRMIS - Application Access Expiry & Clock-Tamper Lock Popup Modal
 * Enforces Trade EDate expiry restriction while keeping all HRMIS records safely preserved.
 */

import React from 'react';
import { ShieldAlert, Phone, KeyRound, Database } from 'lucide-react';
import { StartupValidationResult } from '../../types';

interface ExpiryBlockedModalProps {
  isOpen: boolean;
  startupStatus: StartupValidationResult;
  onRequestAdminRenewal: () => void;
}

export const ExpiryBlockedModal: React.FC<ExpiryBlockedModalProps> = ({
  isOpen,
  startupStatus,
  onRequestAdminRenewal,
}) => {
  if (!isOpen) return null;

  const isClockTampered = startupStatus.clockTamperDetected;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="expiry-lock-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white border border-rose-200 shadow-2xl overflow-hidden animate-login-card">
        {/* Header */}
        <div className="px-6 py-4 bg-rose-700 text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 id="expiry-lock-title" className="text-base font-bold tracking-tight">
              {isClockTampered
                ? 'HRMIS Access Locked — Security & Clock Verification Alert'
                : 'HRMIS Access Authorization Expired'}
            </h2>
            <p className="text-xs text-rose-100">
              Workstation: {startupStatus.detectedComputerName} ({startupStatus.hardwareId})
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-sm text-[#0F1F1A]">
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 font-semibold leading-relaxed">
            Your HRMIS access authorization has expired. Please contact the administrator for renewal.
          </div>

          {isClockTampered && startupStatus.clockTamperReason && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs leading-relaxed">
              <div className="font-bold uppercase tracking-wider text-[10px] text-amber-800 mb-1">
                Offline Clock-Tampering / Integrity Protection Triggered
              </div>
              {startupStatus.clockTamperReason}
            </div>
          )}

          {/* Required Administrator Contact Numbers */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Contact:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-sm font-bold text-[#006B3F]">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
                <Phone className="w-4 h-4 text-[#C9A24D] shrink-0" />
                <span>+233243586743</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
                <Phone className="w-4 h-4 text-[#C9A24D] shrink-0" />
                <span>+233266363781</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950">
            <Database className="w-4 h-4 text-[#006B3F] shrink-0 mt-0.5" />
            <span>
              All employee records, payroll history, and SQLite database information remain safely
              preserved offline.
              {startupStatus.tradeEDate ? (
                <>
                  {' '}
                  Configured Trade EDate:{' '}
                  <strong className="font-mono">{startupStatus.tradeEDate}</strong>.
                </>
              ) : null}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">
            Administrator authorization required for renewal
          </span>
          <button
            type="button"
            onClick={onRequestAdminRenewal}
            className="px-4 py-2 rounded-lg bg-[#006B3F] hover:bg-[#005532] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Administrator Renewal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
