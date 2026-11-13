'use client';

import React, { useId } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Chip,
  CountryFlag,
  EmptyState,
  SearchField,
} from '@/components/ui';
import type {
  ParsedPlanCriteria,
  PlanSearchResult,
  RouteTheme,
  SportKind,
} from '@/features/planning';
import {
  AUDIENCE_LABELS,
  SPORT_LABELS,
  THEME_LABELS,
  countryLabel,
  formatDistanceKm,
  formatDateOnly,
  formatElevationM,
  formatHours,
  planTotals,
} from './format';

const SPORTS: SportKind[] = [
  'hiking',
  'trekking',
  'trail',
  'cycling',
  'gravel',
  'bikepacking',
  'mountaineering',
];

const THEMES: RouteTheme[] = [
  'alpine',
  'coastal',
  'forest',
  'ridge',
  'heritage',
  'lake',
  'desert',
  'glacier',
  'general',
];

const COUNTRIES = ['FR', 'CH', 'IT', 'ES', 'NO', 'JP', 'GB', 'IS', 'AR', 'NP', 'DE', 'AT', 'SI'];

const FIELD_CLASS =
  'h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

export interface MultiDayPlanLibraryProps {
  query: string;
  onQueryChange: (value: string) => void;
  sportFilter: SportKind | null;
  onSportFilterChange: (value: SportKind | null) => void;
  correctedCriteria: Partial<ParsedPlanCriteria>;
  onCorrectedCriteriaChange: (value: Partial<ParsedPlanCriteria>) => void;
  result: PlanSearchResult;
  activePlanId: string | null;
  onSelectPlan: (planId: string) => void;
  onCreatePlan: () => void;
}

function CriteriaBadges({ criteria }: { criteria: ParsedPlanCriteria }) {
  const badges: string[] = [];
  if (criteria.countryCode) badges.push(countryLabel(criteria.countryCode));
  if (criteria.minDays !== null && criteria.maxDays !== null) {
    badges.push(
      criteria.minDays === criteria.maxDays
        ? `${criteria.minDays} jour${criteria.minDays > 1 ? 's' : ''}`
        : `${criteria.minDays} à ${criteria.maxDays} jours`,
    );
  } else if (criteria.minDays !== null) {
    badges.push(`≥ ${criteria.minDays} jours`);
  } else if (criteria.maxDays !== null) {
    badges.push(`≤ ${criteria.maxDays} jours`);
  }
  if (criteria.theme) badges.push(THEME_LABELS[criteria.theme]);
  for (const term of criteria.textTerms) badges.push(`« ${term} »`);

  if (badges.length === 0) {
    return (
      <p className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
        Aucun filtre compris : la liste montre tous les plans visibles.
      </p>
    );
  }

  return (
    <div
      data-testid="planning-criteria"
      className="flex flex-wrap items-center gap-[var(--space-2)]"
    >
      <span className="text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.14em] text-[color:var(--lkv-text-muted)]">
        Compris
      </span>
      {badges.map((badge) => (
        <Badge key={badge} tone="info">
          {badge}
        </Badge>
      ))}
    </div>
  );
}

/**
 * Bibliothèque multi-jours K1.13 : la recherche absorbe pays, durée et thème,
 * affiche les critères compris et permet de les corriger sans panneau de filtres
 * standard. Les plans privés/bloqués ne sont jamais rendus (P01).
 */
