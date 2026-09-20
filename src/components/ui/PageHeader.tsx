import React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Slot retour — toujours rendu à gauche, au même emplacement. */
  back?: React.ReactNode;
  /** Slot actions — toujours aligné à droite. */
  actions?: React.ReactNode;
  /**
   * Header collant. Réservé aux pages hors AppShell : dans AppShell, utiliser
   * le slot `header` du shell (qui gère déjà le safe-area).
   */
  sticky?: boolean;
}

/* Header de page canonique : retour à gauche, titre au même niveau,
 * actions à droite — mémoire musculaire identique sur toutes les pages. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  sticky = false,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      {...props}
      className={cn(
        'flex min-h-[var(--control-height-md)] items-center gap-[var(--space-3)]',
        sticky &&
          'sticky top-0 z-[var(--z-sticky)] bg-[color:var(--lkv-surface)]/85 backdrop-blur-[var(--blur-lg)]',
        className
      )}
    >
      {back && <div className="flex shrink-0 items-center">{back}</div>}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[length:var(--lkv-text-title-sm)] font-bold leading-[var(--leading-snug)] text-[color:var(--lkv-text-primary)]">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-[var(--space-2)]">{actions}</div>}
    </header>
  );
}

export default PageHeader;
