'use client';
import React from 'react';
import { cn } from '@/lib/utils';

export type LkvButtonVariant = 'primary' | 'secondary' | 'light' | 'ghost-light' | 'ghost' | 'danger' | 'icon-only';
export type LkvButtonSize = 'sm' | 'md' | 'lg';
export interface LkvButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: LkvButtonVariant;
  size?: LkvButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}
const materials: Record<LkvButtonVariant, React.CSSProperties> = {
  primary: { background: 'var(--lkv-primary)', color: 'var(--lkv-text-inverted)', borderColor: 'transparent' },
  secondary: { background: 'var(--glass-bg-medium)', color: 'var(--lkv-primary)' },
  light: { background: 'var(--lkv-surface-card)', color: 'var(--lkv-primary)' },
  'ghost-light': { background: 'transparent', color: 'var(--lkv-text-inverted)', borderColor: 'var(--glass-border)' },
  ghost: { background: 'transparent', color: 'var(--lkv-primary)', borderColor: 'transparent' },
  danger: { background: 'var(--lkv-danger-dark)', color: 'var(--lkv-text-inverted)', borderColor: 'transparent' },
  'icon-only': { background: 'var(--glass-bg-medium)', color: 'var(--lkv-primary)' },
};
const sizes: Record<LkvButtonSize, React.CSSProperties> = {
  sm: { padding: '6px 14px', fontSize: '12px' },
  md: { padding: '10px 20px', fontSize: '14px' },
  lg: { padding: '13px 26px', fontSize: '15px' },
};
export function LkvButton({ variant = 'primary', size = 'md', icon, iconPosition = 'left',
  loading = false, fullWidth = false, children, style, disabled, className, ...props }: LkvButtonProps) {
  const isDisabled = disabled || loading;
  const iconOnly = variant === 'icon-only';
  return (
    <button
      {...props}
      disabled={isDisabled}
      aria-busy={loading || props['aria-busy'] || undefined}
      data-variant={variant}
      data-size={size}
      className={cn('lkv-button-primitive touch-manipulation', className)}
      style={{ display: fullWidth ? 'flex' : 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: '8px', borderRadius: 'var(--lkv-radius-full)', fontWeight: 600, whiteSpace: 'nowrap',
        cursor: isDisabled ? 'not-allowed' : 'pointer', border: '1px solid var(--lkv-border)',
        fontFamily: 'var(--font-sans), system-ui, sans-serif', width: fullWidth ? '100%' : undefined,
        WebkitTapHighlightColor: 'transparent', userSelect: 'none', ...materials[variant], ...sizes[size],
        ...(iconOnly ? { width: size === 'lg' ? 'var(--lkv-touch-comfortable)' : 'var(--lkv-touch-min)', height: size === 'lg' ? 'var(--lkv-touch-comfortable)' : 'var(--lkv-touch-min)', padding: 0 } : {}),
        ...(isDisabled ? { opacity: 0.45 } : {}), ...style,
        minHeight: size === 'lg' ? 'var(--lkv-touch-comfortable)' : 'var(--lkv-touch-min)', minWidth: 'var(--lkv-touch-min)',
      }}
    >
      {loading && <svg className="animate-spin motion-reduce:animate-none shrink-0" width="16" height="16"
        xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>}
      {!loading && icon && iconPosition === 'left' && <span className="inline-flex shrink-0">{icon}</span>}
      {children}
      {!loading && icon && iconPosition === 'right' && <span className="inline-flex shrink-0">{icon}</span>}
    </button>
  );
}
export default LkvButton;
