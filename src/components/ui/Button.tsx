'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonBaseProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'leading' | 'trailing';
  fullWidth?: boolean;
}

type RegularButtonProps = ButtonBaseProps & {
  iconOnly?: false;
  children?: React.ReactNode;
  'aria-label'?: string;
};

type IconOnlyButtonProps = ButtonBaseProps & {
  iconOnly: true;
  'aria-label': string;
  children?: never;
};

export type ButtonProps = RegularButtonProps | IconOnlyButtonProps;

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-[var(--control-height-sm)] px-[var(--control-padding-x-sm)] text-[length:var(--lkv-text-footnote)]',
  md: 'h-[var(--control-height-md)] px-[var(--control-padding-x-md)] text-[length:var(--lkv-text-subheadline)]',
  lg: 'h-[var(--control-height-lg)] px-[var(--control-padding-x-lg)] text-[length:var(--lkv-text-body)]',
};

const ICON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-[var(--control-height-sm)] w-[var(--control-height-sm)]',
  md: 'h-[var(--control-height-md)] w-[var(--control-height-md)]',
  lg: 'h-[var(--control-height-lg)] w-[var(--control-height-lg)]',
};

/* iOS 27 Full Liquid Glass Button Scale:
   Primary: G3 monochrome prominent (obsidian/light contrast)
   Secondary: G2 neutral glass with specular rim
   Ghost: transparent with glass hover
   Destructive: tinted glass */
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-[color:var(--g3-bg)] text-[color:var(--g3-text)] shadow-[var(--glass-specular)] hover:brightness-[1.08]',
  secondary:
    'bg-[color:var(--g2-bg)] text-[color:var(--glass-label)] border border-[color:var(--glass-rim)] shadow-[var(--glass-specular)] backdrop-blur-md hover:brightness-[1.08]',
  ghost:
    'bg-transparent text-[color:var(--glass-label)] hover:bg-[color:var(--lkv-hover-surface)]',
  destructive:
    'bg-red-500/15 border border-red-500/30 text-[color:var(--lkv-danger)] hover:bg-red-500/25',
};

/**
 * Button — primitive canonique (Phase 2, Lot 3).
 * Un seul système : variantes, tailles, états et icônes pilotés par les tokens.
 * Toute nouvelle action utilise ce composant ; aucune page ne style un
 * `<button>` brut.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'leading',
  fullWidth = false,
  iconOnly = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      type={props.type ?? 'button'}
      disabled={isDisabled}
      aria-busy={loading || props['aria-busy'] || undefined}
      data-variant={variant}
      data-size={size}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center gap-[var(--space-2)] whitespace-nowrap rounded-full font-semibold',
        'touch-manipulation transition-transform duration-[var(--motion-press-duration)] ease-[var(--motion-ease-standard)]',
        'active:scale-[var(--motion-press-scale)] motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]',
        'disabled:pointer-events-none disabled:opacity-[var(--opacity-disabled)]',
        VARIANT[variant],
        iconOnly ? ICON_SIZE[size] : SIZE[size],
        fullWidth && 'w-full',
        className
      )}
    >
      {loading ? (
        <Spinner size="sm" tone="current" label="" />
      ) : (
        icon && iconPosition === 'leading' && <span className="inline-flex shrink-0">{icon}</span>
      )}
      {!iconOnly && children}
      {!loading && icon && iconPosition === 'trailing' && (
        <span className="inline-flex shrink-0">{icon}</span>
      )}
    </button>
  );
}

export default Button;
