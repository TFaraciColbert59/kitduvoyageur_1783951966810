import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type GlassPillTone = 'default' | 'warn' | 'danger' | 'info';

export interface GlassPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: GlassPillTone;
  children?: React.ReactNode;
  className?: string;
}

const toneMap: Record<GlassPillTone, string> = {
  default: '',
  warn: 'pill-warn',
  danger: 'pill-danger',
  info: 'pill-info',
};

/**
 * GlassPill — Primitive UI pilule tag/badge vitrée
 * Issue de l'extraction du langage /pays
 */
export const GlassPill = forwardRef<HTMLSpanElement, GlassPillProps>(
  ({ tone = 'default', children, className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn('glass-pill', toneMap[tone], className)}
        {...props}
      >
        {children}
      </span>
    );
  }
);

GlassPill.displayName = 'GlassPill';
export default GlassPill;
