'use client';

import React, { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Star } from 'lucide-react';
import {
  hideSegmentForUser,
  searchSegments,
  toggleSegmentStar,
  unhideSegmentForUser,
  type SegmentDefinition,
  type SegmentSport,
  type UserSegmentPreferences,
} from '@/features/segments';
import { SegmentCard } from './SegmentCard';
import { SegmentEmptyState } from './SegmentBadges';
import { SPORTS, SPORT_LABELS } from './format';

export interface SegmentListProps {
  segments: SegmentDefinition[];
  viewerUserId: string;
  preferences: UserSegmentPreferences;
  initialQuery?: string;
  onPreferencesChange?: (preferences: UserSegmentPreferences) => void;
  onSelect?: (segment: SegmentDefinition) => void;
  onCreate?: () => void;
  selectedSegmentId?: string | null;
}

/**
 * S4.03 — liste, recherche intelligente, favoris et masquage personnel.
 * Les mutations de préférences restent locales (optimistes) et sont remontées
 * au parent ; le contrat pur décide de la vérité.
 */
export function SegmentList({
  segments,
  viewerUserId,
  preferences,
  initialQuery = '',
  onPreferencesChange,
  onSelect,
  onCreate,
  selectedSegmentId,
}: SegmentListProps) {
  const [query, setQuery] = useState(initialQuery);
  const [sport, setSport] = useState<SegmentSport | null>(null);
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const effectiveQuery = useMemo(
    () =>
      [query, onlyStarred ? 'favoris' : '', onlyVerified ? 'vérifiés' : '']
        .filter(Boolean)
        .join(' ')
        .trim(),
    [query, onlyStarred, onlyVerified]
  );

  const result = useMemo(
    () =>
      searchSegments(segments, {
        query: effectiveQuery,
        sportFilter: sport,
        viewerUserId,
        preferences,
        includeHidden: showHidden,
        limit: 100,
      }),
    [segments, effectiveQuery, sport, viewerUserId, preferences, showHidden]
  );

  const hiddenCount = preferences.hiddenSegmentIds.length;
  const starredCount = preferences.starredSegmentIds.length;

  function handleStar(segment: SegmentDefinition) {
    onPreferencesChange?.(toggleSegmentStar(preferences, segment.id));
  }

  function handleHide(segment: SegmentDefinition) {
    const isHidden = preferences.hiddenSegmentIds.includes(segment.id);
    onPreferencesChange?.(
      isHidden
        ? unhideSegmentForUser(preferences, segment.id)
        : hideSegmentForUser(preferences, segment.id)
    );
  }

  return (
    <section className="lkdv-seg-list-panel" aria-labelledby="segments-list-title">
      <header className="lkdv-seg-list-header">
        <div>
          <p className="lkdv-seg-eyebrow">S4.03 · Explorer</p>
          <h2 id="segments-list-title">Segments</h2>
        </div>
        {onCreate ? (
          <button type="button" className="lkdv-seg-btn primary" onClick={onCreate}>
            + Créer
          </button>
        ) : null}
      </header>

      <div className="lkdv-seg-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nom, sport, > 5 %, > 2 km…"
          aria-label="Rechercher un segment"
          autoComplete="off"
        />
        <SlidersHorizontal size={16} aria-hidden="true" />
      </div>

      <div className="lkdv-seg-chips" role="group" aria-label="Filtrer par sport">
        <button
          type="button"
          className={`lkdv-seg-chip${sport === null ? ' is-active' : ''}`}
          aria-pressed={sport === null}
          onClick={() => setSport(null)}
        >
          Tous
        </button>
        {SPORTS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={`lkdv-seg-chip${sport === candidate ? ' is-active' : ''}`}
            aria-pressed={sport === candidate}
            onClick={() => setSport(sport === candidate ? null : candidate)}
          >
            {SPORT_LABELS[candidate]}
          </button>
        ))}
      </div>

      <div className="lkdv-seg-filters">
        <button
          type="button"
          className={`lkdv-seg-filter${onlyStarred ? ' is-active' : ''}`}
          aria-pressed={onlyStarred}
          onClick={() => setOnlyStarred((value) => !value)}
        >
          <Star size={14} aria-hidden="true" fill={onlyStarred ? 'currentColor' : 'none'} />
          Favoris{starredCount > 0 ? ` (${starredCount})` : ''}
        </button>
        <button
          type="button"
          className={`lkdv-seg-filter${onlyVerified ? ' is-active' : ''}`}
          aria-pressed={onlyVerified}
          onClick={() => setOnlyVerified((value) => !value)}
        >
          Vérifiés
        </button>
        {hiddenCount > 0 ? (
          <button
            type="button"
            className={`lkdv-seg-filter${showHidden ? ' is-active' : ''}`}
            aria-pressed={showHidden}
            onClick={() => setShowHidden((value) => !value)}
          >
            Masqués ({hiddenCount})
          </button>
        ) : null}
      </div>

      <p className="lkdv-seg-result-count" aria-live="polite">
        {result.totalMatched} segment{result.totalMatched > 1 ? 's' : ''}
        {result.parsedQuery.sport ? ` · ${SPORT_LABELS[result.parsedQuery.sport]}` : ''}
      </p>

      {result.hits.length === 0 ? (
        <SegmentEmptyState
          title="Aucun segment"
          description={
            segments.length === 0
              ? 'Créez un segment depuis une trace GPS pour commencer.'
              : 'Aucun segment ne correspond à cette recherche.'
          }
          action={
            onCreate && segments.length === 0 ? (
              <button type="button" className="lkdv-seg-btn primary" onClick={onCreate}>
                Créer le premier segment
              </button>
            ) : null
          }
        />
      ) : (
        <ul className="lkdv-seg-cards">
          {result.hits.map((hit) => (
            <li key={hit.segment.id}>
              <div
                className={
                  selectedSegmentId === hit.segment.id ? 'lkdv-seg-card-wrap is-selected' : 'lkdv-seg-card-wrap'
                }
              >
                <SegmentCard
                  segment={hit.segment}
                  isStarred={hit.isStarred}
                  isHidden={hit.isHidden}
                  distanceFromCenterM={hit.distanceFromCenterM}
                  onOpen={onSelect}
                  onToggleStar={handleStar}
                  onToggleHidden={handleHide}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default SegmentList;
