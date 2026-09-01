'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import CompteBackground from '@/components/compte/CompteBackground';

export interface AppShellProps {
  children: React.ReactNode;
  background?: string;
  videoBackground?: boolean;
  /**
   * Appliquer le padding-top safe-area (Dynamic Island / Notch / Status Bar).
   * ⚠ Mettre à `false` UNIQUEMENT si la page embarque son propre header sticky
   * qui gère déjà `env(safe-area-inset-top)` — et toujours ajouter un commentaire
   * JSX juste avant l'usage expliquant quel composant le gère et à quelle ligne.
   * Ne jamais mettre `false` sans raison documentée.
   */
  safeTop?: boolean;
  hasBottomNav?: boolean;
  /**
   * Slot header : rendu en position sticky dans le shell.
   * Utiliser ce slot évite de gérer manuellement env(safe-area-inset-top) dans la page.
   * Le header slot reçoit le safe-area-top via le padding du shell parent (safeTop=true),
   * ou gère lui-même le safe-area si safeTop=false.
   */
  header?: React.ReactNode;
  /**
   * Slot bottomExtra : contenu additionnel AU-DESSUS de la bottom bar.
   * Quand fourni, le shell gère le padding-bottom pour accommoder cet élément.
   * Exemple : filtres continents au-dessus de la BottomTabBar.
   */
  bottomExtra?: React.ReactNode;
  className?: string;
}

/**
 * AppShell — source unique de vérité pour le layout mobile LKDV.
 *
 * Règles :
 * 1. Toute nouvelle page mobile DOIT utiliser ce composant.
 * 2. Aucune page ne doit calculer env(safe-area-inset-top/bottom) elle-même.
 * 3. safeTop=false uniquement si la page a un header sticky maison qui gère déjà
 *    le safe-area — ET documenté avec un commentaire JSX.
 *
 * Migration : MobilePageShell reste en service pour les pages existantes.
 * AppShell est le composant cible pour toutes les nouvelles pages.
 */
export default function AppShell({
  children,
  background = 'transparent',
  videoBackground = true,
  safeTop = true,
  hasBottomNav = true,
  header,
  bottomExtra,
  className = '',
}: AppShellProps) {
  const pathname = usePathname();

  // Routes avec plateau de navigation secondaire au-dessus de la bottom bar
  const hasUpperExtension =
    pathname?.startsWith('/communaute') ||
    pathname?.startsWith('/pays') ||
    pathname?.startsWith('/carnets') ||
    pathname?.startsWith('/groupes') ||
    pathname?.startsWith('/clubs') ||
    pathname?.startsWith('/entraide') ||
    pathname?.startsWith('/evenements') ||
    pathname?.startsWith('/alertes') ||
    pathname === '/messagerie';

  const bottomNavHeight = !hasBottomNav
    ? 'calc(12px + env(safe-area-inset-bottom, 0px))'
    : hasUpperExtension
    ? 'var(--bottom-tab-extended-height, calc(92px + env(safe-area-inset-bottom, 0px)))'
    : 'var(--bottom-tab-base-height, calc(52px + env(safe-area-inset-bottom, 0px)))';

  return (
    <div
      className={`app-shell ${className}`}
      style={{
        ['--bottom-nav-height' as any]: bottomNavHeight,
        background: videoBackground ? 'transparent' : background,
        paddingTop: safeTop ? 'calc(env(safe-area-inset-top, 0px) + 8px)' : '0px',
        // Quand bottomExtra est présent, pas de padding-bottom sur le conteneur principal
        // (le bottomExtra lui-même gère son spacing via padding-bottom: var(--bottom-nav-height))
        paddingBottom: 'var(--bottom-nav-height)',
        scrollPaddingBottom: 'var(--bottom-nav-height)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        minHeight: '100dvh',
        position: 'relative',
        overflowX: 'clip',
        overscrollBehavior: 'none',
        overscrollBehaviorY: 'none',
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box',
      }}
    >
      {videoBackground && <CompteBackground />}

      {/* Slot header sticky (optionnel) */}
      {header && (
        <div style={{ position: 'sticky', top: 0, zIndex: 40, width: '100%' }}>
          {header}
        </div>
      )}

      {/* Contenu principal */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '100%' }}>
        {children}
      </div>

      {/* Slot bottomExtra (optionnel) — contenu au-dessus de la bottom bar */}
      {bottomExtra && (
        <div style={{ position: 'relative', zIndex: 2, width: '100%' }}>
          {bottomExtra}
        </div>
      )}
    </div>
  );
}
