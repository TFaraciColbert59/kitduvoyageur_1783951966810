import React from 'react';
import { cn } from '@/lib/utils';

export type PageActionsVariant = 'inline' | 'sticky';
export type PageActionsAlign = 'start' | 'center' | 'end' | 'between';

export interface PageActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * `inline` = rangée d'actions dans le flux (fin de formulaire).
   * `sticky` = barre d'action principale fixée en bas, safe-area gérée.
   * Dans AppShell, préférer le slot `bottomExtra` pour rester au-dessus
   * de la bottom bar.
   */
  variant?: PageActionsVariant;
  align?: PageActionsAlign;
  fullWidth?: boolean;
}

const ALIGN: Record<PageActionsAlign, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};

/* Actions de page canoniques — emplacement unique de l'action principale. */
export function PageActions({
  variant = 'inline',
  align = 'end',
  fullWidth = false,
  className,
  children,
  ...props
}: PageActionsProps) {
  return (
    <div
      {...props}
      className={cn(
        'flex items-center gap-[var(--space-3)]',
        ALIGN[align],
        fullWidth && '[&>*]:flex-1',
        variant === 'sticky' &&
          'sticky bottom-[var(--nav-offset)] z-[var(--z-sticky)] bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] saturate-[var(--glass-sat)] shadow-[var(--glass-depth-inset)] pb-[var(--space-3)] pt-[var(--space-3)] backdrop-blur-[var(--glass-blur-sm)]',
        className
      )}
    >
      {children}
    </div>
  );
}

export default PageActions;
