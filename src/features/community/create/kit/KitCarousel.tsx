'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pages balayées à l'horizontale (scroll-snap), une à la fois, avec points.
 * Remplace le défilement vertical des listes : le drawer ne défile pas.
 * Le défilement horizontal est natif (inertie, snap) ; l'indicateur suit la page visible.
 */
export function KitCarousel({
  label,
  pages,
  resetKey,
  scrollToPage,
}: {
  label: string;
  pages: React.ReactNode[];
  /** Change quand le contenu change (nouvelle recherche, autre filtre) : retour à la première page. */
  resetKey?: string;
  /** Va à cette page quand la valeur change (ex. dernière page après un ajout). */
  scrollToPage?: number;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);

  const sync = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setIndex(
      Math.max(0, Math.min(pages.length - 1, Math.round(track.scrollLeft / track.clientWidth)))
    );
  }, [pages.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: 0 });
    setIndex(0);
  }, [resetKey]);

  useEffect(() => {
    if (scrollToPage === undefined) return;
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: scrollToPage * track.clientWidth, behavior: 'smooth' });
  }, [scrollToPage]);

  const goTo = (target: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' });
  };

  return (
    <div
      className="lkdv-kc-carousel"
      role="group"
      aria-roledescription="carrousel"
      aria-label={label}
    >
      <div
        className="lkdv-kc-track"
        ref={trackRef}
        onScroll={sync}
        tabIndex={0}
        data-no-swipe={pages.length > 1 ? 'true' : undefined}
      >
        {pages.map((page, i) => (
          <div
            key={i}
            className="lkdv-kc-page"
            role="group"
            aria-roledescription="diapositive"
            aria-label={`${i + 1} sur ${pages.length}`}
          >
            {page}
          </div>
        ))}
      </div>
      {pages.length > 1 ? (
        <div className="lkdv-kc-dots" role="tablist" aria-label="Pages">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Page ${i + 1}`}
              onClick={() => goTo(i)}
            >
              <span data-on={i === index ? 'true' : 'false'} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default KitCarousel;
