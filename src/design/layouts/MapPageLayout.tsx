'use client';

import React from 'react';
import AppShell from '@/components/shell/AppShell';

export interface MapPageLayoutProps {
  /** La carte occupe tout le viewport, sous les overlays. */
  map: React.ReactNode;
  /** Contrôles/overlays ancrés en haut (recherche, filtres, en-têtes). */
  controls?: React.ReactNode;
  /** Contenu superposé ancré en bas (carrousel, CTA, feuilles). */
  children?: React.ReactNode;
  /** Couche superposition plein écran (panneau liste desktop, docks). */
  overlay?: React.ReactNode;
  header?: React.ReactNode;
  bottomExtra?: React.ReactNode;
  safeTop?: boolean;
  hasBottomNav?: boolean;
  className?: string;
}

/**
 * MapPageLayout — carte plein écran + overlays.
 * La carte est `fixed inset-0` (le viewport entier, y compris sous la nav) ;
 * les contrôles et contenus flottent au-dessus via les tokens `--z-*`.
 * Les wrappers d'overlay sont `pointer-events-none` : seuls les éléments
 * interactifs déclarent `pointer-events-auto`, la carte reste manipulable.
 */
export function MapPageLayout({
  map,
  controls,
  children,
  overlay,
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
      <div className="fixed inset-0 z-[var(--z-base)]">{map}</div>
      {overlay && (
        <div className="pointer-events-none fixed inset-0 z-[var(--z-fab)]">{overlay}</div>
      )}
      {controls && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[var(--z-sticky)] flex flex-col gap-[var(--space-2)] p-[var(--space-4)]">
          {controls}
        </div>
      )}
      {children && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-fab)]">
          <div className="pointer-events-auto">{children}</div>
        </div>
      )}
    </AppShell>
  );
}

export default MapPageLayout;
