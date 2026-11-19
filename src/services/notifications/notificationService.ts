/**
 * Haros HRMIS - Persistent Notification Engine & Live Toast Queue
 * Framework-agnostic pub/sub service shared across storage layer, AuthContext, and UI modules.
 */

export type NotificationType = 'success' | 'warning' | 'error' | 'security';

export const TOAST_DURATION_MS = 5000;
const MAX_VISIBLE_TOASTS = 5;
const MAX_HISTORY_ITEMS = 250;
const HISTORY_STORAGE_KEY = 'haros_hrmis_v1_notifications';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  module?: string;
  actor?: string;
  timestamp: string;
  read: boolean;
}

export interface ToastItem extends AppNotification {
  durationMs: number;
  exiting?: boolean;
}

export interface NotifyPayload {
  type: NotificationType;
  title: string;
  message: string;
  module?: string;
  actor?: string;
  dedupKey?: string;
  skipHistory?: boolean;
}

export interface NotificationState {
  history: AppNotification[];
  toasts: ToastItem[];
  unreadCount: number;
}

type Listener = (state: NotificationState) => void;

class NotificationService {
  private history: AppNotification[] = [];
  private toasts: ToastItem[] = [];
  private listeners: Set<Listener> = new Set();
  private recentDedupMap: Map<string, number> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const rawHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) {
          this.history = parsed.slice(0, MAX_HISTORY_ITEMS);
        }
      }
    } catch {
      this.history = [];
    }
  }

  private persistHistory(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.history.slice(0, MAX_HISTORY_ITEMS)));
    } catch {
      // Ignore quota exceeded
    }
  }

  public getState(): NotificationState {
    return {
      history: this.history,
      toasts: this.toasts,
      unreadCount: this.history.reduce((acc, item) => acc + (item.read ? 0 : 1), 0),
    };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private createId(): string {
    return `ntf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  public notify(payload: NotifyPayload): AppNotification | null {
    const now = Date.now();
    const dedupKey =
      payload.dedupKey || `${payload.type}|${payload.module || ''}|${payload.title}|${payload.message}`;

    // Prune stale dedup entries
    if (this.recentDedupMap.size > 40) {
      for (const [key, ts] of this.recentDedupMap.entries()) {
        if (now - ts > 1500) this.recentDedupMap.delete(key);
      }
    }

    const lastSeen = this.recentDedupMap.get(dedupKey);
    if (lastSeen && now - lastSeen < 550) {
      return null;
    }
    this.recentDedupMap.set(dedupKey, now);

    const notification: AppNotification = {
      id: this.createId(),
      type: payload.type,
      title: payload.title,
      message: payload.message,
      module: payload.module,
      actor: payload.actor,
      timestamp: new Date().toISOString(),
      read: false,
    };

    if (!payload.skipHistory) {
      this.history = [notification, ...this.history].slice(0, MAX_HISTORY_ITEMS);
      this.persistHistory();
    }

    const toastItem: ToastItem = {
      ...notification,
      durationMs: TOAST_DURATION_MS,
      exiting: false,
    };

    const nextToasts = [...this.toasts, toastItem];
    this.toasts = nextToasts.length > MAX_VISIBLE_TOASTS
      ? nextToasts.slice(nextToasts.length - MAX_VISIBLE_TOASTS)
      : nextToasts;

    this.emit();
    return notification;
  }

  public success(
    title: string,
    message: string,
    meta?: { module?: string; actor?: string; dedupKey?: string }
  ): AppNotification | null {
    return this.notify({ type: 'success', title, message, ...meta });
  }

  public warning(
    title: string,
    message: string,
    meta?: { module?: string; actor?: string; dedupKey?: string }
  ): AppNotification | null {
    return this.notify({ type: 'warning', title, message, ...meta });
  }

  public error(
    title: string,
    message: string,
    meta?: { module?: string; actor?: string; dedupKey?: string }
  ): AppNotification | null {
    return this.notify({ type: 'error', title, message, ...meta });
  }

  public security(
    title: string,
    message: string,
    meta?: { module?: string; actor?: string; dedupKey?: string }
  ): AppNotification | null {
    return this.notify({ type: 'security', title, message, ...meta });
  }

  public startDismissToast(id: string): void {
    const exists = this.toasts.some((t) => t.id === id);
    if (!exists) return;
    this.toasts = this.toasts.map((t) => (t.id === id ? { ...t, exiting: true } : t));
    this.emit();
    setTimeout(() => {
      this.removeToast(id);
    }, 220);
  }

  public removeToast(id: string): void {
    const next = this.toasts.filter((t) => t.id !== id);
    if (next.length === this.toasts.length) return;
    this.toasts = next;
    this.emit();
  }

  public markAsRead(id: string): void {
    let changed = false;
    this.history = this.history.map((item) => {
      if (item.id === id && !item.read) {
        changed = true;
        return { ...item, read: true };
      }
      return item;
    });
    if (changed) {
      this.persistHistory();
      this.emit();
    }
  }

  public markAllAsRead(): void {
    const hasUnread = this.history.some((item) => !item.read);
    if (!hasUnread) return;
    this.history = this.history.map((item) => ({ ...item, read: true }));
    this.persistHistory();
    this.emit();
  }

  public clearHistory(): void {
    if (this.history.length === 0) return;
    this.history = [];
    this.persistHistory();
    this.emit();
  }
}

export const notificationService = new NotificationService();
