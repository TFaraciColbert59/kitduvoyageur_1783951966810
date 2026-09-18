'use client';
import React from 'react';
import { cn } from '@/lib/utils';

export type LkvChipTone = 'sage' | 'warn' | 'danger' | 'info' | 'stone' | 'light' | 'dark';
export interface LkvChipProps {
  label?: string;
  children?: React.ReactNode;
  tone?: LkvChipTone;
  variant?: 'light' | 'dark';
  dot?: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}
const tones: Record<LkvChipTone, { background: string; color: string; dot: string }> = {
  sage: { background: 'var(--lkv-success-bg)', color: 'var(--lkv-text-primary)', dot: 'var(--lkv-success)' },
  warn: { background: 'var(--lkv-warning-bg)', color: 'var(--lkv-warning-dark)', dot: 'var(--lkv-warning)' },
  danger: { background: 'var(--lkv-danger-bg)', color: 'var(--lkv-danger-dark)', dot: 'var(--lkv-danger)' },
  info: { background: 'var(--lkv-info-bg)', color: 'var(--sky-800)', dot: 'var(--lkv-info)' },
  stone: { background: 'var(--lkv-surface-muted)', color: 'var(--lkv-text-primary)', dot: 'var(--lkv-text-muted)' },
  light: { background: 'var(--glass-bg-medium)', color: 'var(--lkv-text-primary)', dot: 'var(--lkv-success)' },
  dark: { background: 'var(--lkv-primary)', color: 'var(--lkv-text-inverted)', dot: 'var(--lkv-success-bg)' },
};
export function LkvChip({ label, children, tone, variant, dot, active = false,
  disabled = false, onClick, className, style }: LkvChipProps) {
  const interactive = Boolean(onClick);
  const effectiveTone = tone ?? (variant === 'dark' ? 'dark' : 'light');
  const material = tones[effectiveTone];
  const Component = interactive ? 'button' : 'span';
  return (
    <Component
      {...(interactive ? { type: 'button' as const, disabled, 'aria-pressed': active, onClick } : {})}
      data-tone={effectiveTone}
      data-active={active}
      className={cn('lkv-chip-primitive touch-manipulation', className)}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        padding: '5px 12px', borderRadius: 'var(--lkv-radius-full)', fontSize: '11px',
        fontWeight: active ? 600 : 500, fontFamily: 'inherit',
        background: active ? 'var(--lkv-primary)' : material.background,
        color: active ? 'var(--lkv-text-inverted)' : material.color,
        border: '1px solid var(--lkv-border)', cursor: interactive ? 'pointer' : 'default',
        opacity: disabled ? 0.45 : 1, userSelect: 'none', WebkitTapHighlightColor: 'transparent',
        ...style, ...(interactive ? { minWidth: 'var(--lkv-touch-min)', minHeight: 'var(--lkv-touch-min)' } : {}),
      }}
    >
      {dot && <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%',
        background: active ? 'var(--lkv-success-bg)' : material.dot, flexShrink: 0 }} />}
      {children ?? label}
    </Component>
  );
}
export default LkvChip;
