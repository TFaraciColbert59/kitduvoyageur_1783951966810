'use client';

/**
 * Lot A02 — recherche dans l'historique unifié (S2.16).
 *
 * La requête libre est comprise par le contrat (`parseActivitySearchQuery`) :
 * sport, date, lieu, tag et provenance deviennent des pastilles corrigeables.
 * Retirer une pastille réécrit la requête sans perdre les autres critères.
 */

import React, { useMemo } from 'react';
import { Clock3, Search, Trash2, X } from 'lucide-react';
import {
  buildSearchCriterionChips,
  parseActivitySearchQuery,
  removeSearchCriterion,
  type ActivityProvenanceOrigin,
  type LifecycleActivityRecord,
  type ParsedSearchCriteria,
  type SearchCriterionChip,
} from '@/features/compte/lifecycle';
import type { LifecycleListResponse } from './api';
import { formatDateShort, formatDistanceKm, formatElevation, sportLabel } from './format';
import { Chip, Notice } from './primitives';

const PROVENANCE_TOKENS: Readonly<Record<ActivityProvenanceOrigin, string>> = {
  hike_session: 'historique',
  activity_session: 'explorer',
  device_import: 'appareil',
  gpx_import: 'gpx',
  manual: 'manuelle',
};

/** Réécrit une requête compréhensible à partir de critères corrigés. */
export function criteriaToQuery(criteria: ParsedSearchCriteria): string {
  const tokens: string[] = [...criteria.sports];
  for (const tag of criteria.tags) {
    if (!(tag === 'course' && criteria.sports.includes('course'))) tokens.push(tag);
  }
  if (criteria.dateRange.fromIso || criteria.dateRange.toIso) {
    tokens.push(criteria.dateRange.label ?? '');
  }
  for (const origin of criteria.provenanceOrigins) {
    tokens.push(PROVENANCE_TOKENS[origin]);
  }
  tokens.push(...criteria.placeTerms, ...criteria.textTerms);
  const seen = new Set<string>();
  return tokens
    .filter((token) => {
      const trimmed = token.trim();
      if (!trimmed || seen.has(trimmed)) return false;
      seen.add(trimmed);
      return true;
    })
    .join(' ');
}

export function removeCriterionFromQuery(
  query: string,
  chip: Pick<SearchCriterionChip, 'kind' | 'value'>
): string {
  const criteria = parseActivitySearchQuery(query);
  return criteriaToQuery(removeSearchCriterion(criteria, chip));
}

export interface RechercheHistoriqueProps {
  query: string;
  onQueryChange: (query: string) => void;
  result: LifecycleListResponse | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSelect: (record: LifecycleActivityRecord) => void;
  onOpenTrash?: () => void;
  trashCount?: number;
}

export function RechercheHistorique({
  query,
  onQueryChange,
  result,
  loading = false,
  error = null,
  onRetry,
  onSelect,
  onOpenTrash,
  trashCount = 0,
}: RechercheHistoriqueProps) {
  const chips = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return buildSearchCriterionChips(parseActivitySearchQuery(trimmed));
  }, [query]);

  const items = result?.items ?? [];
  const total = result?.totalMatched ?? 0;

  return (
    <div data-testid="recherche-historique">
      <div className="lkv-life__toolbar">
        <div className="lkv-life__search">
          <Search size={17} aria-hidden="true" />
          <label className="lkv-life__sr" htmlFor="life-search">
            Rechercher dans l’historique
          </label>
          <input
            id="life-search"
            type="search"
            value={query}
            placeholder="Sport, lieu, date, tag…"
            autoComplete="off"
            onChange={(event) => onQueryChange(event.target.value)}
          />
          {query.length > 0 ? (
            <button
              type="button"
              className="lkv-life__search-clear"
              aria-label="Effacer la recherche"
              onClick={() => onQueryChange('')}
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {onOpenTrash ? (
          <button type="button" className="lkv-life__btn" onClick={onOpenTrash}>
            <Trash2 size={15} aria-hidden="true" />
            Corbeille
            {trashCount > 0 ? <span className="lkv-life__badge">{trashCount}</span> : null}
          </button>
        ) : null}
      </div>

      {chips.length > 0 ? (
        <div className="lkv-life__chips" aria-label="Critères compris">
          {chips.map((chip) => (
            <Chip
              key={`${chip.kind}-${chip.value}`}
              tone="accent"
              onClick={() => onQueryChange(removeCriterionFromQuery(query, chip))}
              ariaLabel={`Retirer le critère ${chip.label}`}
            >
              {chip.label}
              <X size={12} aria-hidden="true" />
            </Chip>
          ))}
        </div>
      ) : null}

      <p className="lkv-life__hint" role="status" aria-live="polite">
        {loading
          ? 'Recherche en cours…'
          : error
            ? 'Recherche indisponible.'
            : total > 0
              ? total === 1
                ? `1 séance${query.trim() ? ' trouvée' : ''}`
                : `${total} séances${query.trim() ? ' trouvées' : ''}`
              : 'Aucune séance.'}
      </p>

      {error ? (
        <Notice tone="error">
          {error}
          {onRetry ? (
            <>
              {' '}
              <button
                type="button"
                className="lkv-life__btn"
                data-variant="ghost"
                onClick={onRetry}
              >
                Réessayer
              </button>
            </>
          ) : null}
        </Notice>
      ) : null}

      {!error && items.length === 0 ? (
        <div className="lkv-life__empty">
          <strong>{query.trim() ? 'Aucun résultat' : 'Aucune séance'}</strong>
          <p>
            {query.trim()
              ? 'Essaie un autre sport, un lieu ou une date. Les critères compris sont affichés au-dessus.'
              : 'Tes séances Explorer et tes randonnées historiques apparaîtront ici.'}
          </p>
        </div>
      ) : (
        <ul className="lkv-life__list" style={{ marginTop: 12 }}>
          {items.map((record) => {
            const pending = record.quickEditState.visible;
            return (
              <li key={record.id}>
                <button
                  type="button"
                  className="lkv-life__row"
                  onClick={() => onSelect(record)}
                  data-testid={`life-row-${record.id}`}
                >
                  <span className="lkv-life__row-main">
                    <span className="lkv-life__row-title">{record.title}</span>
                    <span className="lkv-life__row-meta">
                      {sportLabel(record.sport)} · {formatDateShort(record.startedAt)} ·{' '}
                      {formatDistanceKm(record.stats.distanceKm)} ·{' '}
                      {formatElevation(record.stats.elevationGainM)} D+
                    </span>
                    <span className="lkv-life__row-meta">
                      {record.provenance.label}
                      {record.placeLabel ? ` · ${record.placeLabel}` : ''}
                    </span>
                  </span>
                  <span className="lkv-life__row-side">
                    <span className="lkv-life__row-km">
                      {formatDistanceKm(record.stats.distanceKm)}
                    </span>
                    {record.lifecycleStatus === 'deleted' ? (
                      <span className="lkv-life__badge" data-tone="danger">
                        Corbeille
                      </span>
                    ) : null}
                    {pending ? (
                      <span className="lkv-life__badge" data-tone="warning">
                        <Clock3 size={11} aria-hidden="true" /> À vérifier
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
