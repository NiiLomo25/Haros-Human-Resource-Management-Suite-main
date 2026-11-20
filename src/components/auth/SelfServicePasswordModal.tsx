import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import { db } from '../../db/storage';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { SlideOverPanel } from '../common/SlideOverPanel';

interface SelfServicePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SelfServicePasswordModal: React.FC<SelfServicePasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, currentRole, refreshCurrentUser } = useAuth();
  const notifications = useNotifications();

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwds, setShowPwds] = useState(false);
  const [notice, setNotice] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setShowPwds(false);
      setNotice(null);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setNotice(null);

    if (!currentPwd || !newPwd || !confirmPwd) {
      const msg = 'Please complete all password fields.';
      setNotice({ success: false, message: msg });
      notifications.warning('Incomplete Password Form', msg, {
        module: 'Security & Auth',
        actor: currentUser.username,
      });
      return;
    }

    if (newPwd.length < 6) {
      const msg = 'New password must be at least 6 characters long.';
      setNotice({ success: false, message: msg });
      notifications.warning('Password Policy Warning', msg, {
        module: 'Security & Auth',
        actor: currentUser.username,
      });
      return;
    }

    if (newPwd !== confirmPwd) {
      const msg = 'New password and confirmation do not match.';
      setNotice({ success: false, message: msg });
      notifications.warning('Password Mismatch', msg, {
        module: 'Security & Auth',
        actor: currentUser.username,
      });
      return;
    }

    const res = db.resetOwnPassword(currentUser.username, currentPwd, newPwd);
    setNotice({ success: res.success, message: res.message });
    if (res.success) {
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      refreshCurrentUser();
      notifications.success('Password Updated', res.message, {
        module: 'Security & Auth',
        actor: currentUser.username,
      });
    } else {
      notifications.error('Password Update Failed', res.message, {
        module: 'Security & Auth',
        actor: currentUser.username,
      });
    }
  };

  return (
    <SlideOverPanel
      isOpen={isOpen && Boolean(currentUser)}
      onClose={onClose}
      title="Reset My Account Password"
      subtitle="Self-service credential rotation for your signed-in account"
      icon={<KeyRound className="w-4 h-4" />}
      maxWidthClass="max-w-md"
      overlayClassName="bg-slate-950/60 backdrop-blur-[1px]"
    >
      {currentUser && (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2 min-w-0">
                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="truncate">
                  <div className="font-bold text-slate-900 truncate">{currentUser.fullName}</div>
                  <div className="text-[11px] font-mono text-slate-500 truncate">
                    {currentUser.username} • {currentRole?.roleName || currentUser.roleName}
                  </div>
                </div>
              </div>
              {currentUser.passwordUpdatedAt && (
                <span className="text-[10px] text-slate-500 font-mono shrink-0">
                  Updated {new Date(currentUser.passwordUpdatedAt).toLocaleDateString('en-GB')}
                </span>
              )}
            </div>

            {notice && (
              <div
                className={`p-3 rounded-lg border text-xs font-medium flex items-center space-x-2 ${
                  notice.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {notice.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{notice.message}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Current Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPwds(!showPwds)}
                    className="text-[11px] font-medium text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    {showPwds ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showPwds ? 'Hide passwords' : 'Show passwords'}</span>
                  </button>
                </div>
                <input
                  type={showPwds ? 'text' : 'password'}
                  required
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full h-9 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  New Password * (min 6 characters)
                </label>
                <input
                  type={showPwds ? 'text' : 'password'}
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
                  type={showPwds ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full h-9 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Password updates are hashed locally and recorded in the Audit Trail.</span>
            </div>
          </div>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              className="h-9 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Update My Password</span>
            </button>
          </div>
        </form>
      )}
    </SlideOverPanel>
  );
};
