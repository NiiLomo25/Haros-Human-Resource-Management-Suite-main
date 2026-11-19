/**
 * Haros HRMIS - Modern Windows 11 Fluent Title Bar
 */

import React, { useState } from 'react';
import {
  HardDrive,
  Database,
  LogOut,
  History,
  Minimize2,
  Maximize2,
  X,
  ChevronDown,
  KeyRound,
  Bell,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { BrandCrest } from '../common/BrandCrest';
import { useInstitutionInfo } from '../../hooks/useInstitutionInfo';

interface TitleBarProps {
  onOpenAudit: () => void;
  onOpenDatabaseInfo: () => void;
  onOpenPasswordReset: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  onOpenAudit,
  onOpenDatabaseInfo,
  onOpenPasswordReset,
}) => {
  const { currentUser, currentRole, logout } = useAuth();
  const { unreadCount, toggleCenter } = useNotifications();
  const { institutionName } = useInstitutionInfo();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="h-10 bg-slate-900 text-slate-100 flex items-center justify-between px-3 select-none border-b border-slate-800 text-xs shrink-0 z-50 no-print">
      {/* Left: Window Brand & Crest */}
      <div className="flex items-center space-x-2.5">
        <BrandCrest
          sizeClass="w-7 h-7"
          className="border border-amber-400/50 bg-slate-800"
          fallbackIconClassName="w-3.5 h-3.5 text-amber-400"
        />
        <div className="flex items-center space-x-2">
          <span className="font-semibold tracking-wide text-slate-100">
            Haros HRMIS
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300 font-medium hidden sm:inline">
            {institutionName}
          </span>
          <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-emerald-400 border border-emerald-500/30 font-mono">
            <HardDrive className="w-2.5 h-2.5 mr-1" />
            100% Offline Standalone
          </span>
        </div>
      </div>

      {/* Middle: Relational Engine Status */}
      <div className="hidden lg:flex items-center space-x-2">
        <button
          onClick={onOpenDatabaseInfo}
          className="flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600 transition-colors"
          title="Click to view SQLite Relational Database state"
        >
          <Database className="w-3 h-3 text-cyan-400" />
          <span className="font-mono text-[11px]">SQLite WAL Mode</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        </button>

        <button
          onClick={onOpenAudit}
          className="flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600 transition-colors"
          title="View Immutable Audit Trail Logs"
        >
          <History className="w-3 h-3 text-amber-400" />
          <span>Audit Trail</span>
        </button>
      </div>

      {/* Right: Notification Bell, User Profile & Windows Controls */}
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={toggleCenter}
          className="relative flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-600 transition-colors whitespace-nowrap shrink-0"
          title="Open Notification Center"
          aria-label={`Open Notification Center (${unreadCount} unread)`}
        >
          <Bell className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline text-[11px] font-medium">Notifications</span>
          {unreadCount > 0 && (
            <span className="min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-1.5 px-2 py-1 rounded hover:bg-slate-800 transition-colors text-slate-200"
            >
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
                {currentUser.username.substring(0, 2).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <div className="font-medium leading-none">{currentUser.username}</div>
                <div className="text-[9px] text-amber-400 leading-none mt-0.5">
                  {currentRole?.roleName || currentUser.roleName || 'User'}
                </div>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded shadow-2xl py-1 z-50 text-slate-200 text-xs">
                  <div className="px-3 py-2.5 border-b border-slate-800">
                    <div className="font-semibold text-slate-100">{currentUser.fullName}</div>
                    <div className="text-[10px] text-slate-400">{currentUser.email}</div>
                    <div className="mt-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] bg-blue-900/60 text-blue-300 font-medium">
                      {currentRole?.roleName || currentUser.roleName}
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenPasswordReset();
                      }}
                      className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800 flex items-center space-x-2 transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>Reset Password</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-800 pt-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="w-full text-left px-3 py-2 text-rose-400 hover:bg-rose-900/30 flex items-center space-x-2 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Windows Standard Window Frame Controls */}
        <div className="flex items-center space-x-0.5 pl-2 border-l border-slate-800">
          <button
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Minimize"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Maximize / Restore"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              setShowUserMenu(false);
            }}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-600 rounded transition-colors"
            title="All changes auto-saved to local SQLite WAL storage"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </header>
  );
};
