'use client';

import React from 'react';
import { PageLayout, type PageLayoutProps } from './PageLayout';

export interface ListPageLayoutProps extends Omit<PageLayoutProps, 'actions'> {
  /**
   * Barre de filtres / onglets — même emplacement sur toutes les listes
   * (sous le header, au-dessus de la liste).
   */
  toolbar?: React.ReactNode;
  /** Action principale flottante (FAB) éventuelle. */
  floatingAction?: React.ReactNode;
  listClassName?: string;
}

/**
 * ListPageLayout — liste + filtres + action flottante optionnelle.
 * Les filtres restent au même endroit d'une liste à l'autre.
 */
export function ListPageLayout({
  toolbar,
  floatingAction,
  listClassName,
  contentClassName,
  children,
  ...props
}: ListPageLayoutProps) {
  return (
    <PageLayout {...props} contentClassName={contentClassName}>
      {toolbar && <div className="w-full">{toolbar}</div>}
      <div className={listClassName}>{children}</div>
      {floatingAction && <div className="pointer-events-none fixed bottom-[var(--nav-offset)] right-0 z-[var(--z-fab)] p-[var(--space-4)]">{floatingAction}</div>}
    </PageLayout>
  );
}

export default ListPageLayout;
