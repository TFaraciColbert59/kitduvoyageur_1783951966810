'use client';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { colors, transition } from '@/design/tokens';

export type LkvButtonVariant =
  | 'primary'
  | 'secondary'
  | 'light'
  | 'ghost-light'
  | 'ghost'
  | 'danger'
  | 'icon-only';

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

const STYLES: Record<LkvButtonVariant, React.CSSProperties> = {
  primary: { background: colors.primary, color: '#ffffff', border: 'none' },
  secondary: { background: 'rgba(255,255,255,0.85)', color: colors.primary, border: '1px solid rgba(23,64,44,0.12)', backdropFilter: 'blur(8px)' },
  light: { background: '#ffffff', color: colors.primary, border: '1px solid rgba(23,64,44,0.08)' },
  'ghost-light': { background: 'transparent', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' },
  ghost: { background: 'transparent', color: colors.primary, border: 'none' },
  danger: { background: colors.error, color: '#ffffff', border: 'none' },
  'icon-only': { background: 'rgba(255,255,255,0.40)', color: colors.primary, border: '1px solid rgba(255,255,255,0.60)', backdropFilter: 'blur(10px)' },
};

const HOVER_STYLES: Partial<Record<LkvButtonVariant, React.CSSProperties>> = {
  primary: { background: colors.primaryHover },
  secondary: { background: '#ffffff' },
  light: { background: '#FAF8F5' },
  'ghost-light': { background: 'rgba(255,255,255,0.12)' },
  ghost: { background: 'rgba(23,64,44,0.06)' },
  danger: { background: '#8A241B' },
  'icon-only': { background: 'rgba(255,255,255,0.70)' },
};

const SIZES: Record<LkvButtonSize, React.CSSProperties> = {
  sm: { padding: '6px 14px', fontSize: '12px', minHeight: '32px' },
  md: { padding: '10px 20px', fontSize: '14px', minHeight: '42px' },
  lg: { padding: '13px 26px', fontSize: '15px', minHeight: '48px' },
};

const ICON_ONLY_SIZES: Record<LkvButtonSize, React.CSSProperties> = {
  sm: { width: '32px', height: '32px', padding: 0, borderRadius: '50%' },
  md: { width: '42px', height: '42px', padding: 0, borderRadius: '50%' },
  lg: { width: '48px', height: '48px', padding: 0, borderRadius: '50%' },
};

export function LkvButton({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  fullWidth = false,
  children,
  style,
  disabled,
  className,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onMouseDown,
  onMouseUp,
  onTouchStart,
  onTouchEnd,
  ...props
}: LkvButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const isDisabled = disabled || loading;
  const isIconOnly = variant === 'icon-only';

  const baseStyle: React.CSSProperties = {
    display: fullWidth ? 'flex' : 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderRadius: isIconOnly ? '50%' : '999px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    border: 'none',
    fontFamily: 'var(--font-sans), system-ui, sans-serif',
    width: fullWidth ? '100%' : undefined,
    transform: !isDisabled && isPressed ? 'scale(0.97)' : !isDisabled && isHovered ? 'scale(1.015)' : 'scale(1)',
    transition: transition.default,
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
    ...STYLES[variant],
    ...(isIconOnly ? ICON_ONLY_SIZES[size] : SIZES[size]),
    ...(isDisabled ? { opacity: 0.45 } : {}),
    ...(isHovered && !isDisabled ? HOVER_STYLES[variant] || {} : {}),
    ...(isFocused ? { outline: '2px solid #5B7F55', outlineOffset: '2px' } : {}),
    ...style,
  };

  return (
    <button
      className={cn('lkv-button-primitive touch-manipulation', className)}
      style={baseStyle}
      onMouseEnter={(e) => { setIsHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setIsHovered(false); setIsPressed(false); onMouseLeave?.(e); }}
      onMouseDown={(e) => { if (!isDisabled) setIsPressed(true); onMouseDown?.(e); }}
      onMouseUp={(e) => { setIsPressed(false); onMouseUp?.(e); }}
      onTouchStart={(e) => { if (!isDisabled) setIsPressed(true); onTouchStart?.(e); }}
      onTouchEnd={(e) => { setIsPressed(false); onTouchEnd?.(e); }}
      onFocus={(e) => { setIsFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setIsFocused(false); setIsPressed(false); onBlur?.(e); }}
      disabled={isDisabled}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin shrink-0"
          style={{ height: '16px', width: '16px' }}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {!loading && icon && iconPosition === 'left' && <span className="inline-flex shrink-0">{icon}</span>}
      {children}
      {!loading && icon && iconPosition === 'right' && <span className="inline-flex shrink-0">{icon}</span>}
    </button>
  );
}

export default LkvButton;
