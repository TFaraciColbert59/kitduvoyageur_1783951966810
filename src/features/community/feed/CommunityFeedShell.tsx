'use client';

import React, { useEffect } from 'react';

export interface CommunityFeedShellProps {
  topBar: React.ReactNode;
  stories?: React.ReactNode;
  /** Carte-drawer posée sur la zone stories + fil (voir `CommunityCardDrawer`). */
  drawer?: React.ReactNode;
  /** Vrai quand une carte-drawer est ouverte : le fil dessous devient inerte. */
  drawerOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Coquille de la Communauté : fond applicatif, colonne 430–520 px, en-tête et
 * stories fixes, fil de posts. La page ne défile jamais (`100dvh`) : le seul
 * conteneur défilant est `.lkdv-feed-main`. La barre basse globale iOS 27
 * Liquid Glass est gérée par MobileNavWrapper.
 */
export function CommunityFeedShell({ topBar, stories, drawer, drawerOpen = false, children }: CommunityFeedShellProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('lkdv-no-page-scroll');
    return () => root.classList.remove('lkdv-no-page-scroll');
  }, []);

  return (
    <div className="lkdv-feed-shell lkdv-feed-shell--locked lkdv-account-glass">
      <div className="lkdv-feed-column">
        <header className="lkdv-feed-header">{topBar}</header>
        <div className="lkdv-feed-body">
          <div className="lkdv-feed-under" inert={drawerOpen} aria-hidden={drawerOpen || undefined}>
            {stories ? <div className="lkdv-feed-stories">{stories}</div> : null}
            <section className="lkdv-feed-main" aria-label="Fil d’actualité">
              {children}
            </section>
          </div>
          {drawer ?? null}
        </div>
      </div>
    </div>
  );
}

export default CommunityFeedShell;
