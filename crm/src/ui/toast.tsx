'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import s from './crm.module.css';

type ToastInput = {
  message: string;
  /** Libellé de l'action d'annulation (« Annuler »), avec décompte affiché. */
  actionLabel?: string;
  onAction?: () => void;
  /** Durée avant disparition automatique (10 s pour une annulation). */
  ttlMs?: number;
};

type ToastItem = ToastInput & { id: number; remaining: number };

const ToastContext = createContext<{ push: (toast: ToastInput) => void } | null>(null);

/** Annonces brèves en bas au centre. L'annulation reste possible pendant le décompte. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((toast: ToastInput) => {
    const id = nextId.current++;
    const ttlMs = toast.ttlMs ?? 10_000;
    setItems((current) => [...current, { ...toast, id, remaining: Math.round(ttlMs / 1000) }]);
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const timer = window.setInterval(() => {
      setItems((current) =>
        current
          .map((item) => ({ ...item, remaining: item.remaining - 1 }))
          .filter((item) => item.remaining > 0)
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [items.length]);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={s.toastLayer} aria-live="polite" role="status">
        {items.map((item) => (
          <div key={item.id} className={s.toast}>
            <span className={s.grow}>{item.message}</span>
            {item.actionLabel && item.onAction ? (
              <button
                type="button"
                className={s.toastAction}
                onClick={() => {
                  item.onAction?.();
                  remove(item.id);
                }}
              >
                {item.actionLabel} · {item.remaining} s
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé sous <ToastProvider>.');
  return ctx;
}
