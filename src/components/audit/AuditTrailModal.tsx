/**
 * Haros HRMIS - Immutable Audit Trail Viewer Modal
 * Forensic inspection of all system state changes with actor, machine, module, and pre/post JSON diffs.
 */

import React, { useState, useMemo } from 'react';
import { History, Search, X, CheckCircle2 } from 'lucide-react';
import { db } from '../../db/storage';
import { AuditTrailLog } from '../../types';
import { SlideOverPanel } from '../common/SlideOverPanel';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditTrailLog | null>(null);

  const logs = useMemo(() => db.getAuditLogs(), [isOpen]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedModule !== 'ALL' && log.module !== selectedModule) return false;
      if (selectedAction !== 'ALL' && log.actionType !== selectedAction) return false;
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesUser = log.username.toLowerCase().includes(query);
        const matchesEntity = log.entityName.toLowerCase().includes(query);
        const matchesRecord = log.recordId.toLowerCase().includes(query);
        const matchesMachine = log.machineName.toLowerCase().includes(query);
        if (!matchesUser && !matchesEntity && !matchesRecord && !matchesMachine) return false;
      }
      return true;
    });
  }, [logs, selectedModule, selectedAction, searchQuery]);

  const uniqueModules = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.module)));
  }, [logs]);

  return (
    <SlideOverPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Civil Service Immutable Audit Trail"
      subtitle="Append-Only Event Ledger | Database Table: AuditTrailLogs"
      icon={<History className="w-4 h-4" />}
      maxWidthClass="max-w-5xl"
      overlayClassName="bg-black/40"
    >
      {/* Status Banner + Filter Bar */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2.5 items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search audit trail by actor, entity, record ID, or workstation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded border border-slate-300 bg-white text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="h-8 px-2 rounded border border-slate-300 bg-white text-xs"
            >
              <option value="ALL">All Modules</option>
              {uniqueModules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="h-8 px-2 rounded border border-slate-300 bg-white text-xs"
            >
              <option value="ALL">All Actions</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="APPROVE_MOVEMENT">APPROVE_MOVEMENT</option>
              <option value="LOGIN">LOGIN</option>
              <option value="SECURITY">SECURITY</option>
              <option value="SYSTEM_INIT">SYSTEM_INIT</option>
            </select>

            <span className="hidden md:inline-flex items-center px-2 py-1 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-semibold">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Immutability Active
            </span>
          </div>
        </div>

        {/* Audit Log Table & Details Drawer */}
        <div className="flex-1 flex overflow-hidden">
          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-2 px-3">Timestamp (UTC)</th>
                  <th className="py-2 px-3">Actor (User)</th>
                  <th className="py-2 px-3">Workstation</th>
                  <th className="py-2 px-3">Module</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Entity & ID</th>
                  <th className="py-2 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  const actionColor =
                    log.actionType === 'SECURITY'
                      ? 'bg-rose-100 text-rose-800'
                      : log.actionType === 'APPROVE_MOVEMENT'
                      ? 'bg-blue-100 text-blue-800'
                      : log.actionType === 'SYSTEM_INIT'
                      ? 'bg-purple-100 text-purple-800'
                      : log.actionType === 'INSERT'
                      ? 'bg-emerald-100 text-emerald-800'
                      : log.actionType === 'UPDATE'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700';

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/70 font-medium' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                        {log.timestampUtc.replace('T', ' ').substring(0, 19)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{log.username}</td>
                      <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">{log.machineName}</td>
                      <td className="py-2 px-3 text-slate-700">{log.module}</td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${actionColor}`}>
                          {log.actionType}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600 text-[11px]">
                        {log.entityName} <span className="text-slate-400">#{log.recordId}</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button className="text-blue-600 hover:text-blue-800 font-medium">Inspect</button>
                      </td>
                    </tr>
                  );
                })}

                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No audit logs match current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Right Diff Drawer (if selected) */}
          {selectedLog && (
            <div className="w-80 border-l border-slate-200 bg-slate-50 p-3 overflow-y-auto shrink-0 flex flex-col text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-900">Log Entry #{selectedLog.id}</span>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1 rounded hover:bg-slate-200 text-slate-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 mt-2">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">User:</span>
                  <div className="font-medium text-slate-800">{selectedLog.username}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Host Node:</span>
                  <div className="font-mono text-slate-800">{selectedLog.machineName} ({selectedLog.ipOrHost})</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Entity Target:</span>
                  <div className="font-mono text-slate-800">{selectedLog.entityName} #{selectedLog.recordId}</div>
                </div>
              </div>

              {/* Pre-Change Values */}
              {selectedLog.oldValuesJson && (
                <div className="mt-3">
                  <span className="text-rose-700 font-semibold text-[10px] uppercase">
                    Prior State (Old Values):
                  </span>
                  <pre className="mt-1 p-2 bg-rose-50 border border-rose-200 rounded text-[10px] font-mono text-rose-900 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(JSON.parse(selectedLog.oldValuesJson), null, 2)}
                  </pre>
                </div>
              )}

              {/* Post-Change Values */}
              {selectedLog.newValuesJson && (
                <div className="mt-3">
                  <span className="text-emerald-700 font-semibold text-[10px] uppercase">
                    Committed State (New Values):
                  </span>
                  <pre className="mt-1 p-2 bg-emerald-50 border border-emerald-200 rounded text-[10px] font-mono text-emerald-900 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(JSON.parse(selectedLog.newValuesJson), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-11 px-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-slate-500 text-[11px] shrink-0">
          <span>Displaying {filteredLogs.length} of {logs.length} audit records</span>
          <span className="font-semibold text-slate-700">Strictly Tamper-Proof Civil Service Ledger</span>
        </div>
    </SlideOverPanel>
  );
};
