/**
 * Haros HRMIS - Administrative Config Authorization Gate
 * Requires hashed credential verification before granting access to Computer Registration & Expiry Control.
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, User as UserIcon, Eye, EyeOff, AlertCircle, X } from 'lucide-react';
import { db } from '../../db/storage';
import { useNotifications } from '../../context/NotificationContext';

interface ActivationAdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorized: (adminUsername: string) => void;
  purposeTitle?: string;
}

export const ActivationAdminAuthModal: React.FC<ActivationAdminAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthorized,
  purposeTitle = 'Administrator Authorization Required',
}) => {
  const notifications = useNotifications();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPassword('');
      setShowPassword(false);
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !password) {
      setErrorMsg('Please enter administrator username and password.');
      return;
    }

    const result = db.authenticateActivationAdmin(username, password);
    if (!result.success || !result.admin) {
      setErrorMsg(result.error || 'Authorization denied.');
      notifications.security(
        'Administrative Config Access Denied',
        'Invalid administrator credentials provided for workstation configuration.',
        { module: 'Computer Registration', actor: username.trim() || 'UNKNOWN' }
      );
      return;
    }

    notifications.success(
      'Administrator Authorized',
      `Access granted to Administrative Configuration (${result.admin.username}).`,
      { module: 'Computer Registration', actor: result.admin.username }
    );
    onAuthorized(result.admin.username);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-auth-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-login-card">
        <div className="px-5 py-4 bg-[#0F1F1A] text-white flex items-center justify-between border-b border-[#C9A24D]/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#006B3F] flex items-center justify-center border border-[#C9A24D]/50">
              <ShieldCheck className="w-4 h-4 text-[#edd6a8]" />
            </div>
            <div>
              <h3 id="admin-auth-modal-title" className="text-sm font-bold tracking-tight">
                {purposeTitle}
              </h3>
              <p className="text-[11px] text-slate-300">
                Workstation Registration &amp; Application Expiry Control
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close authorization dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs text-[#0F1F1A] leading-relaxed">
            Restricted access. Enter authorized workstation licensing administrator credentials to
            access <strong>ADMINISTRATIVE CONFIG</strong>.
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-700 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="act-admin-user" className="block text-xs font-semibold text-[#0F1F1A]">
              Administrator Username
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <input
                id="act-admin-user"
                type="text"
                autoFocus
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter administrator username"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-white border border-slate-300 text-sm text-[#0F1F1A] focus:outline-hidden focus:ring-2 focus:ring-[#006B3F]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="act-admin-pass" className="block text-xs font-semibold text-[#0F1F1A]">
              Administrator Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <input
                id="act-admin-pass"
                type={showPassword ? 'text' : 'password'}
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter administrator password"
                className="w-full h-10 pl-9 pr-10 rounded-lg bg-white border border-slate-300 text-sm text-[#0F1F1A] focus:outline-hidden focus:ring-2 focus:ring-[#006B3F]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1.5 top-1 w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#006B3F] hover:bg-[#005532] transition-colors shadow-xs flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Authorize Access</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
