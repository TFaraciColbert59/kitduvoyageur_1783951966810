'use client';

import React, { useEffect, useId, useRef } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { IconButton } from '@/components/ui';

export interface PlanningDrawerProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  onBack?: () => void;
  children: React.ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Panneau de planification : feuille basse sur mobile, dialogue centré sur
 * desktop. Le focus est piégé, Échap ferme et le focus revient au déclencheur.
 */
export function PlanningDrawer({
  open,
  title,
  description,
  onClose,
  onBack,
  children,
}: PlanningDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );

    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActive?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center sm:items-center">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-[color:var(--lkv-overlay-scrim)] backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="g1 relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-[color:var(--glass-rim)] bg-[color:var(--lkv-surface-elevated)] shadow-[var(--elevation-3)] sm:max-h-[86dvh] sm:rounded-[28px]"
      >
        <header className="flex items-start gap-[var(--space-2)] border-b border-[color:var(--lkv-border-subtle)] px-[var(--space-4)] py-[var(--space-3)]">
          {onBack && (
            <IconButton
              aria-label="Revenir au panneau précédent"
              size="sm"
              onClick={onBack}
              className="mt-[2px]"
            >
              <ChevronLeft aria-hidden="true" size={18} />
            </IconButton>
          )}
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-[length:var(--lkv-text-title-sm)] font-bold leading-[var(--leading-snug)] text-[color:var(--lkv-text-primary)]"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-footnote)] leading-[var(--leading-normal)] text-[color:var(--lkv-text-secondary)]">
                {description}
              </p>
            )}
          </div>
          <IconButton aria-label="Fermer le panneau" size="sm" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </IconButton>
        </header>
        <div className="overflow-y-auto overscroll-contain px-[var(--space-4)] py-[var(--space-4)]">
          {children}
        </div>
      </div>
    </div>
  );
}

export default PlanningDrawer;
