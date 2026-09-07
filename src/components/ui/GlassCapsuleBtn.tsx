import React, { forwardRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type GlassCapsuleBtnVariant = 'default' | 'primary' | 'secondary';
export type GlassCapsuleBtnSize = 'default' | 'sm' | 'xs';

export interface GlassCapsuleBtnProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassCapsuleBtnVariant;
  size?: GlassCapsuleBtnSize;
  href?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * GlassCapsuleBtn — Primitive UI bouton capsule/stadium vitré
 * Issue de l'extraction du langage /pays
 * Règle d'or : tout CTA = .glass-capsule-btn
 */
export const GlassCapsuleBtn = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  GlassCapsuleBtnProps
>(({ variant = 'default', size = 'default', href, icon, children, className, disabled, ...props }, ref) => {
  const classes = cn(
    'glass-capsule-btn',
    variant !== 'default' && variant,
    size !== 'default' && size,
    disabled && 'opacity-50 pointer-events-none cursor-not-allowed',
    className
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={classes}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </Link>
    );
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      disabled={disabled}
      className={classes}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
});

GlassCapsuleBtn.displayName = 'GlassCapsuleBtn';
export default GlassCapsuleBtn;
