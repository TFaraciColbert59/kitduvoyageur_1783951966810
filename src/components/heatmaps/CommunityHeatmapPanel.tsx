'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { CommunityTimeWindow, PublicHeatmapLayer, Sport } from '@/features/heatmaps/types';
import { ErrorState, Spinner, Tabs } from '@/components/ui';
import {
  HeatmapClientError,
  fetchCommunityHeatmap,
} from './apiClient';
import {
  COMMUNITY_WINDOW_OPTIONS,
  SPORT_OPTIONS,
  communityWindowLabel,
  formatNumber,
  sportLabel,
  summarizeCommunity,
} from './heatmapViewModel';
import HeatmapGridMap from './HeatmapGridMap';
import {
  HeatmapCard,
  HeatmapPrivacyNote,
  HeatmapSectionTitle,
  HeatmapStat,
  HeatmapRetry,
} from './HeatmapParts';

export interface CommunityHeatmapPanelProps {
  /** Injectable pour les tests ; par défaut le client HTTP réel. */
  loadLayer?: typeof fetchCommunityHeatmap;
}

export default function CommunityHeatmapPanel({ loadLayer = fetchCommunityHeatmap }: CommunityHeatmapPanelProps) {
  const [sport, setSport] = useState<Sport | 'all'>('all');
  const [timeWindow, setTimeWindow] = useState<CommunityTimeWindow>('global');
  const [layer, setLayer] = useState<PublicHeatmapLayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setErrorCode(null);

    loadLayer({ sport, window: timeWindow }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setLayer(response.layer);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setLayer(null);
        setErrorCode(cause instanceof HeatmapClientError ? cause.code : 'network_error');
        setError(
          cause instanceof Error
            ? cause.message
            : 'Impossible de charger la heatmap communautaire.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [sport, timeWindow, reloadKey, loadLayer]);

  const summary = useMemo(() => summarizeCommunity(layer), [layer]);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  return (
    <div className="space-y-3" aria-busy={loading}>
      <HeatmapCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
              Heatmap communautaire
            </h2>
            <p className="mt-1 max-w-xl text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
              Les passages réellement enregistrés, agrégés par cellule. Aucun nom, aucune trace
              individuelle : seules les cellules portées par au moins 5 personnes sont publiées.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--glass-border-color)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--lkv-text-secondary)]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--lkv-forest-600)]" />
            K ≥ 5
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
              ariaLabel="Filtrer la heatmap communautaire par sport"
            />
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--lkv-text-secondary)]">
              Fenêtre
            </p>
            <Tabs
              options={COMMUNITY_WINDOW_OPTIONS.map((option) => ({
                id: option.id,
                label: option.label,
              }))}
              value={timeWindow}
              onChange={(id) => setTimeWindow(id as CommunityTimeWindow)}
              ariaLabel="Filtrer la heatmap communautaire par période"
            />
            <p className="mt-1.5 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
              {COMMUNITY_WINDOW_OPTIONS.find((option) => option.id === timeWindow)?.description}
            </p>
          </div>
        </div>
      </HeatmapCard>

      {loading && (
        <div className="flex min-h-[220px] items-center justify-center">
          <Spinner />
          <span className="sr-only">Chargement de la heatmap communautaire</span>
        </div>
      )}

      {!loading && error && (
        <HeatmapCard>
          <ErrorState
            title={
              errorCode === 'consent_unavailable'
                ? 'Consentements indisponibles'
                : 'Heatmap indisponible'
            }
            message={
              errorCode === 'consent_unavailable'
                ? "La table de consentement n'est pas encore disponible. Par sécurité, aucune contribution n'est publiée."
                : error
            }
            onRetry={retry}
          />
        </HeatmapCard>
      )}

      {!loading && !error && layer && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <HeatmapStat
              label="Cellules"
              value={formatNumber(summary.cellCount)}
              hint={`${sportLabel(sport)} · ${communityWindowLabel(timeWindow)}`}
            />
            <HeatmapStat
              label="Passages"
              value={formatNumber(summary.maxPassages)}
              hint="Pic dans une cellule"
            />
            <HeatmapStat
              label="Contributeurs"
              value={formatNumber(summary.maxContributors)}
              hint="Pic distinct par cellule"
            />
            <HeatmapStat
              label="Protégées"
              value={formatNumber(summary.suppressedCellCount)}
              hint="Cellules sous le seuil"
            />
          </dl>

          <HeatmapGridMap
            cells={layer.cells}
            kind="community"
            label={`Heatmap communautaire ${sportLabel(sport)}, ${communityWindowLabel(timeWindow)}, ${summary.cellCount} cellules publiables`}
          />

          {summary.topCells.length > 0 && (
            <HeatmapCard>
              <HeatmapSectionTitle hint="Top 5 par passages">Zones les plus parcourues</HeatmapSectionTitle>
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
                      {cell.distinctContributorCount} pers. · {cell.passageCount} pass.
                    </span>
                  </li>
                ))}
              </ol>
            </HeatmapCard>
          )}

          {summary.cellCount === 0 && (
            <HeatmapCard>
              <p className="text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-primary)]">
                Aucune cellule ne franchit encore le seuil de 5 contributeurs sur ce filtre.
                Élargissez la fenêtre ou changez de sport.
              </p>
              <HeatmapRetry onRetry={retry} />
            </HeatmapCard>
          )}

          <HeatmapPrivacyNote>
            {formatNumber(layer.excludedActivityCount)} sorties exclues (visibilité, consentement
            ou fenêtre) · {formatNumber(layer.maskedPointCount)} points masqués par les zones
            privées · {formatNumber(summary.suppressedCellCount)} cellules retirées sous le seuil.
            Les totaux sont recalculés à chaque requête : une révocation s&apos;applique
            immédiatement.
          </HeatmapPrivacyNote>
        </>
      )}
    </div>
  );
}
