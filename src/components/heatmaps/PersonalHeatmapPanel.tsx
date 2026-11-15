'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  PersonalHeatmapLayer,
  PersonalTimePeriodKind,
  Sport,
} from '@/features/heatmaps/types';
import { ErrorState, Spinner, Switch, Tabs } from '@/components/ui';
import {
  HeatmapClientError,
  fetchPersonalHeatmap,
  isSessionError,
  type PersonalParams,
} from './apiClient';
import {
  PERSONAL_PERIOD_OPTIONS,
  SPORT_OPTIONS,
  formatIsoDate,
  formatNumber,
  personalPeriodLabel,
  sportLabel,
  summarizeComparison,
  summarizePersonal,
} from './heatmapViewModel';
import HeatmapGridMap from './HeatmapGridMap';
import {
  HeatmapCard,
  HeatmapPrivacyNote,
  HeatmapSectionTitle,
  HeatmapSignInPrompt,
  HeatmapStat,
} from './HeatmapParts';

export interface PersonalHeatmapPanelProps {
  loadLayer?: typeof fetchPersonalHeatmap;
}

const COMPARE_PERIODS: readonly PersonalTimePeriodKind[] = [
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'year_to_date',
];

export default function PersonalHeatmapPanel({
  loadLayer = fetchPersonalHeatmap,
}: PersonalHeatmapPanelProps) {
  const [sport, setSport] = useState<Sport | 'all'>('all');
  const [period, setPeriod] = useState<PersonalTimePeriodKind>('all_time');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [comparePeriod, setComparePeriod] = useState<PersonalTimePeriodKind>('last_90_days');
  const [layer, setLayer] = useState<PersonalHeatmapLayer | null>(null);
  const [comparison, setComparison] = useState<
    Awaited<ReturnType<typeof fetchPersonalHeatmap>>['comparison']
  >(null);
  const [loading, setLoading] = useState(true);
  const [needsSession, setNeedsSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setNeedsSession(false);

    const params: PersonalParams = {
      sport,
      period,
      comparePeriod: compareEnabled ? comparePeriod : null,
    };

    loadLayer(params, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setLayer(response.layer);
        setComparison(response.comparison);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setLayer(null);
        setComparison(null);
        if (isSessionError(cause)) {
          setNeedsSession(true);
          return;
        }
        setError(
          cause instanceof HeatmapClientError || cause instanceof Error
            ? cause.message
            : 'Impossible de charger votre heatmap.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [sport, period, compareEnabled, comparePeriod, reloadKey, loadLayer]);

  const summary = useMemo(() => summarizePersonal(layer), [layer]);
  const delta = useMemo(() => summarizeComparison(comparison), [comparison]);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  if (needsSession) {
    return (
      <HeatmapSignInPrompt
        title="Votre heatmap est privée"
        description="Connectez-vous pour retrouver vos zones parcourues, vos sports et votre évolution. Personne d'autre ne peut ouvrir cette couche."
      />
    );
  }

  return (
    <div className="space-y-3" aria-busy={loading}>
      <HeatmapCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
              Ma heatmap
            </h2>
            <p className="mt-1 max-w-xl text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
              Vos sorties, y compris privées, restent visibles de vous seul. Filtrez par sport,
              période, puis comparez deux périodes pour voir ce que vous avez exploré de neuf.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--glass-border-color)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--lkv-text-secondary)]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--lkv-forest-600)]" />
            Privé
          </span>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--lkv-text-secondary)]">
              Sport
            </p>
            <Tabs
              options={SPORT_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
              value={sport}
              onChange={(id) => setSport(id as Sport | 'all')}
              variant="scrollable"
              ariaLabel="Filtrer votre heatmap par sport"
            />
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--lkv-text-secondary)]">
              Période
            </p>
            <Tabs
              options={PERSONAL_PERIOD_OPTIONS.map((option) => ({
                id: option.id,
                label: option.label,
              }))}
              value={period}
              onChange={(id) => setPeriod(id as PersonalTimePeriodKind)}
              ariaLabel="Filtrer votre heatmap par période"
            />
          </div>

          <div className="rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border-color)] px-3 py-2">
            <Switch
              checked={compareEnabled}
              onCheckedChange={setCompareEnabled}
              label="Comparer avec une autre période"
            />
            {compareEnabled && (
              <div className="mt-2">
                <Tabs
                  options={COMPARE_PERIODS.map((id) => ({
                    id,
                    label: personalPeriodLabel(id),
                  }))}
                  value={comparePeriod}
                  onChange={(id) => setComparePeriod(id as PersonalTimePeriodKind)}
                  ariaLabel="Période de comparaison"
                />
                <p className="mt-1.5 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
                  Référence : {personalPeriodLabel(comparePeriod)}. La comparaison mesure les
                  cellules gagnées, revisitées et délaissées.
                </p>
              </div>
            )}
          </div>
        </div>
      </HeatmapCard>

      {loading && (
        <div className="flex min-h-[220px] items-center justify-center">
          <Spinner />
          <span className="sr-only">Chargement de votre heatmap</span>
        </div>
      )}

      {!loading && error && (
        <HeatmapCard>
          <ErrorState title="Heatmap indisponible" message={error} onRetry={retry} />
        </HeatmapCard>
      )}

      {!loading && !error && layer && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <HeatmapStat
              label="Cellules"
              value={formatNumber(summary.cellCount)}
              hint={`${sportLabel(sport)} · ${personalPeriodLabel(period)}`}
            />
            <HeatmapStat
              label="Sorties"
              value={formatNumber(summary.activityCount)}
              hint="Dans la période"
            />
            <HeatmapStat
              label="Sports"
              value={formatNumber(summary.sportCount)}
              hint="Pratiqués ici"
            />
            <HeatmapStat
              label="Dernier passage"
              value={formatIsoDate(summary.lastVisitedAt)}
              hint="Cellule la plus récente"
            />
          </dl>

          <HeatmapGridMap
            cells={layer.cells}
            kind="personal"
            label={`Votre heatmap ${sportLabel(sport)}, ${personalPeriodLabel(period)}, ${summary.cellCount} cellules`}
          />

          {compareEnabled && comparison && (
            <HeatmapCard>
              <HeatmapSectionTitle
                hint={`${personalPeriodLabel(comparePeriod)} → ${personalPeriodLabel(period)}`}
              >
                Comparaison
              </HeatmapSectionTitle>
              <dl className="grid grid-cols-3 gap-2">
                <HeatmapStat label="Nouvelles" value={formatNumber(delta.newlyExplored)} />
                <HeatmapStat label="Revisitées" value={formatNumber(delta.recurring)} />
                <HeatmapStat label="Délaissées" value={formatNumber(delta.unvisited)} />
              </dl>
              <p className="mt-2 text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
                {delta.totalDelta === 0
                  ? 'Fréquentation stable sur les cellules communes.'
                  : `${delta.totalDelta > 0 ? '+' : ''}${delta.totalDelta} passage${Math.abs(delta.totalDelta) > 1 ? 's' : ''} sur les cellules communes.`}
              </p>
            </HeatmapCard>
          )}

          {summary.cellCount === 0 && (
            <HeatmapCard>
              <p className="text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-primary)]">
                Aucune sortie terminée sur ce filtre. Démarrez une activité dans l&apos;Explorer ou
                élargissez la période.
              </p>
            </HeatmapCard>
          )}

          {summary.topCells.length > 0 && (
            <HeatmapCard>
              <HeatmapSectionTitle hint="Top 5 par sorties">Vos zones les plus visitées</HeatmapSectionTitle>
              <ol className="divide-y divide-[color:var(--lkv-border-subtle)]">
                {summary.topCells.map((cell, index) => (
                  <li key={cell.cellId} className="flex items-center gap-3 py-2">
                    <span className="w-5 text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-secondary)]">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)]">
                      {cell.cellCenterLat.toFixed(2)}°, {cell.cellCenterLng.toFixed(2)}°
                    </span>
                    <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
                      {cell.activityCount} sortie{cell.activityCount > 1 ? 's' : ''} ·{' '}
                      {cell.sports.map((value) => sportLabel(value)).join(', ')}
                    </span>
                  </li>
                ))}
              </ol>
            </HeatmapCard>
          )}

          <HeatmapPrivacyNote>
            Cette couche ne quitte jamais votre compte : la route vérifie que l&apos;utilisateur de
            la session est bien le propriétaire. Les sorties privées sont incluses ici uniquement
            parce que c&apos;est votre propre vue.
          </HeatmapPrivacyNote>
        </>
      )}
    </div>
  );
}
