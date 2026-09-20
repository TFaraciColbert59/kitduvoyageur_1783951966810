import React from 'react';
import { cn } from '@/lib/utils';

export type SectionSpacing = 'sm' | 'md' | 'lg';

export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Actions alignées à droite du titre (même emplacement partout). */
  actions?: React.ReactNode;
  spacing?: SectionSpacing;
  as?: 'section' | 'div';
}

/* Section canonique : titre + description + actions toujours à la même place. */
const SPACING: Record<SectionSpacing, string> = {
  sm: 'space-y-[var(--space-2)]',
  md: 'space-y-[var(--space-4)]',
  lg: 'space-y-[var(--space-6)]',
};

export function Section({
  title,
  description,
  actions,
  spacing = 'md',
  as: Component = 'section',
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <Component {...props} className={cn(SPACING[spacing], className)}>
      {(title || description || actions) && (
        <div className="flex items-start justify-between gap-[var(--space-3)]">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="text-[length:var(--lkv-text-title-sm)] font-bold leading-[var(--leading-snug)] text-[color:var(--lkv-text-primary)]">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-body-sm)] leading-[var(--leading-normal)] text-[color:var(--lkv-text-secondary)]">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-[var(--space-2)]">{actions}</div>}
        </div>
      )}
      {children}
    </Component>
  );
}

export default Section;
