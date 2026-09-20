'use client';

import React from 'react';
import AppShell from '@/components/shell/AppShell';

export interface MapPageLayoutProps {
  /** La carte occupe tout l'écran, sous les overlays. */
  map: React.ReactNode;
  /** Contrôles flottants (recherche, filtres, boutons carte). */
  controls?: React.ReactNode;
  /** Contenu superposé (panneau, sheet, liste). */
  children?: React.ReactNode;
  header?: React.ReactNode;
  bottomExtra?: React.ReactNode;
  safeTop?: boolean;
  hasBottomNav?: boolean;
  className?: string;
}

/**
 * MapPageLayout — carte plein écran + overlays.
 * La carte est la couche de base ; header, contrôles et contenu flottent
 * au-dessus avec les tokens de z-index.
 */
export function MapPageLayout({
  map,
  controls,
  children,
  header,
  bottomExtra,
  safeTop = true,
  hasBottomNav = true,
  className,
}: MapPageLayoutProps) {
  return (
    <AppShell
      safeTop={safeTop}
      hasBottomNav={hasBottomNav}
      header={header}
      bottomExtra={bottomExtra}
      videoBackground={false}
      className={className}
    >
      <div className="relative h-[100dvh] w-full">
        <div className="absolute inset-0 z-[var(--z-base)]">{map}</div>
        {controls && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[var(--z-sticky)] flex flex-col gap-[var(--space-2)] p-[var(--space-4)]">
            {controls}
          </div>
        )}
        {children && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[var(--z-fab)]">
            <div className="pointer-events-auto">{children}</div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default MapPageLayout;
