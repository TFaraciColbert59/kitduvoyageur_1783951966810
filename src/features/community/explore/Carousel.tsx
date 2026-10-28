'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pages balayées à l'horizontale (scroll-snap), une à la fois, avec points.
 * Remplace le défilement vertical des listes : le drawer ne défile pas.
 * Le défilement horizontal est natif (inertie, snap) ; l'indicateur suit la page visible.
 */
export function Carousel({
  label,
  pages,
  resetKey,
}: {
  label: string;
  pages: React.ReactNode[];
  /** Change quand le contenu change (nouvelle recherche, autre filtre) : retour à la première page. */
  resetKey?: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);

  const sync = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setIndex(Math.max(0, Math.min(pages.length - 1, Math.round(track.scrollLeft / track.clientWidth))));
  }, [pages.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: 0 });
    setIndex(0);
  }, [resetKey]);

  const goTo = (target: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="lkdv-ex-carousel" role="group" aria-roledescription="carrousel" aria-label={label}>
      <div className="lkdv-ex-track" ref={trackRef} onScroll={sync} tabIndex={0}>
        {pages.map((page, i) => (
          <div key={i} className="lkdv-ex-page" role="group" aria-roledescription="diapositive" aria-label={`${i + 1} sur ${pages.length}`}>
            {page}
          </div>
        ))}
      </div>
      {pages.length > 1 ? (
        <div className="lkdv-ex-dots" role="tablist" aria-label="Pages">
          {pages.map((_, i) => (
            <button key={i} type="button" role="tab" aria-selected={i === index} aria-label={`Page ${i + 1}`} onClick={() => goTo(i)}>
              <span data-on={i === index ? 'true' : 'false'} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default Carousel;
