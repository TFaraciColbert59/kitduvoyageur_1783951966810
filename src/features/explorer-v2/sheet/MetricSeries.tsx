'use client';

import { XpEmpty, XpEyebrow, XpRow, XpRows } from './blocks';
import type { MetricSeries, Sport } from '../state/types';
import {
  METRIC_DEFINITIONS,
  formatMetricValue,
  groupUnavailableMetrics,
  hasMetricValues,
  metricQualityLabel,
  summarizeMetricSeries,
  unavailableMetricEntries,
  unavailableMetricsForSport,
  type MetricUnits,
} from '../activity/metrics';

function Sparkline({ samples }: { samples: MetricSeries['samples'] }) {
  if (samples.length < 2) return null;
  const width = 54;
  const height = 20;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const sample of samples) {
    if (sample.value < min) min = sample.value;
    if (sample.value > max) max = sample.value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  const span = max - min;
  const points = samples
    .map((sample, index) => {
      const x = samples.length <= 1 ? 0 : (index / (samples.length - 1)) * width;
      const ratio = span === 0 ? 0.5 : (sample.value - min) / span;
      const y = height - ratio * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ flex: 'none', color: 'var(--xp-good)', opacity: 0.85 }}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricSeriesRow({ series, units }: { series: MetricSeries; units: MetricUnits }) {
  const summary = summarizeMetricSeries(series);
  if (!summary) return null;
  const isCounter = series.key === 'calories' || series.key === 'steps';
  const average = formatMetricValue(series.key, summary.average, units);
  const current = formatMetricValue(series.key, summary.last, units);
  const peakValue = formatMetricValue(
    series.key,
    series.key === 'pace' ? summary.min : summary.max,
    units,
  );
  const peakLabel = series.key === 'pace' ? 'meilleure' : 'pic';
  const countLabel = `${summary.count} mesure${summary.count > 1 ? 's' : ''}`;
  const quality = metricQualityLabel(series.quality, series.source);
  return (
    <XpRow
      icon={METRIC_DEFINITIONS[series.key].icon}
      title={
        isCounter
          ? `${series.label} · ${current}`
          : `${series.label} · moy. ${average}`
      }
      sub={
        isCounter
          ? summary.count > 1
            ? `total fourni par la source · ${countLabel} · ${quality}`
            : `total fourni par la source · ${quality}`
          : summary.count > 1
            ? `${peakLabel} ${peakValue} · ${countLabel} · ${quality}`
            : `${countLabel} · ${quality}`
      }
      trailing={<Sparkline samples={series.samples} />}
    />
  );
}

/**
 * Vue « mesures » partagée par le détail d'une séance et son bilan.
 *
 * Elle n'affiche que les séries qui contiennent au moins une valeur reçue.
 * Les métriques pertinentes pour le sport mais non branchées sont regroupées
 * en absences explicites : aucun zéro, aucune estimation implicite.
 */
export function MetricSeriesPanel({
  series,
  units,
  sport,
  showUnavailable = true,
  emptyTitle = 'Aucune mesure disponible',
  emptyHint = 'Aucun point GPS ou capteur n’a fourni de valeur pour cette séance.',
}: {
  series: MetricSeries[];
  units: MetricUnits;
  sport: Sport;
  showUnavailable?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const available = series.filter(hasMetricValues);
  const availableKeys = new Set(available.map((item) => item.key));
  const unavailable = showUnavailable
    ? groupUnavailableMetrics(
        unavailableMetricEntries(
          unavailableMetricsForSport(sport).filter((key) => !availableKeys.has(key)),
        ),
      )
    : [];

  return (
    <>
      {available.length > 0 ? (
        <>
          <XpEyebrow>Mesures disponibles</XpEyebrow>
          <XpRows>
            {available.map((item) => (
              <MetricSeriesRow key={item.key} series={item} units={units} />
            ))}
          </XpRows>
          <p
            style={{
              margin: '10px 2px 0',
              fontSize: 11.5,
              lineHeight: 1.45,
              color: 'var(--xp-mut)',
            }}
          >
            Ces séries ne contiennent que les valeurs réellement reçues. Une lacune n’est ni
            interpolée ni remplacée par zéro.
          </p>
        </>
      ) : (
        <XpEmpty title={emptyTitle} hint={emptyHint} />
      )}

      {unavailable.length > 0 ? (
        <>
          <XpEyebrow>Non disponible</XpEyebrow>
          <XpRows>
            {unavailable.map((group) => (
              <XpRow
                key={group.id}
                icon={group.id === 'energy' ? 'spark' : 'heart'}
                tone="muted"
                title={group.title}
                sub={group.entries.map((entry) => entry.label).join(' · ')}
                badge={{ label: 'absent', tone: 'muted' }}
              />
            ))}
          </XpRows>
          <p
            style={{
              margin: '10px 2px 0',
              fontSize: 11.5,
              lineHeight: 1.45,
              color: 'var(--xp-mut)',
            }}
          >
            Aucune valeur n’est affichée pour ces mesures : LKDV ne les déduit ni de la distance,
            ni de la durée, ni du poids.
          </p>
        </>
      ) : null}
    </>
  );
}
