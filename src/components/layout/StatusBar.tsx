/**
 * Haros HRMIS - Modern Windows 11 Enterprise Status Bar
 */

import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, Cpu, HardDrive, User, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const StatusBar: React.FC<{ onOpenDatabaseInfo: () => void }> = ({ onOpenDatabaseInfo }) => {
  const { currentUser, currentRole, hasPermission, canAccessModule } = useAuth();
  const canOpenDbModal = hasPermission('SETTINGS_MANAGE') || canAccessModule('settings');
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
          ' ' +
          now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="h-6 bg-slate-900 text-slate-400 border-t border-slate-800 px-3 flex items-center justify-between text-[11px] select-none shrink-0 z-40 no-print">
      {/* Left: Engine & Storage info */}
      <div className="flex items-center space-x-3">
        {canOpenDbModal ? (
          <button
            onClick={onOpenDatabaseInfo}
            className="flex items-center space-x-1 text-slate-300 hover:text-cyan-400 transition-colors font-mono"
          >
            <Database className="w-3 h-3 text-cyan-400" />
            <span>%ProgramData%\HarosHRMIS\Data\hrmis.db</span>
          </button>
        ) : (
          <div className="flex items-center space-x-1 text-slate-400 font-mono">
            <Database className="w-3 h-3 text-cyan-400" />
            <span>%ProgramData%\HarosHRMIS\Data\hrmis.db</span>
          </div>
        )}

        <span className="text-slate-700">|</span>

        <div className="flex items-center space-x-1 text-emerald-400 font-mono">
          <CheckCircle2 className="w-3 h-3" />
          <span>WAL Mode Active</span>
        </div>

        <span className="text-slate-700 hidden md:inline">|</span>

        <div className="hidden md:flex items-center space-x-1 text-slate-400">
          <Cpu className="w-3 h-3 text-slate-500" />
          <span>Host: WIN11-HR-NODE01</span>
        </div>
      </div>

      {/* Right: Security & Time */}
      <div className="flex items-center space-x-3">
        <div className="hidden sm:flex items-center space-x-1 text-amber-400/90">
          <ShieldCheck className="w-3 h-3" />
          <span>100% Offline Air-Gapped</span>
        </div>

        <span className="text-slate-700 hidden sm:inline">|</span>

        <div className="flex items-center space-x-1 text-slate-300">
          <User className="w-3 h-3 text-blue-400" />
          <span>{currentUser?.username || 'Guest'} ({currentRole?.roleName || 'Unauthenticated'})</span>
        </div>

        <span className="text-slate-700">|</span>

        <div className="font-mono text-slate-300">{currentTime}</div>
      </div>
    </footer>
  );
};
