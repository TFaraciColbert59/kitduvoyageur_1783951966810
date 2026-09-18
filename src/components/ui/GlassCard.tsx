'use client';
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type GlassVariant = 'base' | 'elevated' | 'interactive' | 'selected' | 'overlay' | 'critical';
type GlassTone = 'neutral' | 'sage' | 'warn' | 'danger' | 'info';

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  /** Legacy aliases; material values always come from tokens.css. */
  tone?: GlassTone;
  blur?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  disabled?: boolean;
  as?: 'div' | 'article';
  ariaLabelledBy?: string;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ variant, tone = 'neutral', blur = 'sm', interactive = false, disabled = false,
    as: Component = 'div', ariaLabelledBy, className, children, onClick, onKeyDown,
    tabIndex, role, ...props }, ref) => {
    const resolvedVariant = variant ?? (tone === 'danger' ? 'critical' : interactive ? 'interactive' : 'base');
    const actionable = Boolean(onClick);
    const unavailable = disabled || props['aria-disabled'] === true || props['aria-disabled'] === 'true';

    return (
      <Component
        {...props}
        ref={ref}
        role={role ?? (actionable ? 'button' : undefined)}
        aria-labelledby={ariaLabelledBy ?? props['aria-labelledby']}
        aria-disabled={unavailable || undefined}
        tabIndex={unavailable && actionable ? -1 : tabIndex ?? (actionable ? 0 : undefined)}
        data-glass-variant={resolvedVariant}
        data-glass-blur={blur}
        className={cn('glass relative overflow-hidden', `tone-${tone}`,
          (interactive || actionable || variant === 'interactive') && 'interactive', className)}
        onClick={unavailable ? undefined : onClick}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && !unavailable && actionable && event.target === event.currentTarget
            && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}
      >
        {/* Preserve the established layout contract for existing consumers. */}
        <div className="h-full min-h-0 flex flex-col justify-between">{children}</div>
      </Component>
    );
  }
);
GlassCard.displayName = 'GlassCard';
