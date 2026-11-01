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

  /* Même vide au-dessus et au-dessous des stories : l'écart du dessous (stories
     → premier post) fait référence ; celui du dessus (barre → stories) est
     aligné dessus, mesuré sur l'appareil. */
  useEffect(() => {
    const header = headerRef.current;
    const strip = storiesRef.current;
    const main = mainRef.current;
    if (!header || !strip || !main) return;
    let frame = 0;
    const align = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const first = main.querySelector<HTMLElement>('.lkdv-feed-post, .lkdv-feed-skeleton, .lkdv-feed-empty');
        if (!first) return;
        const style = getComputedStyle(strip);
        const box = strip.getBoundingClientRect();
        if (box.height === 0) return;
        const contentTop = box.top + parseFloat(style.paddingTop || '0');
        const contentBottom = box.bottom - parseFloat(style.paddingBottom || '0');
        const above = contentTop - header.getBoundingClientRect().bottom;
        const below = first.getBoundingClientRect().top - contentBottom;
        const current = parseFloat(style.marginTop || '0') || 0;
        const next = Math.max(0, Math.round(current + (below - above)));
        if (Math.abs(next - current) >= 1) strip.style.marginTop = `${next}px`;
      });
    };
    align();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(align) : null;
    observer?.observe(strip);
    observer?.observe(header);
    observer?.observe(main);
    window.addEventListener('resize', align);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', align);
    };
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
