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

const toneTint: Record<GlassTone, string> = {
  neutral: 'border-white/30',
  sage: 'border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1.5px_1px_rgba(255,255,255,0.6)]',
  warn: 'border-[rgba(200,154,59,0.35)] shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1.5px_1px_rgba(255,255,255,0.6)]',
  danger: 'border-[rgba(168,68,58,0.35)] shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1.5px_1px_rgba(255,255,255,0.6)]',
  info: 'border-[rgba(75,107,124,0.35)] shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1.5px_1px_rgba(255,255,255,0.6)]',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ tone = 'neutral', blur = 'sm', interactive = false, as = 'div', ariaLabelledBy, className, children, ...props }, ref) => {
    const Comp = motion[as] as React.ElementType;
    return (
      <Comp
        ref={ref}
        role={as === 'article' ? 'article' : undefined}
        aria-labelledby={ariaLabelledBy}
        tabIndex={interactive ? 0 : undefined}
        className={cn(
          'glass rounded-[28px]',
          interactive && 'interactive cursor-pointer',
          `backdrop-blur-${blur === 'sm' ? '[8px]' : blur === 'lg' ? '[16px]' : '[10px]'}`,
          toneTint[tone],
          className
        )}
        whileTap={interactive ? { scale: 0.985, transition: { type: 'spring', stiffness: 500, damping: 25 } } : undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
GlassCard.displayName = 'GlassCard';
