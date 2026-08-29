'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import CompteBackground from '@/components/compte/CompteBackground';

interface MobilePageShellProps {
  children: React.ReactNode;
  /**
   * Couleur de fond de la page mobile.
   */
  background?: string;
  /**
   * Activer le mode fond immersif : la canopée dorée CompteBackground est posée en fixe derrière.
   */
  videoBackground?: boolean;
  /**
   * Appliquer la safe area top pour éviter le chevauchement avec Dynamic Island / Notch / Status Bar.
   * Désactiver uniquement si la page embarque son propre header sticky avec safe area.
   */
  safeTop?: boolean;
  /**
   * Activer ou ajuster le padding inférieur pour la barre de navigation.
   */
  hasBottomNav?: boolean;
  className?: string;
}

/**
 * MobilePageShell — wrapper canonique pour les pages mobiles avec gestion rigoureuse des Safe Areas Apple & Android.
 */
export default function MobilePageShell({
  children,
  background = 'transparent',
  videoBackground = true,
  safeTop = true,
  hasBottomNav = true,
  className = '',
}: MobilePageShellProps) {
  const pathname = usePathname();

  // Détection des routes avec extension supérieure (plateau secondaire au-dessus de la bottom bar)
  const hasUpperExtension =
    pathname?.startsWith('/communaute') ||
    pathname?.startsWith('/pays') ||
    pathname?.startsWith('/carnets') ||
    pathname?.startsWith('/groupes') ||
    pathname?.startsWith('/clubs') ||
    pathname?.startsWith('/entraide') ||
    pathname?.startsWith('/evenements') ||
    pathname?.startsWith('/alertes');

  const bottomNavHeight = !hasBottomNav
    ? 'calc(12px + env(safe-area-inset-bottom, 0px))'
    : hasUpperExtension
    ? 'var(--bottom-tab-extended-height, calc(92px + env(safe-area-inset-bottom, 0px)))'
    : 'var(--bottom-tab-base-height, calc(52px + env(safe-area-inset-bottom, 0px)))';

  return (
    <div
      className={`mobile-page-shell ${className}`}
      style={{
        ['--bottom-nav-height' as any]: bottomNavHeight,
        background: videoBackground ? 'transparent' : background,
        paddingTop: safeTop ? 'calc(env(safe-area-inset-top, 0px) + 8px)' : '0px',
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
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '100%' }}>{children}</div>
    </div>
  );
}