export function MultiDayPlanLibrary({
  query,
  onQueryChange,
  sportFilter,
  onSportFilterChange,
  correctedCriteria,
  onCorrectedCriteriaChange,
  result,
  activePlanId,
  onSelectPlan,
  onCreatePlan,
}: MultiDayPlanLibraryProps) {
  const fieldId = useId();

  const update = <K extends keyof ParsedPlanCriteria>(
    key: K,
    value: ParsedPlanCriteria[K] | undefined,
  ) => {
    const next = { ...correctedCriteria };
    if (value === undefined) delete next[key];
    else next[key] = value;
    onCorrectedCriteriaChange(next);
  };

  const resetCorrections = () => onCorrectedCriteriaChange({});

  return (
    <section
      data-testid="planning-library"
      aria-labelledby={`${fieldId}-library-title`}
      className="space-y-[var(--space-4)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
        <div className="min-w-0">
          <h2
            id={`${fieldId}-library-title`}
            className="text-[length:var(--lkv-text-title-sm)] font-bold leading-[var(--leading-snug)] text-[color:var(--lkv-text-primary)]"
          >
            Bibliothèque multi-jours
          </h2>
          <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
            Cherchez par pays, durée ou thème ; corrigez les critères compris avant d’ouvrir un plan.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onCreatePlan}>
          Créer un plan
        </Button>
      </div>

      <SearchField
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onClear={() => onQueryChange('')}
        placeholder="Ex. France 3-5 jours alpin"
        aria-label="Rechercher un plan multi-jours"
      />

      <div
        className="flex gap-[var(--space-2)] overflow-x-auto pb-[var(--space-1)]"
        role="group"
        aria-label="Filtrer par sport"
      >
        <Chip selected={sportFilter === null} onClick={() => onSportFilterChange(null)}>
          Tous les sports
        </Chip>
        {SPORTS.map((sport) => (
          <Chip
            key={sport}
            selected={sportFilter === sport}
            onClick={() => onSportFilterChange(sportFilter === sport ? null : sport)}
          >
            {SPORT_LABELS[sport]}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-[var(--space-2)]">
        <CriteriaBadges criteria={result.understoodCriteria} />
        <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
          {result.items.length} visible{result.items.length > 1 ? 's' : ''}
          {result.excludedPrivateCount > 0
            ? ` · ${result.excludedPrivateCount} exclu${result.excludedPrivateCount > 1 ? 's' : ''} P01`
            : ''}
        </span>
      </div>

      <details className="g2 border border-[color:var(--lkv-border-subtle)] p-[var(--space-3)]">
        <summary className="flex cursor-pointer list-none items-center gap-[var(--space-2)] text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
          <SlidersHorizontal aria-hidden="true" size={16} />
          Affiner les critères compris
        </summary>
        <div className="mt-[var(--space-3)] grid gap-[var(--space-3)] sm:grid-cols-2">
          <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
            <span>Pays</span>
            <select
              className={FIELD_CLASS}
              value={correctedCriteria.countryCode ?? ''}
              onChange={(event) =>
                update('countryCode', event.target.value ? event.target.value : undefined)
              }
            >
              <option value="">Pays compris automatiquement</option>
              {COUNTRIES.map((code) => (
                <option key={code} value={code}>
                  {countryLabel(code)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
            <span>Thème</span>
            <select
              className={FIELD_CLASS}
              value={correctedCriteria.theme ?? ''}
              onChange={(event) =>
                update(
                  'theme',
                  event.target.value ? (event.target.value as RouteTheme) : undefined,
                )
              }
            >
              <option value="">Thème compris automatiquement</option>
              {THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {THEME_LABELS[theme]}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
            <span>Durée minimale (jours)</span>
            <input
              type="number"
              min={1}
              max={60}
              className={FIELD_CLASS}
              value={correctedCriteria.minDays ?? ''}
              onChange={(event) =>
                update(
                  'minDays',
                  event.target.value ? Number.parseInt(event.target.value, 10) : undefined,
                )
              }
            />
          </label>

          <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
            <span>Durée maximale (jours)</span>
            <input
              type="number"
              min={1}
              max={60}
              className={FIELD_CLASS}
              value={correctedCriteria.maxDays ?? ''}
              onChange={(event) =>
                update(
                  'maxDays',
                  event.target.value ? Number.parseInt(event.target.value, 10) : undefined,
                )
              }
            />
          </label>
        </div>
        <div className="mt-[var(--space-3)] flex justify-end">
          <Button variant="ghost" size="sm" onClick={resetCorrections}>
            Réinitialiser les corrections
          </Button>
        </div>
      </details>

      <div role="status" aria-live="polite" className="sr-only">
        {result.items.length} plan{result.items.length > 1 ? 's' : ''} visible
        {result.items.length > 1 ? 's' : ''}.
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          title="Aucun plan ne correspond"
          description={
            result.excludedPrivateCount > 0
              ? `${result.excludedPrivateCount} plan(s) privé(s), révoqué(s) ou bloqué(s) ont été exclus par la politique P01.`
              : 'Modifiez la recherche ou les critères corrigés pour élargir la sélection.'
          }
          actionLabel="Réinitialiser la recherche"
          onAction={() => {
            onQueryChange('');
            onCorrectedCriteriaChange({});
            onSportFilterChange(null);
          }}
        />
      ) : (
        <ul className="space-y-[var(--space-3)]">
          {result.items.map((plan) => {
            const totals = planTotals(plan);
            const selected = plan.id === activePlanId;
            return (
              <li key={plan.id}>
                <Card
                  as="article"
                  variant="interactive"
                  selected={selected}
                  ariaLabelledBy={`${fieldId}-${plan.id}-title`}
                  onClick={() => onSelectPlan(plan.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-[var(--space-3)]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-[var(--space-2)]">
                        <CountryFlag
                          code={plan.countryCode}
                          name={countryLabel(plan.countryCode)}
                          size="sm"
                        />
                        <h3
                          id={`${fieldId}-${plan.id}-title`}
                          className="truncate text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]"
                        >
                          {plan.title}
                        </h3>
                      </div>
                      <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                        {plan.daysCount} jour{plan.daysCount > 1 ? 's' : ''} ·{' '}
                        {SPORT_LABELS[plan.sport]} · {THEME_LABELS[plan.theme]} · {plan.timezone}
                      </p>
                    </div>
                    <Badge tone={plan.audience === 'public' ? 'sage' : 'stone'}>
                      {AUDIENCE_LABELS[plan.audience]}
                    </Badge>
                  </div>

                  <div className="mt-[var(--space-3)] grid grid-cols-2 gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)] sm:grid-cols-4">
                    <span>{formatDistanceKm(totals.distanceKm)}</span>
                    <span>+{formatElevationM(totals.elevationGainM)}</span>
                    <span>{formatHours(totals.estimatedHours)}</span>
                    <span>rév. {plan.revision}</span>
                  </div>

                  <p className="mt-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                    Mis à jour le {formatDateOnly(plan.updatedAtIso, plan.timezone)}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default MultiDayPlanLibrary;
