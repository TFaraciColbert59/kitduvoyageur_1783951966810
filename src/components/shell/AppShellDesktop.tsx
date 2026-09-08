'use client';

import React from 'react';
import Header from '@/components/Header';
import CompteBackground from '@/components/compte/CompteBackground';
import { ActiveTripBanner } from '@/features/trips/components/ActiveTripBanner';

export interface AppShellDesktopProps {
  topNav?: React.ReactNode;
  sidebarLeft?: React.ReactNode;
  children: React.ReactNode;
  sidebarRight?: React.ReactNode;
  leftWidth?: string;
  rightWidth?: string;
  maxWidth?: string;
  gap?: string;
  className?: string;
  backgroundVideo?: boolean;
  activeTripBanner?: boolean;
}

/**
 * AppShellDesktop — Composant réutilisable pour les cockpits 3 colonnes desktop LKDV (Chantier U - U2).
 * Source unique de structure pour les cockpits plein écran (ex: /pays, /materiel).
 */
export function AppShellDesktop({
  topNav = <Header />,
  sidebarLeft,
  children,
  sidebarRight,
  leftWidth = 'w-[260px]',
  rightWidth = 'w-[300px]',
  maxWidth = 'max-w-[1680px]',
  gap = 'gap-5',
  className = '',
  backgroundVideo = false,
  activeTripBanner = false,
}: AppShellDesktopProps) {
  return (
    <div className={`hidden md:flex flex-col h-full overflow-hidden ${className}`}>
      {backgroundVideo && <CompteBackground />}
      {topNav}
      {activeTripBanner && <ActiveTripBanner />}
      <div className={`flex-1 overflow-hidden pt-14 sm:pt-[62px] pb-4 px-4 sm:px-6 lg:px-8 ${maxWidth} w-full mx-auto`}>
        <div className={`flex items-start ${gap} h-full`}>
          {sidebarLeft && (
            <aside className={`${leftWidth} shrink-0 h-full overflow-hidden flex flex-col`}>
              {sidebarLeft}
            </aside>
          )}
          <main className="flex-1 min-w-0 h-full overflow-y-auto no-scrollbar space-y-4 px-1 pb-6">
            {children}
          </main>
          {sidebarRight && (
            <aside className={`${rightWidth} shrink-0 h-full overflow-hidden flex flex-col`}>
              {sidebarRight}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

export default AppShellDesktop;
