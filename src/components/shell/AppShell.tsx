'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import CompteBackground from '@/components/compte/CompteBackground';
import { hasExtendedNav } from '@/components/mobile-nav/destinationRegistry';
import {
  hasDayFocusPlateau,
  useDayFocusStore,
} from '@/components/mobile-nav/dayFocusStore';

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
 * AppShell est l'unique shell de page de l'application : safe areas, header, zone
 * de scroll et reservation de la navigation. Toute page — ancienne ou nouvelle —
 * passe par ici.
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

  // Plateau jour : present des que le voyage actif est decoupe en >= 2
  // journees. Meme fonction pure que WebNavigationBar : les deux etant
  // dans des arbres React distincts, elle est le seul contrat possible
  // entre la reservation d'ici et le rendu de la-bas.
  const dayFocusDays = useDayFocusStore((state) => state.days);
  const hasDayPlateau = hasDayFocusPlateau(pathname, dayFocusDays);

  // Offsets canoniques (tokens.css) : plus aucune valeur 80/68/52 locale.
  const bottomNavHeight = !hasBottomNav
    ? 'var(--page-bottom-inset-bare)'
    : hasUpperExtension || hasDayPlateau
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
        ['--content-pb' as any]: `max(${bottomNavHeight}, var(--cookie-banner-h, 0px)) + var(--space-6, 24px)`,
        ['--shell-top-padding' as any]: safeTop ? 'var(--page-top-inset)' : '0px',
        ...(containerBgStyle ? { background: containerBgStyle } : {}),
        position: 'relative',
        paddingTop: safeTop ? 'var(--page-top-inset)' : '0px',
        // Le shell réserve la place de la navigation (offset canonique) + marge de sécurité (OBS-G01) ;
        // bottomExtra se cale au-dessus via --bottom-nav-height.
        // --cookie-banner-h vient de <CookieConsentBanner> (0px sinon) : sans
        // lui, la banniere cookie (overlay fixe) recouvre la sous-nav de fin
        // de flux et la rend incliquable.
        // max() : sans banniere c'est la nav qui reserve ; avec banniere c'est
        // la bande, qui contient deja la nav (sinon on reserverait deux fois).
        paddingBottom: 'max(var(--bottom-nav-height), var(--cookie-banner-h, 0px))',
        scrollPaddingBottom: 'max(var(--bottom-nav-height), var(--cookie-banner-h, 0px))',
      }}
    >
      {/* Skip Link pour navigation clavier et lecteurs d'écran (WCAG AA 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--glass-label)] focus:text-[var(--g3-text)] focus:text-sm focus:font-semibold focus:rounded-xl focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        Aller au contenu principal
      </a>

      {videoBackground && <CompteBackground />}

      {/* Y3.3 — bandeau d'expédition active retiré : remplacé par ActiveTripSwitcher (hub) */}

      {/* Slot header sticky (optionnel) */}
      {header && (
        <header className="sticky top-0 z-40 w-full">
          {header}
        </header>
      )}

      {/* Contenu du shell — le landmark <main id="main-content"> unique est
          rendu par src/app/layout.tsx (M04) : ici un conteneur neutre pour
          ne jamais dupliquer le repère principal. Marge de sécurité OBS-G01. */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '100%', paddingBottom: 'var(--space-6, 24px)' }}>
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

