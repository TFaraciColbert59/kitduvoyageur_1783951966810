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
  neutral: '',
  sage: 'shadow-[0_0_24px_-6px_rgba(91,127,85,0.25)] border-[rgba(163,196,163,0.7)]',
  warn: 'shadow-[0_0_24px_-6px_rgba(200,154,59,0.25)] border-[rgba(200,154,59,0.45)]',
  danger: 'shadow-[0_0_24px_-6px_rgba(168,68,58,0.25)] border-[rgba(168,68,58,0.45)]',
  info: 'shadow-[0_0_24px_-6px_rgba(75,107,124,0.25)] border-[rgba(75,107,124,0.45)]',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ tone = 'neutral', blur = 'md', interactive = false, as = 'div', ariaLabelledBy, className, children, ...props }, ref) => {
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
          `backdrop-blur-${blur === 'sm' ? '[14px]' : blur === 'lg' ? '[36px]' : '[26px]'}`,
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
