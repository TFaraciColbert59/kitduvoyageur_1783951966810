'use client';

import React from 'react';
import type {
  OutingImportSample,
  OutingImportSummary,
} from '@/features/compte/server/sorties';
import { formatNumber } from './shared';

/**
 * Restitution propriétaire des métriques d'un import FIT/TCX.
 *
 * Les valeurs sont recopiées du fichier par le serveur. Ce composant ne calcule
 * aucune mesure : il convertit seulement des unités d'affichage (m/s → km/h,
 * m → km) et dessine une sparkline à partir des points réellement présents.
 * Une valeur absente (`null`) n'est jamais remplacée par zéro ; un zéro réel
 * reste affiché comme zéro.
 */

type SeriesKey =
  | 'heartRateBpm'
  | 'cadenceRpm'
  | 'cadenceSpm'
  | 'powerW'
  | 'temperatureC'
  | 'speedMps'
  | 'altitudeM'
  | 'distanceM';

interface SeriesDefinition {
  key: SeriesKey;
  label: string;
  unit: string;
  display: (value: number) => string;
}

const SERIES_DEFINITIONS: readonly SeriesDefinition[] = [
  {
    key: 'heartRateBpm',
    label: 'Fréquence cardiaque',
    unit: 'bpm',
    display: (value) => `${formatNumber(value)} bpm`,
  },
  {
    key: 'cadenceRpm',
    label: 'Cadence vélo',
    unit: 'tr/min',
    display: (value) => `${formatNumber(value)} tr/min`,
  },
  {
    key: 'cadenceSpm',
    label: 'Cadence course',
    unit: 'pas/min',
    display: (value) => `${formatNumber(value)} pas/min`,
  },
  {
    key: 'powerW',
    label: 'Puissance',
    unit: 'W',
    display: (value) => `${formatNumber(value)} W`,
  },
  {
    key: 'temperatureC',
    label: 'Température',
    unit: '°C',
    display: (value) => `${formatNumber(value)} °C`,
  },
  {
    key: 'speedMps',
    label: 'Vitesse',
    unit: 'km/h',
    display: (value) => `${formatNumber(value * 3.6)} km/h`,
  },
  {
    key: 'altitudeM',
    label: 'Altitude',
    unit: 'm',
    display: (value) => `${formatNumber(value)} m`,
  },
  {
    key: 'distanceM',
    label: 'Distance source',
    unit: 'km',
    display: (value) => `${formatNumber(value / 1000)} km`,
  },
];

