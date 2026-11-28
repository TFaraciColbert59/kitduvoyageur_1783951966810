'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface HoldToConfirmButtonProps {
  label: string;
  holdHint?: string;
  holdMs?: number;
  tone?: 'action' | 'danger' | 'neutral';
  icon?: React.ReactNode;
  disabled?: boolean;
  onConfirm: () => void;
  className?: string;
}

/**
 * Lot 07 — Bouton à maintien sécurisé (1,2 s Terminer / 1,5 s Déverrouiller Pluie / 1 s SOS)
 * avec anneau de progression SVG inspiré du bloc 21st.dev Live Activity Dock.
 */
export function HoldToConfirmButton({
  label,
  holdHint = 'Maintenir',
  holdMs = 1200,
  tone = 'danger',
  icon,
  disabled = false,
  onConfirm,
  className = '',
}: HoldToConfirmButtonProps) {
  const [progress, setProgress] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (startRef.current !== null && !firedRef.current) {
      setShowHint(true);
      setTimeout(() => setShowHint(false), 1800);
    }
    startRef.current = null;
    setProgress(0);
  }, []);

  useEffect(() => () => cancel(), [cancel]);

  const startHold = useCallback(() => {
    if (disabled) return;
    firedRef.current = false;
    startRef.current = performance.now();
    const tick = (now: number) => {
      if (startRef.current === null) return;
      const pct = Math.min(1, (now - startRef.current) / Math.max(200, holdMs));
      setProgress(pct);
      if (pct >= 1) {
        firedRef.current = true;
        startRef.current = null;
        setProgress(0);
        onConfirm();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [disabled, holdMs, onConfirm]);

  const bg =
    tone === 'danger'
      ? 'var(--xp-hud-danger, #a8443a)'
      : tone === 'action'
        ? 'var(--xp-hud-accent, #226148)'
        : 'var(--lkv-surface-muted, #edf1ea)';
  const fg = tone === 'neutral' ? 'var(--xp-hud-ink, #172b24)' : 'var(--xp-hud-accent-fg, #ffffff)';
  const radius = 11;
  const circumference = 2 * Math.PI * radius;

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={startHold}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onConfirm();
        }
      }}
      aria-label={`${label} (${holdHint} ${(holdMs / 1000).toFixed(1)} s)`}
      className={`xp20-hud-btn relative inline-flex select-none items-center justify-center gap-2 px-4 transition-transform active:scale-[0.98] ${className}`}
      style={{ background: bg, color: fg, opacity: disabled ? 0.5 : 1 }}
    >
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className="shrink-0">
        <circle cx="13" cy="13" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.4" />
        <circle
          cx="13"
          cy="13"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
          transform="rotate(-90 13 13)"
        />
      </svg>
      {icon}
      <span className="text-[14px] font-bold">{showHint ? holdHint : label}</span>
    </button>
  );
}
