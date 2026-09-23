'use client';

import React, { forwardRef } from 'react';
import clsx from 'clsx';

export type GlassLevel = 'G1' | 'G2' | 'G3' | 'GC';
export type GlassRadius = 'full' | 'sheet' | 'hero' | 'card' | 'popover' | 'tile' | 'min' | 'none';

export interface GlassSurfaceProps extends React.HTMLAttributes<HTMLElement> {
  level?: GlassLevel;
  radius?: GlassRadius;
  interactive?: boolean;
  intensity?: number; // Optionnel : surchage locale 0.0 à 1.0
  as?: React.ElementType;
  children?: React.ReactNode;
  className?: string;
}

const RADIUS_MAP: Record<GlassRadius, string> = {
  full: 'rounded-[var(--lkv-radius-full)]',
  sheet: 'rounded-[var(--lkv-radius-sheet)]',
  hero: 'rounded-[var(--lkv-radius-hero)]',
  card: 'rounded-[var(--lkv-radius-card)]',
  popover: 'rounded-[var(--lkv-radius-popover)]',
  tile: 'rounded-[var(--lkv-radius-tile)]',
  min: 'rounded-[var(--lkv-radius-min)]',
  none: 'rounded-none',
};

export const GlassSurface = forwardRef<HTMLElement, GlassSurfaceProps>(function GlassSurface(
  {
    level = 'G1',
    radius,
    interactive = false,
    intensity,
    as: Component = 'div',
    className = '',
    style,
    children,
    ...props
  },
  ref
) {
  // Déduction du rayon par défaut selon le niveau
  const defaultRadius: GlassRadius =
    radius || (level === 'G3' || level === 'GC' ? 'full' : level === 'G2' ? 'tile' : 'card');

  const levelClass =
    level === 'G1' ? 'g1' : level === 'G2' ? 'g2' : level === 'G3' ? 'g3' : 'gc';

  const localStyle: React.CSSProperties = {
    ...style,
    ...(intensity !== undefined ? ({ '--glass-intensity': intensity } as React.CSSProperties) : {}),
  };

  return (
    <Component
      ref={ref}
      style={localStyle}
      className={clsx(
        levelClass,
        RADIUS_MAP[defaultRadius],
        'relative transition-all duration-[var(--dur-fast)] ease-[var(--ease-glass)]',
        interactive &&
          'cursor-pointer active:scale-[0.98] select-none hover:shadow-lg active:brightness-105',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
});

export default GlassSurface;
