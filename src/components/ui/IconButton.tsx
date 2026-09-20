'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type IconButtonVariant = 'ghost' | 'glass' | 'solid';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Obligatoire : le contrôle n'a pas de libellé visible. */
  'aria-label': string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const SIZE: Record<IconButtonSize, string> = {
  sm: 'h-[var(--control-height-sm)] w-[var(--control-height-sm)]',
  md: 'h-[var(--control-height-md)] w-[var(--control-height-md)]',
  lg: 'h-[var(--control-height-lg)] w-[var(--control-height-lg)]',
};

const VARIANT: Record<IconButtonVariant, string> = {
  ghost:
    'bg-transparent text-[color:var(--lkv-text-primary)] hover:bg-[color:var(--lkv-hover-surface)]',
  glass:
    'bg-[color:var(--card-tint-strong)] text-[color:var(--card-content)] border border-[color:var(--glass-border)] backdrop-blur-[var(--blur-md)] hover:bg-[color:var(--lkv-hover-surface)]',
  solid:
    'bg-[color:var(--lkv-action)] text-[color:var(--lkv-on-action)] hover:bg-[color:var(--lkv-action-hover)]',
};

/**
 * IconButton — primitive canonique des actions iconographiques (retour,
 * menu, fermeture, actions contextuelles). Cible ≥ 44 px, aria-label requis.
 */
export function IconButton({
  variant = 'ghost',
  size = 'md',
  className,
  children,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={props.type ?? 'button'}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full',
        'touch-manipulation transition-transform duration-[var(--motion-press-duration)] ease-[var(--motion-ease-standard)]',
        'active:scale-[var(--motion-press-scale)] motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]',
        'disabled:pointer-events-none disabled:opacity-[var(--opacity-disabled)]',
        VARIANT[variant],
        SIZE[size],
        className
      )}
    >
      {children}
    </button>
  );
}

export default IconButton;
