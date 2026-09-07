'use client';
import { forwardRef, type HTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type GlassTone = 'neutral' | 'sage' | 'warn' | 'danger' | 'info';
type GlassBlur = 'sm' | 'md' | 'lg';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: GlassTone;
  blur?: GlassBlur;
  interactive?: boolean;
  as?: 'div' | 'article';
  ariaLabelledBy?: string;
}

/** U1 : classes littérales — Tailwind ne compile jamais `backdrop-blur-${value}` interpolé. */
const blurClass: Record<GlassBlur, string> = {
  sm: 'backdrop-blur-[8px]',
  md: 'backdrop-blur-[10px]',
  lg: 'backdrop-blur-[16px]',
};

const toneTint: Record<GlassTone, string> = {
  neutral: 'border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.06),inset_0_1.5px_1px_rgba(255,255,255,0.7)]',
  sage: 'border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1.5px_1px_rgba(255,255,255,0.8)]',
  warn: 'border-[rgba(200,154,59,0.35)] shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1.5px_1px_rgba(255,255,255,0.7)]',
  danger: 'border-[rgba(168,68,58,0.35)] shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1.5px_1px_rgba(255,255,255,0.7)]',
  info: 'border-[rgba(75,107,124,0.35)] shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1.5px_1px_rgba(255,255,255,0.7)]',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      tone = 'neutral',
      blur = 'sm',
      interactive = false,
      as = 'div',
      ariaLabelledBy,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = motion[as] as React.ElementType;

    return (
      <Comp
        ref={ref}
        role={as === 'article' ? 'article' : undefined}
        aria-labelledby={ariaLabelledBy}
        tabIndex={interactive ? 0 : undefined}
        className={cn(
          'glass rounded-[var(--lkv-radius-card)] relative overflow-hidden',
          interactive && 'interactive cursor-pointer',
          blurClass[blur],
          toneTint[tone],
          className
        )}
        whileTap={interactive ? { scale: 0.985, transition: { type: 'spring', stiffness: 500, damping: 25 } } : undefined}
        {...props}
      >
        <div className="h-full min-h-0 flex flex-col justify-between">
          {children}
        </div>
      </Comp>
    );
  }
);
GlassCard.displayName = 'GlassCard';
