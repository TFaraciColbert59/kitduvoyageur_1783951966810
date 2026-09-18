'use client';
import { forwardRef } from 'react';
import dynamic from 'next/dynamic';
import { GlassCard, type GlassCardProps, type GlassVariant } from './GlassCard';

export interface PremiumGlassCardProps extends GlassCardProps {
  /** Enable rdev optical refraction. Requires NEXT_PUBLIC_GLASS_PREMIUM=true. */
  premium?: boolean;
  /** Displacement scale passed to rdev LiquidGlass. Default: 14. */
  refractionScale?: number;
}

const PREMIUM_ENABLED = process.env.NEXT_PUBLIC_GLASS_PREMIUM === 'true';

const PremiumOpticalLayer = dynamic(
  () => import('./PremiumGlassCard.client'),
  { ssr: false }
);

export const PremiumGlassCard = forwardRef<HTMLDivElement, PremiumGlassCardProps>(
  ({ premium = false, refractionScale = 14, children, className, style, ...cardProps }, ref) => {
    const showPremium = PREMIUM_ENABLED && premium;
    const variant: GlassVariant = cardProps.variant ?? 'base';
    return (
      <GlassCard
        ref={ref}
        className={className}
        style={{ ...style, position: 'relative' }}
        {...cardProps}
        variant={variant}
      >
        {showPremium && (
          <PremiumOpticalLayer
            refractionScale={refractionScale}
            variant={variant}
          />
        )}
        {children}
      </GlassCard>
    );
  }
);
PremiumGlassCard.displayName = 'PremiumGlassCard';
