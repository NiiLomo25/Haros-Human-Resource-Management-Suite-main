/**
 * Haros HRMIS - Live Toast Alert Viewport
 * Smooth compositor-only animations, 5-second auto-dismiss with pause-on-hover,
 * distinct icons, and manual close/inspect triggers.
 */

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { ToastItem } from '../../services/notifications/notificationService';
import { getNotificationTheme } from './notificationTheme';

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  onInspect?: (id: string) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onDismiss, onInspect }) => {
  const theme = getNotificationTheme(toast.type);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(1);

  const remainingRef = useRef<number>(toast.durationMs);
  const lastTickRef = useRef<number>(performance.now());
  const dismissedRef = useRef<boolean>(false);

  useEffect(() => {
    if (toast.exiting || paused) {
      return;
    }

    lastTickRef.current = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      remainingRef.current = Math.max(0, remainingRef.current - delta);
      const ratio = toast.durationMs > 0 ? remainingRef.current / toast.durationMs : 0;
      setProgress(ratio);

      if (remainingRef.current <= 0 && !dismissedRef.current) {
        dismissedRef.current = true;
        onDismiss(toast.id);
        return;
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [paused, toast.durationMs, toast.exiting, toast.id, onDismiss]);

  const role = toast.type === 'error' || toast.type === 'security' ? 'alert' : 'status';

  return (
    <div
      role={role}
      aria-live={toast.type === 'error' || toast.type === 'security' ? 'assertive' : 'polite'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`pointer-events-auto relative overflow-hidden rounded-xl bg-white/95 backdrop-blur-md border ${theme.cardBorderClass} shadow-lg shadow-slate-900/10 ${
        toast.exiting ? 'animate-toast-exit' : 'animate-toast-enter'
      }`}
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${theme.iconWrapperClass}`}
        >
          {theme.icon}
        </div>

        <div
          className={`flex-1 min-w-0 ${onInspect ? 'cursor-pointer' : ''}`}
          onClick={() => {
            if (onInspect) onInspect(toast.id);
          }}
        >
          <div className="flex items-center gap-2 text-[11px] font-semibold leading-none mb-1">
            <span className={theme.labelClass}>{theme.label}</span>
            {toast.module && (
              <>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="text-slate-500 font-medium truncate">{toast.module}</span>
              </>
            )}
          </div>

          <div className="text-xs font-semibold text-slate-900 leading-snug">
            {toast.title}
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5 line-clamp-2">
            {toast.message}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 -mr-1 -mt-0.5"
          aria-label="Dismiss notification"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 5-second countdown bar (compositor-only scaleX) */}
      <div className="h-[2.5px] w-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full w-full origin-left ${theme.progressBarClass}`}
          style={{
            transform: `scaleX(${Math.max(0, Math.min(1, progress))})`,
            transition: 'none',
          }}
        />
      </div>
    </div>
  );
};

export const ToastContainer: React.FC<{ canOpenCenter?: boolean }> = ({ canOpenCenter = true }) => {
  const { toasts, dismissToast, markAsRead, openCenter } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Live notifications"
      className="fixed top-12 right-4 z-[90] w-[calc(100vw-2rem)] max-w-sm flex flex-col gap-2.5 pointer-events-none no-print"
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
          onInspect={
            canOpenCenter
              ? (id) => {
                  markAsRead(id);
                  dismissToast(id);
                  openCenter();
                }
              : undefined
          }
        />
      ))}
    </div>
  );
};
