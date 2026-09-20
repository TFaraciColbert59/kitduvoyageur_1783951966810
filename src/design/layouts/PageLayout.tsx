'use client';

import React from 'react';
import AppShell from '@/components/shell/AppShell';
import { Page, PageActions, PageContent, PageHeader, type PageWidth } from '@/components/ui';

export interface PageLayoutProps {
  children?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Slot retour — toujours au même emplacement (gauche du titre). */
  back?: React.ReactNode;
  headerActions?: React.ReactNode;
  /** Header entièrement custom (prioritaire sur title/back). */
  header?: React.ReactNode;
  /** Action principale de la page (rendue en fin de contenu). */
  actions?: React.ReactNode;
  bottomExtra?: React.ReactNode;
  safeTop?: boolean;
  hasBottomNav?: boolean;
  background?: string;
  videoBackground?: boolean;
  width?: PageWidth;
  padded?: boolean;
  className?: string;
  contentClassName?: string;
}

/**
 * PageLayout — structure de page canonique (Phase 1).
 *
 * Compose l'existant sans le remplacer : AppShell (safe areas, bottom nav)
 * + Page/PageHeader/PageContent/PageActions. Les pages migrent une par une.
 */
export function PageLayout({
  children,
  title,
  subtitle,
  back,
  headerActions,
  header,
  actions,
  bottomExtra,
  safeTop = true,
  hasBottomNav = true,
  background,
  videoBackground,
  width = 'content',
  padded = true,
  className,
  contentClassName,
}: PageLayoutProps) {
  const resolvedHeader =
    header ??
    (title ? <PageHeader title={title} subtitle={subtitle} back={back} actions={headerActions} /> : undefined);

  return (
    <AppShell
      background={background}
      videoBackground={videoBackground}
      safeTop={safeTop}
      hasBottomNav={hasBottomNav}
      bottomExtra={bottomExtra}
      header={resolvedHeader}
      className={className}
    >
      <Page width={width} padded={padded} className={contentClassName}>
        <PageContent spacing="lg">{children}</PageContent>
        {actions ? <PageActions variant="inline">{actions}</PageActions> : null}
      </Page>
    </AppShell>
  );
}

export default PageLayout;
