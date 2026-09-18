'use client';

import React, {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import LiquidGlass from '../glass/LiquidGlass';

export type GlassVariant =
  | 'base'
  | 'elevated'
  | 'interactive'
  | 'selected'
  | 'overlay'
  | 'critical';

export type GlassTier = 'standard' | 'premium';
export type GlassTone = 'neutral' | 'sage' | 'warn' | 'danger' | 'info';

const RADIUS: Record<GlassVariant, number> = {
  base: 24,
  elevated: 32,
  interactive: 28,
  selected: 28,
  overlay: 40,
  critical: 24,
};

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  variant?: GlassVariant;
  /** standard = CSS léger (listes longues) · premium = réfraction SVG */
  tier?: GlassTier;
  tone?: GlassTone;
  blur?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  disabled?: boolean;
  overLight?: boolean;
  padding?: string;
  as?: 'div' | 'article';
  ariaLabelledBy?: string;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      variant,
      tier = 'standard',
      tone = 'neutral',
      blur = 'sm',
      interactive = false,
      disabled = false,
      overLight = false,
      padding = '18px 20px',
      as: Component = 'div',
      ariaLabelledBy,
      className = '',
      style,
      children,
      onClick,
      onKeyDown,
      tabIndex,
      role,
      ...props
    },
    ref
  ) => {
    const resolvedVariant: GlassVariant =
      variant ??
      (tone === 'danger'
        ? 'critical'
        : interactive
        ? 'interactive'
        : 'base');

    const radius = RADIUS[resolvedVariant];
    const actionable = Boolean(onClick);
    const isInteractive = interactive || actionable || resolvedVariant === 'interactive';
    const unavailable =
      disabled ||
      props['aria-disabled'] === true ||
      props['aria-disabled'] === 'true';

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (
        !event.defaultPrevented &&
        !unavailable &&
        actionable &&
        event.target === event.currentTarget &&
        (event.key === 'Enter' || event.key === ' ')
      ) {
        event.preventDefault();
        event.currentTarget.click();
      }
    };

    /* --- Niveau STANDARD : CSS léger, compatible listes et SSR --- */
    if (tier === 'standard') {
      return (
        <Component
          {...props}
          ref={ref}
          role={role ?? (actionable ? 'button' : undefined)}
          aria-labelledby={ariaLabelledBy ?? props['aria-labelledby']}
          aria-disabled={unavailable || undefined}
          tabIndex={
            unavailable && actionable ? -1 : tabIndex ?? (actionable ? 0 : undefined)
          }
          data-glass-variant={resolvedVariant}
          data-glass-blur={blur}
          className={cn(
            'glass relative overflow-hidden',
            `tone-${tone}`,
            isInteractive && 'interactive',
            className
          )}
          onClick={unavailable ? undefined : onClick}
          onKeyDown={handleKeyDown}
          style={{
            borderRadius: radius,
            padding,
            cursor: actionable && !unavailable ? 'pointer' : undefined,
            ...(overLight ? { background: 'rgba(255,255,255,0.42)' } : null),
            ...style,
          }}
        >
          <div className="h-full min-h-0 flex flex-col justify-between relative z-[1]">
            {children}
          </div>
        </Component>
      );
    }

    /* --- Niveau PREMIUM : Liquid Glass réfractif complet --- */
    return (
      <LiquidGlass
        as={Component}
        {...props}
        ref={ref}
        className={cn(
          'glass-premium-root',
          `tone-${tone}`,
          isInteractive && 'interactive',
          className
        )}
        style={{
          borderRadius: radius,
          ...(resolvedVariant === 'elevated' ? { margin: '2px' } : null),
          ...(resolvedVariant === 'selected'
            ? { outline: '1px solid rgba(163,196,163,0.9)', outlineOffset: '2px' }
            : null),
          ...style,
        }}
        mode="shader"
        displacementScale={resolvedVariant === 'overlay' ? 34 : 26}
        blurAmount={resolvedVariant === 'overlay' ? 18 : 14}
        saturation={170}
        aberrationIntensity={resolvedVariant === 'critical' ? 3.2 : 2}
        cornerRadius={radius}
        interactive={isInteractive && !unavailable}
        overLight={overLight}
        onClick={unavailable ? undefined : onClick}
      >
        <div
          role={role ?? (actionable ? 'button' : undefined)}
          aria-labelledby={ariaLabelledBy ?? props['aria-labelledby']}
          aria-disabled={unavailable || undefined}
          tabIndex={
            unavailable && actionable ? -1 : tabIndex ?? (actionable ? 0 : undefined)
          }
          data-glass-variant={resolvedVariant}
          data-glass-blur={blur}
          onKeyDown={handleKeyDown}
          style={{ padding }}
          className="h-full min-h-0 flex flex-col justify-between"
        >
          {children}
        </div>
      </LiquidGlass>
    );
  }
);

GlassCard.displayName = 'GlassCard';

export default GlassCard;
