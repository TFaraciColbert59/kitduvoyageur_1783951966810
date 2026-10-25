import React from 'react';
import { cn } from '@/lib/utils';

export type PageContentSpacing = 'sm' | 'md' | 'lg';

export interface PageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Rythme vertical entre les blocs de contenu. */
  spacing?: PageContentSpacing;
}

const SPACING: Record<PageContentSpacing, string> = {
  sm: 'space-y-[var(--space-3)]',
  md: 'space-y-[var(--space-4)]',
  lg: 'space-y-[var(--space-6)]',
};

/* Contenu de page canonique — même rythme vertical partout. */
export function PageContent({
  spacing = 'md',
  className,
  children,
  ...props
}: PageContentProps) {
  return (
    <div {...props} className={cn(SPACING[spacing], className)}>
      {children}
    </div>
  );
}

export default PageContent;
