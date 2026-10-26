'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { buildRegionTiles, type PaysDestinationSource, type PaysRegionSource } from '@/components/pays/paysDrawerData';

interface PaysRegionGridProps {
  countryCode: string;
  destinations: PaysDestinationSource[];
  onSelectRegion: (selection: { category: string | null; query: string }) => void;
}

function Skeleton() {
  return (
    <div className="ig-grid" aria-busy="true" aria-label="Chargement des régions">
      {Array.from({ length: 6 }).map((_, index) => (
        <span className="ig-tile lkdv-skeleton-card" key={index} aria-hidden="true">
          <span className="lkdv-skeleton-block" style={{ width: '100%', height: '100%', borderRadius: 2 }} />
        </span>
      ))}
    </div>
  );
}

export function PaysRegionGrid({ countryCode, destinations, onSelectRegion }: PaysRegionGridProps) {
  const [regions, setRegions] = useState<PaysRegionSource[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const code = countryCode.toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
      setRegions([]);
      return undefined;
    }
    fetch(`/api/pays/${code}/regions`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!alive) return;
        if (!data || !Array.isArray(data.items)) {
          setRegions([]);
          setFailed(true);
          return;
        }
        setRegions(data.items.filter((item: any) => Boolean(item?.name)));
      })
      .catch(() => {
        if (!alive) return;
        setRegions([]);
        setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [countryCode]);

  const tiles = useMemo(() => buildRegionTiles(regions, destinations), [regions, destinations]);
  if (!regions) return <Skeleton />;
  if (failed && tiles.length === 0) {
    return (
      <div className="lkdv-sheet-card" role="status">
        <div className="lkdv-sheet-card__head"><b>Zones indisponibles</b></div>
        <p className="lkdv-sheet-card__hint">Le référentiel des zones n’a pas pu être chargé. Aucune zone n’a été inventée.</p>
      </div>
    );
  }
  if (tiles.length === 0) {
    return (
      <div className="lkdv-sheet-card" role="status">
        <div className="lkdv-sheet-card__head"><b>Aucune zone renseignée</b></div>
        <p className="lkdv-sheet-card__hint">Aucune zone n’est encore associée à ce pays.</p>
      </div>
    );
  }

  return (
    <div className="ig-grid lkdv-region-grid" role="list" aria-label="Zones du pays">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            className="ig-tile"
            role="listitem"
            aria-label={`${tile.name}${tile.count > 0 ? `, ${tile.count} fiche${tile.count > 1 ? 's' : ''}` : ''}`}
            onClick={() => onSelectRegion({ category: tile.category, query: tile.category ? '' : tile.query })}
          >
            {tile.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- photo réelle de la zone
              <img src={tile.image} alt="" loading="lazy" />
            ) : (
              <span className="lkdv-region-initial" aria-hidden="true">{tile.name.slice(0, 2).toUpperCase()}</span>
            )}
            <span className="t-type" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden="true">
                <path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Z" />
              </svg>
            </span>
            <span className="t-bot" aria-hidden="true">
              <b>{tile.name}</b>
              {tile.count > 0 ? <small>{tile.count}</small> : null}
            </span>
          </button>
        ))}
    </div>
  );
}
