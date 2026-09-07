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
  /** Background personnalisé (défaut: CompteBackground canopée) */
  background?: React.ReactNode;
}

/**
 * AppShellDesktop — Cockpit universel 3 colonnes LKDV
 *
 * Reproduit la structure de référence souveraine de /pays :
 * - Header global (56-62px)
 * - 3 colonnes : 260px (gauche) / flex-1 (centre) / 300px (droite)
 * - Largeur max 1680px, espacement gap-5
 * - Hauteur h-dvh avec scrollbars masquées (no-scrollbar)
 * - Fond immersif CompteBackground par défaut
 */
export default function AppShellDesktop({
  sidebarLeft,
  sidebarRight,
  children,
  mobileSlot,
  className,
  showHeader = true,
  background = <CompteBackground />,
}: AppShellDesktopProps) {
  return (
    <div
      className={cn(
        'min-h-screen md:h-dvh md:overflow-hidden text-[#17402C] selection:bg-[#17402C]/10 font-sans relative',
        className
      )}
    >
      {/* Background immersif végétal / canopée */}
      {background}

      {/* 1. VERSION MOBILE (< 768px) */}
      {mobileSlot && (
        <div className="block md:hidden min-h-screen">
          {mobileSlot}
        </div>
      )}

      {/* 2. VERSION DESKTOP COCKPIT 3 COLONNES FULLSCREEN */}
      <div className={cn(mobileSlot ? 'hidden md:flex' : 'flex', 'flex-col h-full overflow-hidden')}>
        {showHeader && <Header />}

        {/* Main 3-Column Cockpit Container */}
        <div className="flex-1 overflow-hidden pt-14 sm:pt-[62px] pb-4 px-4 sm:px-6 lg:px-8 max-w-[1680px] w-full mx-auto">
          <div className="flex items-start gap-5 h-full">

            {/* LEFT COLUMN: NAVIGATION TABS SIDEBAR (260px) */}
            {sidebarLeft && (
              <div className="w-[260px] shrink-0 h-full overflow-hidden">
                {sidebarLeft}
              </div>
            )}

            {/* CENTER COLUMN: EXPANDED MAIN TAB CONTENT */}
            <main id="main-content" className="flex-1 h-full overflow-y-auto no-scrollbar space-y-4 px-1 pb-6">
              {children}
            </main>

            {/* RIGHT COLUMN: SIDEBAR WIDGETS WITHOUT HEADERS (300px) */}
            {sidebarRight && (
              <div className="w-[300px] shrink-0 h-full overflow-hidden">
                {sidebarRight}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
