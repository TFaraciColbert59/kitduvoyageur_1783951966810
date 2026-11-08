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

/**
 * Accueil de la recherche (Recherche#4) : recherches récentes supprimables,
 * tendances de la semaine (RPC) et lieux populaires. Jamais de faux chiffres :
 * la fréquence affichée est celle renvoyée par `community_search_trending`.
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
          <div className="lkdv-cv2-list">
            {trending.map((item, index) => (
              <button
                key={`${item.kind}-${item.label}`}
                type="button"
                className="lkdv-cv2-row lkdv-cv2x-trend-row"
                onClick={() => onPickTrend(item.label)}
              >
                <span className="lkdv-cv2x-trend-ico" aria-hidden="true">
                  <ExploreIcon name={item.kind === 'place' ? 'map-pin' : 'sparkles'} size={17} />
                </span>
                <span className="lkdv-cv2x-trend-body">
                  <span className="lkdv-cv2x-trend-label">{item.label}</span>
                  <span className="lkdv-cv2-meta">
                    {formatCountFr(item.hits, 'apparition')} cette semaine
                  </span>
                </span>
                <span className="lkdv-cv2-mono lkdv-cv2x-trend-rank">#{index + 1}</span>
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
          <div className="lkdv-cv2-grid">
            {places.map((place) => (
              <button
                key={place.label}
                type="button"
                className="lkdv-cv2-tile lkdv-cv2x-place"
                onClick={() => onPickTrend(place.label)}
              >
                <span className="lkdv-cv2x-place-ico" aria-hidden="true">
                  <ExploreIcon name="map-pin" size={18} />
                </span>
                <span className="lkdv-cv2-title lkdv-cv2-title--clamp1">{place.label}</span>
                <span className="lkdv-cv2-meta">{formatCountFr(place.hits, 'apparition')} cette semaine</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default SearchHome;
