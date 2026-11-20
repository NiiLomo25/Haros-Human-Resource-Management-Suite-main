import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface SlideOverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  maxWidthClass?: string;
  overlayClassName?: string;
  zIndexClass?: string;
  closeDisabled?: boolean;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
].join(', ');

function getVisibleFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0
  );
}

export const SlideOverPanel: React.FC<SlideOverPanelProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  maxWidthClass = 'max-w-lg',
  overlayClassName = 'bg-black/40',
  zIndexClass = 'z-50',
  closeDisabled = false,
  children,
}) => {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  const titleId = useId();
  const subtitleId = useId();
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeDisabledRef = useRef(closeDisabled);
  closeDisabledRef.current = closeDisabled;

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setIsMounted(true);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    } else {
      setIsVisible(false);
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus({ preventScroll: true });
      }
      previousFocusRef.current = null;
      const timer = setTimeout(() => {
        setIsMounted(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Initial focus inside drawer once mounted
  useEffect(() => {
    if (!isOpen || !isMounted) return;
    const timer = setTimeout(() => {
      const container = drawerRef.current;
      if (!container) return;
      if (container.contains(document.activeElement)) return;
      const focusables = getVisibleFocusableElements(container);
      // Prefer first input/select/textarea over close button if available; otherwise first focusable or drawer itself
      const preferred =
        focusables.find((el) => el.matches('input, select, textarea')) || focusables[0] || container;
      preferred.focus({ preventScroll: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, isMounted]);

  // Keyboard navigation: Esc close + Tab focus trap on topmost drawer
  useEffect(() => {
    if (!isOpen || !isMounted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const container = drawerRef.current;
      if (!container) return;

      const openDrawers = document.querySelectorAll('[data-slide-over-panel="true"]');
      if (openDrawers.length > 0 && openDrawers[openDrawers.length - 1] !== container) {
        return;
      }

      if (e.key === 'Escape') {
        if (!closeDisabledRef.current) {
          e.preventDefault();
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (e.key === 'Tab') {
        const focusables = getVisibleFocusableElements(container);
        if (focusables.length === 0) {
          e.preventDefault();
          container.focus({ preventScroll: true });
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!active || active === first || !container.contains(active)) {
            e.preventDefault();
            last.focus({ preventScroll: true });
          }
        } else {
          if (!active || active === last || !container.contains(active)) {
            e.preventDefault();
            first.focus({ preventScroll: true });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, isMounted]);

  if (!isMounted) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} overflow-hidden select-none`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={subtitle ? subtitleId : undefined}
    >
      {/* Semi-transparent background overlay (rgba(0,0,0,0.4) default) */}
      <div
        aria-hidden="true"
        onClick={() => {
          if (!closeDisabled) onClose();
        }}
        className={`fixed inset-0 ${overlayClassName} transition-opacity duration-[400ms] ease-in-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Right-side sliding drawer container */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-12 pointer-events-none">
        <div
          ref={drawerRef}
          data-slide-over-panel="true"
          tabIndex={-1}
          className={`pointer-events-auto w-screen ${maxWidthClass} h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden text-slate-800 text-xs outline-none transform transition-transform duration-[400ms] ease-in-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Modern Enterprise Panel Header */}
          <div className="h-14 bg-slate-900 text-white px-4 sm:px-5 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center space-x-2.5 min-w-0">
              {icon && (
                <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h3 id={titleId} className="font-bold tracking-wide text-sm truncate">
                  {title}
                </h3>
                {subtitle && (
                  <p id={subtitleId} className="text-[10px] text-slate-400 truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={closeDisabled}
              onClick={onClose}
              aria-label="Close panel"
              title="Close panel"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors shrink-0 disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
};

