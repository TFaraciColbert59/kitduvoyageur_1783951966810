'use client';

import React, { useEffect, useState } from 'react';
import { subscribeToast, type ToastItem } from './dialogs';
import Icon from './Icon';

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToast((newToast) => {
      setToasts((prev) => [...prev.slice(-2), newToast]); // Keep at most 3 active toasts

      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.durationMs ?? 4000);

      return () => clearTimeout(timer);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Zone de notifications"
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-2 max-w-[min(380px,calc(100vw-24px))] w-full px-3 transition-all"
      style={{ zIndex: 'var(--z-alert, 700)' }}
    >
      {toasts.map((toast) => {
        const isError = toast.tone === 'error';
        const isSuccess = toast.tone === 'success';

        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex items-center gap-3 w-full rounded-2xl px-4 py-3 shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2"
            style={{
              backgroundColor: 'rgba(251, 250, 246, 0.96)', // Sauge canvas
              backdropFilter: 'blur(28px) saturate(180%)',
              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
              border: isError
                ? '1px solid rgba(180, 40, 40, 0.3)'
                : '0.5px solid rgba(23, 43, 36, 0.16)',
              boxShadow: '0 8px 24px rgba(23, 64, 44, 0.14), 0 2px 6px rgba(23, 43, 36, 0.08)',
              color: '#172B24',
            }}
          >
            <div className="shrink-0">
              {isError ? (
                <Icon name="alert-triangle" size={18} className="text-red-600" aria-hidden="true" />
              ) : isSuccess ? (
                <Icon name="check" size={18} className="text-[#226148]" aria-hidden="true" />
              ) : (
                <Icon name="info" size={18} className="text-[#17402C]" aria-hidden="true" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {toast.title && (
                <div className="text-xs font-semibold leading-tight text-[#172B24] truncate">
                  {toast.title}
                </div>
              )}
              <div className="text-xs leading-snug text-[#56665D]">
                {toast.message}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              aria-label="Fermer la notification"
              className="shrink-0 p-1 rounded-full text-[#56665D] hover:text-[#172B24] hover:bg-black/5 transition-colors"
            >
              <Icon name="x" size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </aside>
  );
}

export default ToastHost;
