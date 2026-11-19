/**
 * Haros HRMIS - Shared Semantic Styling & Icons for Notification Severities
 * Maintains clean single-elevation hairline surfaces and WCAG AA contrast across all 4 types.
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ShieldAlert } from 'lucide-react';
import { NotificationType } from '../../services/notifications/notificationService';

export interface NotificationThemeConfig {
  label: string;
  icon: React.ReactNode;
  iconWrapperClass: string;
  labelClass: string;
  progressBarClass: string;
  cardBorderClass: string;
}

export function getNotificationTheme(type: NotificationType): NotificationThemeConfig {
  switch (type) {
    case 'success':
      return {
        label: 'Success',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />,
        iconWrapperClass: 'bg-emerald-50 border border-emerald-200/80',
        labelClass: 'text-emerald-800',
        progressBarClass: 'bg-emerald-600',
        cardBorderClass: 'border-emerald-200/90',
      };
    case 'warning':
      return {
        label: 'Warning',
        icon: <AlertTriangle className="w-4 h-4 text-amber-700" aria-hidden="true" />,
        iconWrapperClass: 'bg-amber-50 border border-amber-200/90',
        labelClass: 'text-amber-800',
        progressBarClass: 'bg-amber-500',
        cardBorderClass: 'border-amber-200/90',
      };
    case 'error':
      return {
        label: 'Error',
        icon: <XCircle className="w-4 h-4 text-rose-700" aria-hidden="true" />,
        iconWrapperClass: 'bg-rose-50 border border-rose-200/90',
        labelClass: 'text-rose-800',
        progressBarClass: 'bg-rose-600',
        cardBorderClass: 'border-rose-200/90',
      };
    case 'security':
      return {
        label: 'Security',
        icon: <ShieldAlert className="w-4 h-4 text-indigo-700" aria-hidden="true" />,
        iconWrapperClass: 'bg-indigo-50 border border-indigo-200/90',
        labelClass: 'text-indigo-800',
        progressBarClass: 'bg-indigo-600',
        cardBorderClass: 'border-indigo-200/90',
      };
  }
}

export function formatRelativeTime(isoString: string): string {
  const ts = new Date(isoString).getTime();
  if (!Number.isFinite(ts)) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(isoString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
