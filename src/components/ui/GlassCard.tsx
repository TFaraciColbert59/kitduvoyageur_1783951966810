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
  sage: 'before:bg-[color:var(--glass-tint-sage)]',
  warn: 'ring-1 ring-warn/20',
  danger: 'ring-1 ring-danger/20',
  info: 'ring-1 ring-info/20',
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
          'glass',
          interactive && 'interactive cursor-pointer',
          `backdrop-blur-${blur === 'sm' ? '[14px]' : blur === 'lg' ? '[32px]' : '[22px]'}`,
          toneTint[tone],
          className
        )}
        whileTap={interactive ? { scale: 0.98 } : undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
GlassCard.displayName = 'GlassCard';
