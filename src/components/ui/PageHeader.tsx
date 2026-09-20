'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import HeaderBackButton from './HeaderBackButton';
import { useScrolled } from './useScrolled';

export type PageHeaderVariant = 'inline' | 'large';

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /**
   * Lignes autorisées pour le sous-titre : `1` (défaut) = troncature sur une
   * ligne ; `2`+ = clamp multi-lignes ; `0` = aucune limite.
   */
  subtitleLines?: number;
  /** Slot retour, ou `true` pour le contrôle canonique HeaderBackButton. */
  back?: React.ReactNode | boolean;
  backHref?: string;
  backLabel?: string;
  /** Action contextuelle — toujours alignée à droite. */
  actions?: React.ReactNode;
  /** `inline` = barre 44 ; `large` = titre large iOS sous la barre. */
  variant?: PageHeaderVariant;
  /**
   * Header collant. Dans AppShell, préférer le slot `header` du shell
   * (il gère déjà le safe-area).
   */
  sticky?: boolean;
  /** Fond transparent au repos (devient matériau au scroll si `scrollAware`). */
  transparent?: boolean;
  /** Active l'état transparent → matériau selon le scroll. */
  scrollAware?: boolean;
}

/**
 * PageHeader — header de page canonique (Phase 2, Lot 2).
 * Structure invariable : [Back / Leading] — Titre — [Trailing action].
 */
const SUBTITLE_LINES: Record<number, string> = {
  1: 'truncate',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
};

function subtitleClampClass(lines: number): string {
  if (lines <= 0) return 'break-words';
  return SUBTITLE_LINES[lines] ?? 'line-clamp-6';
}

export function PageHeader({
  title,
  subtitle,
  subtitleLines = 1,
  back,
  backHref,
  backLabel,
  actions,
  variant = 'inline',
  sticky = false,
  transparent = false,
  scrollAware = false,
  className,
  ...props
}: PageHeaderProps) {
  const scrolled = useScrolled();
  const showMaterial = !transparent || (scrollAware && scrolled);

  const backNode =
    back === true ? (
      <HeaderBackButton fallbackHref={backHref} label={backLabel} />
    ) : back ? (
      <div className="flex shrink-0 items-center">{back}</div>
    ) : null;

  const titleNode = (size: 'inline' | 'large') => (
    <h1
      className={cn(
        'min-w-0 truncate font-bold text-[color:var(--lkv-text-primary)]',
        size === 'inline'
          ? 'text-[length:var(--lkv-text-headline)] leading-[var(--leading-tight)]'
          : 'text-[length:var(--lkv-text-title-lg)] leading-[var(--lkv-line-title)] tracking-[var(--lkv-tracking-title)]'
      )}
    >
      {title}
    </h1>
  );

  const subtitleNode = subtitle ? (
    <p
      className={cn(
        'min-w-0 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]',
        subtitleClampClass(subtitleLines)
      )}
    >
      {subtitle}
    </p>
  ) : null;

  return (
    <header
      {...props}
      data-variant={variant}
      data-scrolled={showMaterial ? 'true' : 'false'}
      className={cn(
        'flex w-full flex-col gap-[var(--space-1)]',
        sticky && 'sticky top-0 z-[var(--z-sticky)]',
        sticky && showMaterial && 'lkv-material-header',
        className
      )}
    >
      <div className="flex min-h-[var(--header-height)] items-center gap-[var(--space-2)]">
        {backNode}
        <div className="min-w-0 flex-1">
          {variant === 'inline' && titleNode('inline')}
          {variant === 'inline' && subtitleNode}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-[var(--space-2)]">{actions}</div>
        )}
      </div>

      {variant === 'large' && (
        <div className="min-w-0 pb-[var(--space-2)]">
          {titleNode('large')}
          {subtitleNode}
        </div>
      )}
    </header>
  );
}

export default PageHeader;
