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
  trending,
  trendingLoading,
  onPickRecent,
  onDeleteRecent,
  onPickTrend,
}: SearchHomeProps) {
  const places = trending.filter((item) => item.kind === 'place').slice(0, 4);

  return (
    <div className="lkdv-cv2x-search-home">
      {recents.length > 0 ? (
        <div className="lkdv-cv2-group">
          <div className="lkdv-cv2-group-head">
            <span className="lkdv-cv2-eyebrow">Recherches récentes</span>
          </div>
          <div className="lkdv-cv2-chips lkdv-cv2x-recents">
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
      ) : null}

      <div className="lkdv-cv2-group">
        <div className="lkdv-cv2-group-head">
          <span className="lkdv-cv2-eyebrow">Tendances de la semaine</span>
        </div>
        {trendingLoading && trending.length === 0 ? (
          <div className="lkdv-cv2-skeleton" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <span key={index} className="lkdv-cv2-skeleton-bar" style={{ height: 42 }} />
            ))}
          </div>
        ) : trending.length === 0 ? (
          <p className="lkdv-cv2-meta">Aucune tendance pour l’instant. Cherche un carnet, un club ou une sortie.</p>
        ) : (
          <div className="lkdv-cv2x-trends">
            {trending.map((item, index) => (
              <button
                key={`${item.kind}-${item.label}`}
                type="button"
                className="lkdv-cv2x-trend-row"
                onClick={() => onPickTrend(item.label)}
              >
                <span className="lkdv-cv2x-trend-ico" aria-hidden="true">
                  <ExploreIcon name="trend" size={18} />
                </span>
                <span className="lkdv-cv2x-trend-body">
                  <span className="lkdv-cv2x-trend-label">{item.label}</span>
                  <span className="lkdv-cv2x-trend-meta">
                    {formatCountFr(item.hits, 'publication')}
                  </span>
                </span>
                <span className="lkdv-cv2x-trend-rank">#{index + 1}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {places.length > 0 ? (
        <div className="lkdv-cv2-group">
          <div className="lkdv-cv2-group-head">
            <span className="lkdv-cv2-eyebrow">Lieux populaires</span>
          </div>
          <div className="lkdv-cv2x-places">
            {places.map((place) => (
              <button
                key={place.label}
                type="button"
                className="lkdv-cv2x-place"
                onClick={() => onPickTrend(place.label)}
              >
                <PlaceArt label={place.label} />
                <span className="lkdv-cv2x-place-label">
                  <b>{place.label}</b>
                  <small>{formatCountFr(place.hits, 'publication')}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default SearchHome;
