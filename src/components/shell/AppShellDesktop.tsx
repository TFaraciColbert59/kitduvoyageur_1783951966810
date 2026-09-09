'use client';

import React from 'react';
import Header from '@/components/Header';
import { CompteBackground } from '@/components/compte/CompteBackground';
import { cn } from '@/lib/utils';

export interface AppShellDesktopProps {
  /** Slot colonne gauche (260px) : navigation verticale, menu */
  sidebarLeft?: React.ReactNode;
  /** Slot colonne droite (300px) : alertes, météo, actions contextuelles */
  sidebarRight?: React.ReactNode;
  /** Contenu principal (colonne centrale extensible) */
  children: React.ReactNode;
  /** Slot mobile optionnel (affiché uniquement sur < md) */
  mobileSlot?: React.ReactNode;
  /** Classes additionnelles pour le conteneur principal */
  className?: string;
  /** Afficher le header global du site (défaut: true) */
  showHeader?: boolean;
  /** Slot navigation supérieure personnalisé */
  topNav?: React.ReactNode;
  /** Background personnalisé (défaut: CompteBackground canopée) */
  background?: React.ReactNode;
  /** Activer le fond vidéo CompteBackground */
  backgroundVideo?: boolean;
  /** Largeur de la colonne gauche (défaut: w-[260px]) */
  leftWidth?: string;
  /** Largeur de la colonne droite (défaut: w-[300px]) */
  rightWidth?: string;
  /** Largeur max du cockpit (défaut: max-w-[1680px]) */
  maxWidth?: string;
  /** Espacement entre colonnes (défaut: gap-5) */
  gap?: string;
}

/**
 * AppShellDesktop — Cockpit universel 3 colonnes LKDV (Chantiers U & Y)
 *
 * Reproduit la structure de référence souveraine de /pays :
 * - Header global (56-62px) ou topNav custom
 * - 3 colonnes : 260px (gauche) / flex-1 (centre) / 300px (droite)
 * - Largeur max 1680px, espacement gap-5
 * - Hauteur h-dvh avec scrollbars masquées (no-scrollbar)
 * - Fond immersif CompteBackground par défaut
 */
export function AppShellDesktop({
  sidebarLeft,
  sidebarRight,
  children,
  mobileSlot,
  className,
  showHeader = true,
  topNav,
  background = <CompteBackground />,
  backgroundVideo = false,
  leftWidth = 'w-[260px]',
  rightWidth = 'w-[300px] hidden lg:block',
  maxWidth = 'max-w-[1680px]',
  gap = 'gap-5',
}: AppShellDesktopProps) {
  const bg = backgroundVideo ? <CompteBackground /> : background;

  return (
    <div
      className={cn(
        'min-h-screen md:h-dvh md:overflow-hidden text-[var(--lkv-text-primary)] selection:bg-[var(--lkv-text-primary)]/10 font-sans relative',
        className
      )}
    >
      {/* Background immersif végétal / canopée */}
      {bg}

      {/* 1. VERSION MOBILE (< 768px) */}
      {mobileSlot && (
        <div className="block md:hidden min-h-screen">
          {mobileSlot}
        </div>
      )}

      {/* 2. VERSION DESKTOP COCKPIT 3 COLONNES FULLSCREEN */}
      <div className={cn(mobileSlot ? 'hidden md:flex' : 'flex', 'flex-col h-full overflow-hidden')}>
        {topNav ? topNav : (showHeader && <Header />)}

        {/* Main 3-Column Cockpit Container */}
        <div className={`flex-1 overflow-hidden pt-14 sm:pt-[62px] pb-4 px-4 sm:px-6 lg:px-8 ${maxWidth} w-full mx-auto`}>
          <div className={`flex items-start ${gap} h-full`}>

            {/* LEFT COLUMN: NAVIGATION TABS SIDEBAR */}
            {sidebarLeft && (
              <aside className={`${leftWidth} shrink-0 h-full overflow-hidden flex flex-col`}>
                {sidebarLeft}
              </aside>
            )}

            {/* CENTER COLUMN: EXPANDED MAIN TAB CONTENT */}
            <main id="main-content" className="flex-1 min-w-0 h-full overflow-y-auto no-scrollbar space-y-4 px-1 pb-6">
              {children}
            </main>

            {/* RIGHT COLUMN: SIDEBAR WIDGETS WITHOUT HEADERS */}
            {sidebarRight && (
              <aside className={`${rightWidth} shrink-0 h-full overflow-hidden flex flex-col`}>
                {sidebarRight}
              </aside>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

export default AppShellDesktop;