function numericValue(sample: OutingImportSample, key: SeriesKey): number | null {
  const value = sample[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatSeconds(value: number): string {
  const total = Math.max(0, Math.round(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')}`;
  if (minutes > 0) return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
  return `${seconds} s`;
}

function summaryRows(summary: OutingImportSummary): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];

  if (summary.caloriesKcal !== null) {
    rows.push({ label: 'Calories', value: `${formatNumber(summary.caloriesKcal)} kcal` });
  }
  if (summary.averageHeartRateBpm !== null) {
    rows.push({
      label: 'FC moyenne',
      value: `${formatNumber(summary.averageHeartRateBpm)} bpm`,
    });
  }
  if (summary.maxHeartRateBpm !== null) {
    rows.push({
      label: 'FC maximale',
      value: `${formatNumber(summary.maxHeartRateBpm)} bpm`,
    });
  }
  if (summary.averageCadenceRpm !== null) {
    rows.push({
      label: 'Cadence moyenne',
      value: `${formatNumber(summary.averageCadenceRpm)} tr/min`,
    });
  } else if (summary.averageCadenceSpm !== null) {
    rows.push({
      label: 'Cadence moyenne',
      value: `${formatNumber(summary.averageCadenceSpm)} pas/min`,
    });
  }
  if (summary.averagePowerW !== null) {
    rows.push({
      label: 'Puissance moyenne',
      value: `${formatNumber(summary.averagePowerW)} W`,
    });
  }
  if (summary.maxPowerW !== null) {
    rows.push({
      label: 'Puissance maximale',
      value: `${formatNumber(summary.maxPowerW)} W`,
    });
  }
  if (summary.averageSpeedMps !== null) {
    rows.push({
      label: 'Vitesse moyenne',
      value: `${formatNumber(summary.averageSpeedMps * 3.6)} km/h`,
    });
  }
  if (summary.maxSpeedMps !== null) {
    rows.push({
      label: 'Vitesse maximale',
      value: `${formatNumber(summary.maxSpeedMps * 3.6)} km/h`,
    });
  }
  if (summary.activityTimerSeconds !== null) {
    rows.push({
      label: 'Temps minuteur',
      value: formatSeconds(summary.activityTimerSeconds),
    });
  }

  return rows;
}

function downsample<T>(items: T[], max = 240): T[] {
  if (items.length <= max) return items;
  const step = (items.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, index) => items[Math.round(index * step)]);
}

function SeriesSparkline({
  definition,
  samples,
}: {
  definition: SeriesDefinition;
  samples: OutingImportSample[];
}) {
  const points = samples
    .map((sample) => ({ index: sample.index, value: numericValue(sample, definition.key) }))
    .filter((point): point is { index: number; value: number } => point.value !== null);
  if (points.length === 0) return null;

  const visible = downsample(points);
  const values = visible.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const total = Math.max(samples.length - 1, 1);
  const path = visible
    .map((point, offset) => {
      const x = (point.index / total) * 100;
      const y = span === 0 ? 12 : 22 - ((point.value - min) / span) * 20;
      return `${offset === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <li data-series={definition.key}>
      <div className="lkdv-sortie-series-head">
        <b>{definition.label}</b>
        <span>
          {points.length} mesure{points.length > 1 ? 's' : ''} · {definition.unit}
        </span>
      </div>
      <svg
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        className="lkdv-sortie-series-line"
        role="img"
        aria-label={`Série ${definition.label}, ${points.length} mesure${points.length > 1 ? 's' : ''} source`}
      >
        <title>
          {definition.label} : {points.length} mesure{points.length > 1 ? 's' : ''} issue
          {points.length > 1 ? 's' : ''} du fichier
        </title>
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
      <small>
        {definition.display(points[0].value)} au premier point ·{' '}
        {definition.display(points[points.length - 1].value)} au dernier point
      </small>
    </li>
  );
}

export interface OutingMetricsProps {
  summary: OutingImportSummary | null | undefined;
  samples: OutingImportSample[] | null | undefined;
}

export function OutingMetrics({ summary, samples }: OutingMetricsProps) {
  const rows = summary ? summaryRows(summary) : [];
  const series = samples
    ? SERIES_DEFINITIONS.filter((definition) =>
        samples.some((sample) => numericValue(sample, definition.key) !== null)
      )
    : [];

  if (rows.length === 0 && series.length === 0) {
    return (
      <section className="lkdv-sortie-section" data-testid="outing-metrics-empty">
        <header>
          <b>Métriques de la montre</b>
          <span>Aucune valeur conservée</span>
        </header>
        <p className="lkdv-sortie-proof">
          {samples == null
            ? 'La persistance des métriques n’est pas disponible ou la lecture a échoué. La sortie reste lisible ; aucune mesure n’est inventée.'
            : 'Aucun résumé ni série de mesures n’est conservé pour cet import. Les imports antérieurs ne peuvent pas être complétés rétroactivement.'}
        </p>
      </section>
    );
  }

  return (
    <section className="lkdv-sortie-section" data-testid="outing-metrics">
      <header>
        <b>Métriques de la montre</b>
        <span>Visible par vous seul</span>
      </header>

      {rows.length > 0 ? (
        <div className="lkdv-sortie-grid">
          {rows.map((row) => (
            <div key={row.label}>
              <small>{row.label}</small>
              <b>{row.value}</b>
            </div>
          ))}
        </div>
      ) : null}

      {series.length > 0 ? (
        <ul className="lkdv-sortie-series">
          {series.map((definition) => (
            <SeriesSparkline
              key={definition.key}
              definition={definition}
              samples={samples ?? []}
            />
          ))}
        </ul>
      ) : (
        <p className="lkdv-sortie-proof">
          {samples == null
            ? 'Séries de mesures indisponibles : le registre n’est pas déployé ou la lecture a échoué.'
            : 'Aucune série de mesures de point n’est conservée pour cet import.'}
        </p>
      )}

      <p className="lkdv-sortie-proof">
        Valeurs recopiées du fichier FIT/TCX, sans interpolation ni valeur inventée. Une
        mesure absente reste absente ; un zéro réel reste un zéro. Les coordonnées ne sont
        pas dupliquées dans ces séries.
      </p>
    </section>
  );
}

export default OutingMetrics;
