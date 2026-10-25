import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface GlassSubCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'section';
}

/**
 * GlassSubCard — Primitive UI vitrée avec léger voile blanc et reflet
 * Issue de l'extraction du langage /pays
 */
export const GlassSubCard = forwardRef<HTMLDivElement, GlassSubCardProps>(
  ({ children, className, as: Component = 'div', ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn('glass-sub-card', className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

GlassSubCard.displayName = 'GlassSubCard';
export default GlassSubCard;
