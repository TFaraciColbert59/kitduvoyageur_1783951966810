'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import HeaderBackButton from './HeaderBackButton';

export type PageHeaderVariant = 'inline' | 'large';

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** 1 = une ligne tronquée (défaut) ; 2/3 = multi-lignes ; 0 = libre. */
  subtitleLines?: number;
  /** Slot retour, ou `true` pour le contrôle canonique HeaderBackButton. */
  back?: React.ReactNode | boolean;
  backHref?: string;
  backLabel?: string;
  /** Action contextuelle — contrôles flottants à droite. */
  actions?: React.ReactNode;
  /** `inline` = titre compact ; `large` = grand titre iOS. */
  variant?: PageHeaderVariant;
  /** Conservés pour compatibilité d'API (les contrôles flottent déjà). */
  sticky?: boolean;
  transparent?: boolean;
  scrollAware?: boolean;
}

/**
 * PageHeader — Phase 3 (final) : PLUS de barre pleine largeur.
 * Les contrôles flottent en verre neutre (gauche : retour / droite : actions)
 * au-dessus du contenu ; le titre appartient à la couche contenu.
 */
const SUBTITLE_CLAMP: Record<number, string> = {
  1: 'truncate',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
};

export function PageHeader({
  title,
  subtitle,
  subtitleLines = 1,
  back,
  backHref,
  backLabel,
  actions,
  variant = 'inline',
  className,
  ...props
}: PageHeaderProps) {
  const backNode =
    back === true ? (
      <HeaderBackButton fallbackHref={backHref} label={backLabel} />
    ) : back ? (
      <div className="flex shrink-0 items-center">{back}</div>
    ) : null;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 z-[var(--z-sticky)] flex items-center justify-between px-[var(--lkv-screen-margin)]"
        style={{ top: 'calc(var(--safe-top) + var(--space-2))' }}
      >
        <div className="pointer-events-auto flex items-center gap-[var(--space-2)]">
          {backNode}
        </div>
        {actions && (
          <div className="pointer-events-auto flex items-center gap-[var(--space-2)]">
            {actions}
          </div>
        )}
      </div>

      <header
        {...props}
        data-variant={variant}
        className={cn(
          'w-full pt-[calc(var(--header-height)+var(--space-2))]',
          className
        )}
      >
        <h1
          className={cn(
            'font-bold text-[color:var(--lkv-text-primary)]',
            variant === 'inline'
              ? 'text-[length:var(--lkv-text-title-sm)] leading-[var(--lkv-line-title)] tracking-[var(--lkv-tracking-title)]'
              : 'text-[length:var(--lkv-text-title-lg)] leading-[var(--lkv-line-title)] tracking-[var(--lkv-tracking-title)]'
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={cn(
              'mt-[var(--space-1)] text-[length:var(--lkv-text-subheadline)] text-[color:var(--lkv-text-secondary)]',
              SUBTITLE_CLAMP[subtitleLines] ?? ''
            )}
          >
            {subtitle}
          </p>
        )}
      </header>
    </>
  );
}

export default PageHeader;
