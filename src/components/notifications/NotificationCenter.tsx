/**
 * Haros HRMIS - Notification Center History Drawer
 * Displays persistent notification log, category filters, search,
 * read/unread tracking, and history management.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationType } from '../../services/notifications/notificationService';
import { formatRelativeTime, getNotificationTheme } from './notificationTheme';

type FilterTab = 'all' | NotificationType;

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'success', label: 'Success' },
  { id: 'warning', label: 'Warning' },
  { id: 'error', label: 'Error' },
  { id: 'security', label: 'Security' },
];

export const NotificationCenter: React.FC = () => {
  const {
    history,
    unreadCount,
    isCenterOpen,
    closeCenter,
    markAsRead,
    markAllAsRead,
    clearHistory,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!isCenterOpen) {
      setConfirmClear(false);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCenter();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCenterOpen, closeCenter]);

  const countsByType = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: history.length,
      success: 0,
      warning: 0,
      error: 0,
      security: 0,
    };
    for (const item of history) {
      counts[item.type]++;
    }
    return counts;
  }, [history]);

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return history.filter((item) => {
      if (activeFilter !== 'all' && item.type !== activeFilter) return false;
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        item.message.toLowerCase().includes(query) ||
        (item.module || '').toLowerCase().includes(query) ||
        (item.actor || '').toLowerCase().includes(query)
      );
    });
  }, [history, activeFilter, searchTerm]);

  if (!isCenterOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex justify-end no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Notification Center"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-[1px] transition-opacity"
        onClick={closeCenter}
        aria-hidden="true"
      />

      {/* Slide-Over Panel */}
      <aside className="animate-drawer-in relative z-10 w-full max-w-md h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  Notification Center
                </h2>
                {unreadCount > 0 && (
                  <span className="text-[11px] font-semibold text-blue-700 tabular-nums">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                Activity, alerts, and security event history
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={closeCenter}
              className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
              aria-label="Close Notification Center"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="px-4 py-3 border-b border-slate-200 space-y-2.5 bg-white">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`flex-1 min-w-fit px-2 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap tabular-nums ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label} ({countsByType[tab.id]})
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search activity, module, or user..."
                className="w-full h-8 pl-8 pr-3 rounded-md border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="h-8 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Mark all read</span>
              </button>
            )}
          </div>
        </div>

        {/* History Feed */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
          {filteredItems.length === 0 ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center px-6 text-center">
              <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <Bell className="w-5 h-5" />
              </div>
              <div className="text-xs font-semibold text-slate-800">
                {history.length === 0 ? 'No notifications recorded yet' : 'No matching notifications'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                {history.length === 0
                  ? 'Actions across staff records, workflows, exports, settings, and security will be logged here.'
                  : 'Try switching the category filter or clearing your search query.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const theme = getNotificationTheme(item.type);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => markAsRead(item.id)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-slate-50 ${
                    item.read ? 'bg-white' : 'bg-blue-50/35'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${theme.iconWrapperClass}`}
                  >
                    {theme.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-semibold ${theme.labelClass}`}>
                        {theme.label}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                        {!item.read && (
                          <span
                            className="w-2 h-2 rounded-full bg-blue-600 shrink-0"
                            title="Unread"
                          />
                        )}
                      </div>
                    </div>

                    <div className="text-xs font-semibold text-slate-900 mt-0.5 leading-snug">
                      {item.title}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed break-words">
                      {item.message}
                    </p>

                    {(item.module || item.actor) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                        {item.module && <span>{item.module}</span>}
                        {item.module && item.actor && <span aria-hidden="true">·</span>}
                        {item.actor && <span>By {item.actor}</span>}
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-500 tabular-nums">
            Showing {filteredItems.length} of {history.length} saved events
          </span>

          {history.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    clearHistory();
                    setConfirmClear(false);
                  }}
                  className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors"
                >
                  Confirm Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="px-2 py-1 rounded text-slate-600 hover:text-rose-700 hover:bg-rose-50 font-medium flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )
          )}
        </div>
      </aside>
    </div>
  );
};
