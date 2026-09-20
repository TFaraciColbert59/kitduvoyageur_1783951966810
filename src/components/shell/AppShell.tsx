'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import CompteBackground from '@/components/compte/CompteBackground';
import { hasExtendedNav } from '@/components/mobile-nav/destinationRegistry';

export interface AppShellProps {
  children?: React.ReactNode;
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

  // Source unique du plateau secondaire (destinationRegistry) — plus de liste
  // de routes dupliquée ici.
  const hasUpperExtension = hasExtendedNav(pathname);

  // Offsets canoniques (tokens.css) : plus aucune valeur 80/68/52 locale.
  const bottomNavHeight = !hasBottomNav
    ? 'var(--page-bottom-inset-bare)'
    : hasUpperExtension
    ? 'var(--nav-offset-extended)'
    : 'var(--nav-offset)';

  // TOILE UNIQUE : le fond applicatif (image marbrée) est global et fixe.
  // Le shell est transparent par défaut pour le laisser traverser sur toutes
  // les routes ; seul un `background` explicite (hors 'transparent') peint.
  const containerBgStyle = background === 'transparent' ? undefined : background;
  const containerBgClass = '';

  return (
    <div
      className={`app-shell mobile-page-shell lkv-shell ${containerBgClass} ${className}`}
      style={{
        ['--bottom-nav-height' as any]: bottomNavHeight,
        ['--shell-top-padding' as any]: safeTop ? 'var(--page-top-inset)' : '0px',
        ...(containerBgStyle ? { background: containerBgStyle } : {}),
        position: 'relative',
        paddingTop: safeTop ? 'var(--page-top-inset)' : '0px',
        // Le shell réserve la place de la navigation (offset canonique) ;
        // bottomExtra se cale au-dessus via --bottom-nav-height.
        paddingBottom: 'var(--bottom-nav-height)',
        scrollPaddingBottom: 'var(--bottom-nav-height)',
      }}
    >
      {/* Skip Link pour navigation clavier et lecteurs d'écran (WCAG AA 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--lkv-primary)] focus:text-white focus:text-sm focus:font-semibold focus:rounded-xl focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        Aller au contenu principal
      </a>

      {videoBackground && <CompteBackground />}

      {/* Y3.3 — bandeau d'expédition active retiré : remplacé par ActiveTripSwitcher (hub) */}

      {/* Slot header sticky (optionnel) */}
      {header && (
        <header style={{ position: 'sticky', top: 0, zIndex: 40, width: '100%' }}>
          {header}
        </header>
      )}

      {/* Contenu du shell — le landmark <main id="main-content"> unique est
          rendu par src/app/layout.tsx (M04) : ici un conteneur neutre pour
          ne jamais dupliquer le repère principal. */}
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

export { AppShellDesktop } from './AppShellDesktop';
export type { AppShellDesktopProps } from './AppShellDesktop';

