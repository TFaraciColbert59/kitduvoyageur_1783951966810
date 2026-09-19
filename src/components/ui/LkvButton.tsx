'use client';
import React from 'react';
import { cn } from '@/lib/utils';
import LiquidGlass from '../glass/LiquidGlass';

export type LkvButtonVariant = 'primary' | 'secondary' | 'light' | 'ghost-light' | 'ghost' | 'danger' | 'icon-only' | 'glass' | 'glass-primary' | 'glass-pill' | 'glass-pill-primary';
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

/* Toutes les variantes partagent la même pile optique Liquid Glass
 * (référence section 4). Les valeurs viennent des tokens --btn-* (tokens.css) :
 * une seule valeur à changer pour mettre à jour 100% des boutons du site. */
const INK_GLASS = 'var(--btn-tint)';
const variantOptics: Record<LkvButtonVariant, { tint?: string; color: string }> = {
  primary: { tint: 'var(--btn-tint-solid)', color: 'var(--btn-on-solid)' },
  secondary: { tint: INK_GLASS, color: 'var(--btn-content)' },
  light: { tint: INK_GLASS, color: 'var(--btn-content)' },
  'ghost-light': { tint: INK_GLASS, color: 'var(--btn-content)' },
  ghost: { tint: INK_GLASS, color: 'var(--btn-content)' },
  danger: { tint: 'var(--lkv-danger-dark)', color: 'var(--btn-on-solid)' },
  'icon-only': { tint: INK_GLASS, color: 'var(--btn-content)' },
  glass: { tint: INK_GLASS, color: 'var(--btn-content)' },
  'glass-primary': { tint: 'var(--btn-tint-solid)', color: 'var(--btn-on-solid)' },
  'glass-pill': { tint: INK_GLASS, color: 'var(--btn-content)' },
  'glass-pill-primary': { tint: 'var(--btn-tint-solid)', color: 'var(--btn-on-solid)' },
};

const variantPadding: Record<LkvButtonSize, string> = {
  sm: '7px 16px',
  md: '10px 22px',
  lg: '13px 26px',
};
const variantFontSize: Record<LkvButtonSize, string> = {
  sm: '12px',
  md: '14px',
  lg: '15px',
};

export function LkvButton({ variant = 'primary', size = 'md', icon, iconPosition = 'left',
  loading = false, fullWidth = false, children, style, disabled, className, ...props }: LkvButtonProps) {
  const isDisabled = disabled || loading;
  const iconOnly = variant === 'icon-only';
  const optics = variantOptics[variant];

  return (
    <LiquidGlass
      as="button"
      {...props}
      type={props.type ?? 'button'}
      disabled={isDisabled}
      aria-busy={loading || props['aria-busy'] || undefined}
      data-variant={variant}
      data-size={size}
      className={cn('lkv-button-primitive touch-manipulation', className)}
      displacementScale={70}
      blurAmount={6}
      saturation={160}
      aberrationIntensity={2}
      cornerRadius={999}
      interactive
      elasticity={0.15}
      priority="control"
      shadow="var(--btn-shadow)"
      glassTint={optics.tint}
      onClick={isDisabled ? undefined : props.onClick}
      style={{
        display: fullWidth ? 'flex' : 'inline-flex',
        width: fullWidth ? '100%' : undefined,
        minHeight: 'var(--lkv-touch-min)',
        minWidth: 'var(--lkv-touch-min)',
        padding: iconOnly ? '0' : variantPadding[size],
        border: 'none',
        background: 'transparent',
        color: optics.color,
        fontWeight: 'var(--btn-font-weight)' as any,
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.45 : 1,
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        ...(iconOnly ? { width: size === 'lg' ? 'var(--lkv-touch-comfortable)' : 'var(--lkv-touch-min)', height: size === 'lg' ? 'var(--lkv-touch-comfortable)' : 'var(--lkv-touch-min)' } : {}),
        ...style,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: variantFontSize[size] }}>
        {loading && <svg className="animate-spin motion-reduce:animate-none shrink-0" width="16" height="16"
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>}
        {!loading && icon && iconPosition === 'left' && <span className="inline-flex shrink-0">{icon}</span>}
        {children}
        {!loading && icon && iconPosition === 'right' && <span className="inline-flex shrink-0">{icon}</span>}
      </span>
    </LiquidGlass>
  );
}
export default LkvButton;
