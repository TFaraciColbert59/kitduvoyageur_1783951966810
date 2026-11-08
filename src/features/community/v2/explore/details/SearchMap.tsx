'use client';

import React, { useMemo, useState } from 'react';
import type { SearchHitVM } from '../../shared/types';
import { PlaceMiniMap, type PlaceMiniMapPoint } from '../../shared/PlaceMiniMap';
import { SearchResultRow } from '../search/SearchResults';

export interface SearchMapProps {
  hits: SearchHitVM[];
  terms: ReadonlyArray<string>;
  onPeek?: (hit: SearchHitVM, opener: HTMLElement) => void;
}

interface MapEntry {
  hit: SearchHitVM;
  point: PlaceMiniMapPoint;
}

/**
 * « Sur la carte » (Recherche#15) : les carnets et sorties trouvés sur la
 * mini-carte topo existante (PlaceMiniMap, plusieurs repères — aucune nouvelle
 * origine CSP). Toucher un repère affiche le résultat sous la carte.
 */
export function SearchMap({ hits, terms, onPeek }: SearchMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const entries = useMemo<MapEntry[]>(() => {
    return hits
      .filter((hit) => (hit.kind === 'carnet' || hit.kind === 'sortie') && hit.lat != null && hit.lng != null)
      .map((hit) => ({
        hit,
        point: {
          lat: hit.lat as number,
          lng: hit.lng as number,
          kind: hit.kind,
          label: hit.title,
        },
      }));
  }, [hits]);

  if (entries.length === 0) {
    return (
      <div className="lkdv-cv2-empty" role="status">
        <span className="lkdv-cv2-empty-ico" aria-hidden="true">
          !
        </span>
        <b>Aucun lieu à placer sur la carte</b>
        <p>Les carnets et sorties trouvés n’ont pas de coordonnées. Reviens en liste pour les ouvrir.</p>
      </div>
    );
  }

  const selected = entries.find((entry) => entry.hit.id === selectedId) ?? null;

  return (
    <div className="lkdv-cv2x-search-map">
      <PlaceMiniMap
        lat={null}
        lng={null}
        points={entries.map((entry) => entry.point)}
        onPointClick={(index) => {
          const entry = entries[index];
          if (entry) setSelectedId(entry.hit.id === selectedId ? null : entry.hit.id);
        }}
        height={220}
        interactive
        label={`Carte des résultats : ${entries.length} repères`}
      />
      <p className="lkdv-cv2-meta lkdv-cv2x-map-hint">
        {entries.length} {entries.length > 1 ? 'repères' : 'repère'} sur la carte. Touche un repère pour voir le
        résultat.
      </p>
      {selected ? (
        <div className="lkdv-cv2x-search-list">
          <SearchResultRow
            hit={selected.hit}
            terms={terms}
            index={0}
            active={false}
            rowId="cv2-map-selected"
            onPeek={onPeek}
          />
        </div>
      ) : null}
    </div>
  );
}

export default SearchMap;
