/**
 * Haros HRMIS - React Notification Context
 * Bridges notificationService state + Notification Center drawer controls into React UI.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  notificationService,
  NotificationState,
  NotifyPayload,
  AppNotification,
} from '../services/notifications/notificationService';

interface NotificationContextValue extends NotificationState {
  isCenterOpen: boolean;
  openCenter: () => void;
  closeCenter: () => void;
  toggleCenter: () => void;
  notify: (payload: NotifyPayload) => AppNotification | null;
  success: (
    title: string,
    message: string,
    meta?: { module?: string; actor?: string; dedupKey?: string }
  ) => AppNotification | null;
  warning: (
    title: string,
    message: string,
    meta?: { module?: string; actor?: string; dedupKey?: string }
  ) => AppNotification | null;
  error: (
    title: string,
    message: string,
    meta?: { module?: string; actor?: string; dedupKey?: string }
  ) => AppNotification | null;
  security: (
    title: string,
    message: string,
    meta?: { module?: string; actor?: string; dedupKey?: string }
  ) => AppNotification | null;
  dismissToast: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearHistory: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<NotificationState>(() => notificationService.getState());
  const [isCenterOpen, setIsCenterOpen] = useState(false);

  useEffect(() => {
    return notificationService.subscribe(setState);
  }, []);

  const openCenter = useCallback(() => setIsCenterOpen(true), []);
  const closeCenter = useCallback(() => setIsCenterOpen(false), []);
  const toggleCenter = useCallback(() => setIsCenterOpen((prev) => !prev), []);

  const notify = useCallback((payload: NotifyPayload) => notificationService.notify(payload), []);
  const success = useCallback(
    (
      title: string,
      message: string,
      meta?: { module?: string; actor?: string; dedupKey?: string }
    ) => notificationService.success(title, message, meta),
    []
  );
  const warning = useCallback(
    (
      title: string,
      message: string,
      meta?: { module?: string; actor?: string; dedupKey?: string }
    ) => notificationService.warning(title, message, meta),
    []
  );
  const error = useCallback(
    (
      title: string,
      message: string,
      meta?: { module?: string; actor?: string; dedupKey?: string }
    ) => notificationService.error(title, message, meta),
    []
  );
  const security = useCallback(
    (
      title: string,
      message: string,
      meta?: { module?: string; actor?: string; dedupKey?: string }
    ) => notificationService.security(title, message, meta),
    []
  );

  const dismissToast = useCallback((id: string) => notificationService.startDismissToast(id), []);
  const markAsRead = useCallback((id: string) => notificationService.markAsRead(id), []);
  const markAllAsRead = useCallback(() => notificationService.markAllAsRead(), []);
  const clearHistory = useCallback(() => notificationService.clearHistory(), []);

  return (
    <NotificationContext.Provider
      value={{
        ...state,
        isCenterOpen,
        openCenter,
        closeCenter,
        toggleCenter,
        notify,
        success,
        warning,
        error,
        security,
        dismissToast,
        markAsRead,
        markAllAsRead,
        clearHistory,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
};
