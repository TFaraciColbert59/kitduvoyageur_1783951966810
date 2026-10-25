'use client';

import React from 'react';
import { PageActions } from '@/components/ui';
import { PageLayout, type PageLayoutProps } from './PageLayout';

export interface DetailPageLayoutProps extends PageLayoutProps {
  /** Média / hero de l'entité (image, carte, résumé). */
  hero?: React.ReactNode;
  /** Onglets internes de la fiche, toujours sous le hero. */
  tabs?: React.ReactNode;
  /** Action principale collée en bas (safe-area gérée). */
  stickyActions?: React.ReactNode;
}

/**
 * DetailPageLayout — fiche : hero → onglets → contenu → actions basses.
 * L'action principale d'une fiche est toujours en bas, au même endroit.
 */
export function DetailPageLayout({
  hero,
  tabs,
  stickyActions,
  children,
  ...props
}: DetailPageLayoutProps) {
  return (
    <PageLayout {...props}>
      {hero && <div className="w-full">{hero}</div>}
      {tabs && <div className="w-full">{tabs}</div>}
      {children}
      {stickyActions && <PageActions variant="sticky" fullWidth>{stickyActions}</PageActions>}
    </PageLayout>
  );
}

export default DetailPageLayout;
