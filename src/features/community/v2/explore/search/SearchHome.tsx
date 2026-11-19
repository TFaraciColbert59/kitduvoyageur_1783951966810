'use client';

import React from 'react';
import type { TrendingItemVM } from '../../shared/types';
import { formatCountFr } from '../../shared/format';
import { ExploreIcon } from '../ExploreIcons';

export interface SearchHomeProps {
  recents: string[];
  trending: TrendingItemVM[];
  trendingLoading: boolean;
  onPickRecent: (query: string) => void;
  onDeleteRecent: (query: string) => void;
  onPickTrend: (label: string) => void;
}

/** Graine stable d'une illustration de lieu (aucun aléa, aucun état). */
function placeArtSeed(label: string): number {
  let hash = 7;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/**
 * Illustration de repli d'un lieu populaire. La maquette
 * (`maquette-communaute.html` L2256/L965-968) affiche une vignette paysage
 * (`art(a)`) ; `community_search_trending` ne renvoie aucune couverture : on
 * dessine donc un paysage déterministe, purement décoratif, en jetons verts.
 */
function PlaceArt({ label }: { label: string }) {
  const seed = placeArtSeed(label);
  const sunX = 16 + (seed % 62);
  const sunY = 13 + ((seed >> 3) % 8);
  const shift = seed % 8;
  return (
    <svg
      className="lkdv-cv2x-place-art"
      viewBox="0 0 100 74"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="lkdv-cv2x-place-sky" width="100" height="74" />
      <circle className="lkdv-cv2x-place-sun" cx={sunX} cy={sunY} r={6} />
      <path
        className="lkdv-cv2x-place-back"
        d={`M0 ${48 - shift} L20 30 L36 42 L54 24 L76 44 L100 ${31 - shift} V74 H0 Z`}
      />
      <path
        className="lkdv-cv2x-place-front"
        d={`M0 ${64 - shift} L16 ${49 - shift} L34 ${59 - shift} L52 ${41 - shift} L70 ${57 - shift} L86 ${47 - shift} L100 ${55 - shift} V74 H0 Z`}
      />
    </svg>
  );
}

/**
 * Accueil de la recherche (Recherche#4) : recherches récentes supprimables,
 * tendances de la semaine (RPC) et lieux populaires illustrés.
 *
 * Fidélité / données : la maquette écrit « n recherches » et « n sorties ».
 * `community_search_trending` ne renvoie pas des recherches mais le nombre
 * d'objets publics (carnets + sorties) créés sur 7 jours portant le lieu ou le
 * tag. On affiche donc l'équivalent honnête « n publications » plutôt qu'un
 * faux compteur de recherches.
 */
export function SearchHome({
  recents,
  onPickRecent,
  onDeleteRecent,
}: SearchHomeProps) {
  if (recents.length === 0) {
    return (
      <div className="lkdv-cv2x-search-home">
        <p className="lkdv-cv2-field-hint" style={{ margin: 0 }}>
          Tes recherches récentes apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <div className="lkdv-cv2x-search-home">
      <div className="lkdv-cv2-group">
        <div className="lkdv-cv2-group-head">
          <span className="lkdv-cv2-eyebrow">Recherches récentes</span>
        </div>
        <div className="lkdv-cv2x-hrail lkdv-cv2x-recents-rail" data-hscroll="">
          {recents.map((recent) => (
            <span key={recent} className="lkdv-cv2x-chip-del">
              <button
                type="button"
                className="lkdv-cv2-chip"
                onClick={() => onPickRecent(recent)}
                aria-label={`Relancer la recherche ${recent}`}
              >
                <ExploreIcon name="clock" size={13} />
                {recent}
              </button>
              <button
                type="button"
                className="lkdv-cv2x-chip-x"
                onClick={() => onDeleteRecent(recent)}
                aria-label={`Supprimer la recherche « ${recent} »`}
              >
                <ExploreIcon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SearchHome;
