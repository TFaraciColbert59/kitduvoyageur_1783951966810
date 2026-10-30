'use client';

import React from 'react';

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
  return (
    <div className="lkdv-feed-shell lkdv-account-glass">
      <div className="lkdv-feed-column">
        <header className="lkdv-feed-header">{topBar}</header>
        {stories ? <div className="lkdv-feed-stories">{stories}</div> : null}
        <section className="lkdv-feed-main" aria-label="Fil d’actualité">
          {children}
        </section>
      </div>
      {bottomBar || null}
    </div>
  );
}

export default CommunityFeedShell;
