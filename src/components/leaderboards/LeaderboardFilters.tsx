'use client';

import React, { useId } from 'react';
import type {
  LeaderboardFilterCapabilities,
  LeaderboardFilterQuery,
  LeaderboardScope,
  SanitizedLeaderboardFilters,
} from '@/features/leaderboards';
import type { LeaderboardClubOption } from '@/lib/leaderboards/types';
import { GENDER_LABELS, PERIOD_LABELS, SCOPE_LABELS } from '@/lib/leaderboards/format';

export interface LeaderboardFiltersProps {
  filters: SanitizedLeaderboardFilters;
  capabilities: LeaderboardFilterCapabilities;
  clubOptions?: LeaderboardClubOption[];
  isAuthenticated: boolean;
  disabled?: boolean;
  onChange: (filters: LeaderboardFilterQuery) => void;
}

function mergeQuery(
  filters: SanitizedLeaderboardFilters,
  patch: Partial<LeaderboardFilterQuery>
): LeaderboardFilterQuery {
  return {
    period: filters.period,
    scope: filters.scope,
    clubId: filters.clubId,
    gender: filters.gender,
    ...patch,
  };
}

export function LeaderboardFilters({
  filters,
  capabilities,
  clubOptions = [],
  isAuthenticated,
  disabled = false,
  onChange,
}: LeaderboardFiltersProps) {
  const periodId = useId();
  const genderId = useId();
  const clubId = useId();

  const selectScope = (scope: LeaderboardScope) => {
    if (scope === 'friends' && !isAuthenticated) return;
    if (scope === 'club' && (!isAuthenticated || clubOptions.length === 0)) return;
    onChange(
      mergeQuery(filters, {
        scope,
        clubId: scope === 'club' ? (filters.clubId ?? clubOptions[0]?.id ?? null) : null,
      })
    );
  };

  return (
    <section className="lkb-filters" aria-label="Filtres du classement">
      <div className="lkb-filter-row">
        <div className="lkb-field">
          <label className="lkb-label" htmlFor={periodId}>
            Période
          </label>
          <select
            id={periodId}
            className="lkb-select"
            value={filters.period}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                mergeQuery(filters, {
                  period: event.target.value as SanitizedLeaderboardFilters['period'],
                })
              )
            }
          >
            {capabilities.periods.map((period) => (
              <option key={period} value={period}>
                {PERIOD_LABELS[period]}
              </option>
            ))}
          </select>
        </div>

        <div className="lkb-field">
          <label className="lkb-label" htmlFor={genderId}>
            Catégorie
          </label>
          <select
            id={genderId}
            className="lkb-select"
            value={filters.gender}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                mergeQuery(filters, {
                  gender: event.target.value as SanitizedLeaderboardFilters['gender'],
                })
              )
            }
          >
            <option value="all">{GENDER_LABELS.all}</option>
            <option value="men">{GENDER_LABELS.men}</option>
            <option value="women">{GENDER_LABELS.women}</option>
            <option value="non_binary">{GENDER_LABELS.non_binary}</option>
            <option value="unspecified">{GENDER_LABELS.unspecified}</option>
          </select>
        </div>
      </div>

      <div className="lkb-field">
        <span className="lkb-label" id={`${periodId}-scope`}>
          Périmètre
        </span>
        <div className="lkb-segments" role="group" aria-labelledby={`${periodId}-scope`}>
          {capabilities.scopes.map((scope) => {
            const isClubDisabled = scope === 'club' && clubOptions.length === 0;
            const isPrivateScope = scope !== 'global';
            const scopeDisabled =
              disabled || (isPrivateScope && !isAuthenticated) || isClubDisabled;
            return (
              <button
                key={scope}
                type="button"
                className="lkb-segment"
                aria-pressed={filters.scope === scope}
                disabled={scopeDisabled}
                title={
                  isPrivateScope && !isAuthenticated
                    ? 'Connectez-vous pour ce périmètre'
                    : isClubDisabled
                      ? 'Aucun club vérifié'
                      : undefined
                }
                onClick={() => selectScope(scope)}
              >
                {SCOPE_LABELS[scope]}
              </button>
            );
          })}
        </div>
      </div>

      {filters.scope === 'club' && (
        <div className="lkb-field">
          <label className="lkb-label" htmlFor={clubId}>
            Club
          </label>
          <select
            id={clubId}
            className="lkb-select"
            value={filters.clubId ?? clubOptions[0]?.id ?? ''}
            disabled={disabled || clubOptions.length === 0}
            onChange={(event) =>
              onChange(mergeQuery(filters, { scope: 'club', clubId: event.target.value }))
            }
          >
            {clubOptions.length === 0 && <option value="">Aucun club vérifié</option>}
            {clubOptions.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!isAuthenticated && (
        <p className="lkb-hint">
          Les classements entre amis et de club demandent une session. Le classement public reste
          consultable.
        </p>
      )}

      <p className="lkb-hint lkb-hint-muted">
        Les filtres d’âge et de poids ne font pas partie du classement LKDV.
        {filters.strippedUnsupportedFilters.length > 0
          ? ' Les valeurs transmises ont été ignorées.'
          : ''}
      </p>
    </section>
  );
}
