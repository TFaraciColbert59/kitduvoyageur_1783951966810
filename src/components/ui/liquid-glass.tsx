'use client';

import React, { forwardRef, type HTMLAttributes } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface LiquidGlassCardProps extends HTMLAttributes<HTMLDivElement> {
  glowIntensity?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  shadowIntensity?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  borderRadius?: string;
  blurIntensity?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  draggable?: boolean;
  interactive?: boolean;
  tone?: 'neutral' | 'sage' | 'dark' | 'emerald';
  children?: React.ReactNode;
}

const BLUR_MAP = {
  none: 'backdrop-blur-none',
  xs: 'backdrop-blur-[8px]',
  sm: 'backdrop-blur-[14px]',
  md: 'backdrop-blur-[24px]',
  lg: 'backdrop-blur-[36px]',
};

const GLOW_MAP = {
  none: '',
  xs: 'shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-1px_1px_rgba(255,255,255,0.1)]',
  sm: 'shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.6),inset_0_-1px_1px_rgba(255,255,255,0.15)]',
  md: 'shadow-[inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-1.5px_2px_rgba(255,255,255,0.2),0_0_20px_rgba(255,255,255,0.15)]',
  lg: 'shadow-[inset_0_2px_6px_rgba(255,255,255,0.85),inset_0_-2px_3px_rgba(255,255,255,0.25),0_0_30px_rgba(255,255,255,0.25)]',
};

const SHADOW_MAP = {
  none: '',
  xs: 'drop-shadow-[0_4px_12px_rgba(0,0,0,0.06)]',
  sm: 'drop-shadow-[0_8px_24px_rgba(0,0,0,0.12)]',
  md: 'drop-shadow-[0_16px_36px_rgba(0,0,0,0.18)]',
  lg: 'drop-shadow-[0_24px_48px_rgba(0,0,0,0.26)]',
};

const TONE_MAP = {
  neutral: 'bg-gradient-to-b from-white/[0.14] via-white/[0.06] to-white/[0.02] border-white/35',
  sage: 'bg-gradient-to-b from-white/[0.18] via-[rgba(91,127,85,0.06)] to-white/[0.03] border-[rgba(163,196,163,0.5)]',
  emerald: 'bg-gradient-to-b from-white/[0.20] via-[rgba(23,64,44,0.08)] to-white/[0.04] border-[rgba(91,127,85,0.4)]',
  dark: 'bg-gradient-to-b from-black/[0.25] via-black/[0.15] to-black/[0.30] border-white/20',
};

export const LiquidGlassCard = forwardRef<HTMLDivElement, LiquidGlassCardProps>(
  (
    {
      glowIntensity = 'sm',
      shadowIntensity = 'sm',
      borderRadius = '24px',
      blurIntensity = 'sm',
      draggable = false,
      interactive = false,
      tone = 'neutral',
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <motion.div
        ref={ref}
        drag={draggable}
        dragElastic={0.08}
        dragSnapToOrigin
        whileTap={interactive ? { scale: 0.985, transition: { type: 'spring', stiffness: 500, damping: 25 } } : undefined}
        className={cn(
          'relative overflow-hidden border transition-all duration-300',
          BLUR_MAP[blurIntensity],
          GLOW_MAP[glowIntensity],
          SHADOW_MAP[shadowIntensity],
          TONE_MAP[tone],
          interactive && 'cursor-pointer hover:border-white/50 active:scale-[0.99]',
          className
        )}
        style={{
          borderRadius,
          WebkitBackdropFilter: blurIntensity === 'none' ? 'none' : 'blur(20px) saturate(180%)',
          backdropFilter: blurIntensity === 'none' ? 'none' : 'blur(20px) saturate(180%)',
          ...style,
        }}
        {...(props as HTMLMotionProps<'div'>)}
      >
        {/* Specular Top Rim Light Highlight (Liseré lumineux supérieur) */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-90"
          aria-hidden="true"
        />

        {/* Ambient Sheen (Reflet organique subtil en biais) */}
        <div
          className="pointer-events-none absolute -top-1/2 -left-1/2 h-[200%] w-[200%] rotate-12 bg-gradient-to-b from-white/[0.07] via-transparent to-transparent opacity-60"
          aria-hidden="true"
        />

        <div className="relative z-10">{children}</div>
      </motion.div>
    );
  }
);

LiquidGlassCard.displayName = 'LiquidGlassCard';

export default LiquidGlassCard;
