'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';

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
  const [headerHidden, setHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const prev = lastScrollY.current;
    lastScrollY.current = latest;
    if (latest <= 24) {
      if (headerHidden) setHeaderHidden(false);
      return;
    }
    if (latest > prev + 6) {
      if (!headerHidden) setHeaderHidden(true);
    } else if (latest < prev - 6) {
      if (headerHidden) setHeaderHidden(false);
    }
  });

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
        <motion.header
          ref={headerRef}
          className="lkdv-feed-header"
          initial={false}
          animate={
            headerHidden
              ? { y: '-115%', opacity: 0, scale: 0.96 }
              : { y: 0, opacity: 1, scale: 1 }
          }
          transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.85 }}
          style={{ pointerEvents: headerHidden ? 'none' : 'auto' }}
        >
          {topBar}
        </motion.header>
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
