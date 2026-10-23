'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './compte-overlay.css';

export interface OverlaySheetProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  nested?: boolean;
  headerRight?: React.ReactNode;
  leading?: React.ReactNode;
  hideClose?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function OverlaySheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  className = '',
  nested = false,
  headerRight,
  leading,
  hideClose = false,
}: OverlaySheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [bounds, setBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const runtimeSheet = document.getElementById('sheet');
    const wasInert = runtimeSheet?.hasAttribute('inert') ?? false;
    if (runtimeSheet) runtimeSheet.setAttribute('inert', '');
    const frame = window.requestAnimationFrame(() => {
      const first = sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? sheetRef.current)?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (runtimeSheet && !wasInert) runtimeSheet.removeAttribute('inert');
      const previous = restoreFocusRef.current;
      if (previous && typeof previous.focus === 'function') {
        window.setTimeout(() => previous.focus({ preventScroll: true }), 0);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const measure = () => {
      const card = document.getElementById('card') ?? document.getElementById('phone') ?? document.querySelector('.phone');
      if (!card) {
        setBounds({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });
        return;
      }
      const rect = card.getBoundingClientRect();
      setBounds({ left: rect.left, top: rect.top, width: rect.width || window.innerWidth, height: rect.height || window.innerHeight });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (!nodes.length) {
        event.preventDefault();
        sheetRef.current?.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="lkdv-compte-overlay"
      data-nested={nested ? 'true' : 'false'}
      style={{
        zIndex: nested ? 1320 : 1200,
        ...(bounds
          ? { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }
          : {}),
      }}
    >
      <button type="button" className="lkdv-overlay-scrim" aria-label="Fermer" onClick={onClose} />
      <div
        ref={sheetRef}
        className={`lkdv-overlay-sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lkdv-overlay-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="lkdv-overlay-header">
          <div className="lkdv-overlay-heading">
            {leading ? <span className="lkdv-overlay-leading">{leading}</span> : null}
            <div className="lkdv-overlay-heading-text">
              <h2 id="lkdv-overlay-title">{title}</h2>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </div>
          <div className="lkdv-overlay-head-actions">
            {headerRight}
            {hideClose ? null : (
              <button type="button" className="lkdv-overlay-close" onClick={onClose} aria-label="Fermer">
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </header>
        <div className="lkdv-overlay-body">{children}</div>
        {footer ? <footer className="lkdv-overlay-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body
  );
}

export interface DrawerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: React.ReactNode;
}

export function DrawerButton({ tone = 'secondary', icon, children, className = '', ...props }: DrawerButtonProps) {
  return (
    <button {...props} type={props.type ?? 'button'} className={`lkdv-drawer-btn is-${tone} ${className}`}>
      {icon}
      {children}
    </button>
  );
}

export function DrawerToggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`lkdv-drawer-toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span aria-hidden="true" />
    </button>
  );
}

export default OverlaySheet;
