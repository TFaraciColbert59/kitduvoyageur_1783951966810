'use client';

// UI Layouts (MIT) — adapté LKDV : framer-motion, tokens, reduced-motion.
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';
import type React from 'react';
import { useState } from 'react';

export interface LiquidGlassCardProps {
  children: React.ReactNode;
  className?: string;
  draggable?: boolean;
  expandable?: boolean;
  width?: string;
  height?: string;
  expandedWidth?: string;
  expandedHeight?: string;
  /** Intensité du backdrop-blur (défaut xl). */
  blurIntensity?: 'sm' | 'md' | 'lg' | 'xl';
  /** Ombre portée/glow extérieure (défaut md). */
  glowIntensity?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Reflets internes (défaut md). */
  shadowIntensity?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  borderRadius?: string;
}

const BLUR = {
  sm: 'backdrop-blur-sm',
  md: 'backdrop-blur-md',
  lg: 'backdrop-blur-lg',
  xl: 'backdrop-blur-xl',
} as const;

const GLOW: Record<string, string> = {
  none: '0 4px 4px rgba(0, 0, 0, 0.05), 0 0 12px rgba(0, 0, 0, 0.05)',
  xs: '0 4px 4px rgba(0, 0, 0, 0.12), 0 0 12px rgba(0, 0, 0, 0.07), 0 0 16px rgba(91,127,85,0.05)',
  sm: '0 4px 4px rgba(0, 0, 0, 0.12), 0 0 12px rgba(0, 0, 0, 0.07), 0 0 24px rgba(91,127,85,0.09)',
  md: '0 4px 4px rgba(0, 0, 0, 0.12), 0 0 12px rgba(0, 0, 0, 0.07), 0 0 32px rgba(91,127,85,0.12)',
  lg: '0 4px 4px rgba(0, 0, 0, 0.14), 0 0 14px rgba(0, 0, 0, 0.08), 0 0 40px rgba(91,127,85,0.16)',
  xl: '0 4px 4px rgba(0, 0, 0, 0.14), 0 0 14px rgba(0, 0, 0, 0.08), 0 0 48px rgba(91,127,85,0.2)',
};

const SHADOW: Record<string, string> = {
  none: 'inset 0 0 0 0 rgba(255, 255, 255, 0)',
  xs: 'inset 1px 1px 1px 0 rgba(255, 255, 255, 0.3), inset -1px -1px 1px 0 rgba(255, 255, 255, 0.3)',
  sm: 'inset 2px 2px 2px 0 rgba(255, 255, 255, 0.35), inset -2px -2px 2px 0 rgba(255, 255, 255, 0.35)',
  md: 'inset 3px 3px 3px 0 rgba(255, 255, 255, 0.45), inset -3px -3px 3px 0 rgba(255, 255, 255, 0.45)',
  lg: 'inset 4px 4px 4px 0 rgba(255, 255, 255, 0.5), inset -4px -4px 4px 0 rgba(255, 255, 255, 0.5)',
  xl: 'inset 6px 6px 6px 0 rgba(255, 255, 255, 0.55), inset -6px -6px 6px 0 rgba(255, 255, 255, 0.55)',
};

/**
 * LiquidGlassCard — carte « verre liquide » (UI Layouts, adapté).
 * Positionne le contenu au-dessus des calques verre : TOUJOURS passer
 * `className="relative z-30"` (ou un wrapper) aux enfants.
 */
export function LiquidGlassCard({
  children,
  className = '',
  draggable = true,
  expandable = false,
  width,
  height,
  expandedWidth,
  expandedHeight,
  blurIntensity = 'xl',
  borderRadius = '24px',
  glowIntensity = 'sm',
  shadowIntensity = 'md',
}: LiquidGlassCardProps) {
  const reduceMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleExpansion = (e: React.MouseEvent) => {
    if (!expandable) return;
    const target = e.target as HTMLElement;
    if (target.closest('a, button, input, select, textarea')) return;
    setIsExpanded((v) => !v);
  };

  const containerVariants =
    expandable && !reduceMotion
      ? {
          collapsed: {
            width: width || 'auto',
            height: height || 'auto',
            transition: { duration: 0.4, ease: [0.5, 1.5, 0.5, 1] },
          },
          expanded: {
            width: expandedWidth || 'auto',
            height: expandedHeight || 'auto',
            transition: { duration: 0.4, ease: [0.5, 1.5, 0.5, 1] },
          },
        }
      : undefined;

  const MotionComponent = draggable || (expandable && !reduceMotion) ? motion.div : 'div';

  const motionProps =
    draggable || (expandable && !reduceMotion)
      ? {
          variants: expandable ? containerVariants : undefined,
          animate: expandable ? (isExpanded ? 'expanded' : 'collapsed') : undefined,
          onClick: expandable ? handleToggleExpansion : undefined,
          drag: draggable,
          dragConstraints: draggable ? { left: 0, right: 0, top: 0, bottom: 0 } : undefined,
          dragElastic: draggable ? 0.3 : undefined,
          whileDrag: draggable ? { scale: 1.02 } : undefined,
          whileHover: reduceMotion ? undefined : { scale: 1.01 },
          whileTap: reduceMotion ? undefined : { scale: 0.98 },
        }
      : {};

  return (
    <>
      <svg className="hidden" aria-hidden="true">
        <defs>
          <filter
            id="lkdv-glass-blur"
            x="0"
            y="0"
            width="100%"
            height="100%"
            filterUnits="objectBoundingBox"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.003 0.007"
              numOctaves="1"
              result="turbulence"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale="200"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <MotionComponent
        className={cn(
          `relative ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${expandable ? 'cursor-pointer' : ''}`,
          className
        )}
        style={{
          borderRadius,
          ...(width && !expandable && { width }),
          ...(height && !expandable && { height }),
        }}
        {...(motionProps as object)}
      >
        <div
          className={`pointer-events-none absolute inset-0 z-0 ${BLUR[blurIntensity]}`}
          style={{ borderRadius, filter: 'url(#lkdv-glass-blur)' }}
        />
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{ borderRadius, boxShadow: GLOW[glowIntensity] }}
        />
        <div
          className="pointer-events-none absolute inset-0 z-20"
          style={{ borderRadius, boxShadow: SHADOW[shadowIntensity] }}
        />
        {children}
      </MotionComponent>
    </>
  );
}

export default LiquidGlassCard;
