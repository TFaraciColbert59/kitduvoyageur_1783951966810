'use client';

import React, { useEffect, useRef } from 'react';

export interface CommunityFeedShellProps {
  topBar: React.ReactNode;
  stories?: React.ReactNode;
  bottomBar?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Coquille du fil : fond applicatif, colonne 430–520 px, en-tête sticky,
 * stories, fil. La barre unique iOS 27 Liquid Glass est montée globalement.
 */
export function CommunityFeedShell({ topBar, stories, bottomBar, children }: CommunityFeedShellProps) {
  const hasStories = Boolean(stories);
  const headerRef = useRef<HTMLElement | null>(null);
  const storiesRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  // Espacement stable entre l'en-tête, les stories et le fil : pas de mesure dynamique
  // en cours de scroll afin d'éviter tout tremblement ou crash de mise en page.
  useEffect(() => {
    const strip = storiesRef.current;
    if (!strip) return;
    strip.style.marginTop = '16px';
  }, [hasStories]);

  return (
    <div className="lkdv-feed-shell lkdv-account-glass">
      <div className="lkdv-feed-column">
        <header ref={headerRef} className="lkdv-feed-header">{topBar}</header>
        {stories ? (
          <div ref={storiesRef} className="lkdv-feed-stories lkdv-feed-stories--aligned">
            {stories}
          </div>
        ) : null}
        <section ref={mainRef} className="lkdv-feed-main" aria-label="Fil d’actualité">
          {children}
        </section>
      </div>
      {bottomBar || null}
    </div>
  );
}

export default CommunityFeedShell;
