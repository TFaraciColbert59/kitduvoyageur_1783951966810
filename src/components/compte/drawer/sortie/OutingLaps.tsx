'use client';

import React from 'react';
import type { OutingImportLap } from '@/features/compte/server/sorties';
import {
  TRACE_IMPORT_PREVIEW_LAP_LIMIT,
  lapIntensityLabel,
  lapOriginLabel,
  lapTriggerLabel,
} from '@/features/hiking/import/laps';
import { formatDuration, formatNumber } from './shared';

/** Rendu borné : 10 000 tours peuvent être conservés, 50 sont détaillés ici. */
export const OUTING_LAP_DISPLAY_LIMIT = TRACE_IMPORT_PREVIEW_LAP_LIMIT;

function formatLapStart(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

function speedKmh(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return `${formatNumber(value * 3.6)} km/h`;
}

function lapMetrics(lap: OutingImportLap): string[] {
  const parts: string[] = [];
  if (lap.distanceM !== null) parts.push(`${formatNumber(lap.distanceM / 1000)} km`);
  if (lap.elapsedSeconds !== null) parts.push(formatDuration(lap.elapsedSeconds));

  const averageSpeed = speedKmh(lap.averageSpeedMps);
  if (averageSpeed) parts.push(`moy. ${averageSpeed}`);
  const maxSpeed = speedKmh(lap.maxSpeedMps);
  if (maxSpeed) parts.push(`max ${maxSpeed}`);

  if (lap.averageHeartRateBpm !== null || lap.maxHeartRateBpm !== null) {
    const average =
      lap.averageHeartRateBpm !== null
        ? `${formatNumber(lap.averageHeartRateBpm)} bpm`
        : null;
    const max =
      lap.maxHeartRateBpm !== null
        ? `max ${formatNumber(lap.maxHeartRateBpm)} bpm`
        : null;
    parts.push([average, max].filter(Boolean).join(' / '));
  }

  if (lap.averageCadenceRpm !== null) {
    parts.push(`${formatNumber(lap.averageCadenceRpm)} tr/min`);
  } else if (lap.averageCadenceSpm !== null) {
    parts.push(`${formatNumber(lap.averageCadenceSpm)} pas/min`);
  }

  if (lap.maxPowerW !== null) parts.push(`max ${formatNumber(lap.maxPowerW)} W`);
  if (lap.caloriesKcal !== null) parts.push(`${formatNumber(lap.caloriesKcal)} kcal`);

  return parts;
}

export function OutingLaps({ laps }: { laps: OutingImportLap[] }) {
  const visible = laps.slice(0, OUTING_LAP_DISPLAY_LIMIT);
  const hidden = laps.length - visible.length;
  const hasSynthetic = laps.some((lap) => lap.origin === 'synthetic');

  return (
    <section className="lkdv-sortie-section" data-testid="outing-laps">
      <header>
        <b>Tours du fichier</b>
        <span>
          {laps.length} tour{laps.length > 1 ? 's' : ''} importé
          {laps.length > 1 ? 's' : ''}
        </span>
      </header>

      <ul className="lkdv-sortie-laps">
        {visible.map((lap) => {
          const start = formatLapStart(lap.startedAt);
          const trigger = lapTriggerLabel(lap.triggerMethod);
          const intensity = lapIntensityLabel(lap.intensity);
          const metrics = lapMetrics(lap);
          return (
            <li key={lap.index} data-origin={lap.origin}>
              <div className="lkdv-sortie-lap-head">
                <b>Tour {lap.index + 1}</b>
                <span className={`lkdv-sortie-lap-origin ${lap.origin}`}>
                  {lapOriginLabel(lap.origin)}
                </span>
              </div>
              <span className="lkdv-sortie-lap-metrics">
                {metrics.length > 0
                  ? metrics.join(' · ')
                  : 'Aucune métrique de tour dans le fichier.'}
              </span>
              <small>
                {start ? `Départ ${start} UTC · ` : ''}
                {lap.pointCount} point{lap.pointCount > 1 ? 's' : ''}
                {lap.trackCount > 1 ? ` · ${lap.trackCount} segments` : ''}
                {[trigger, intensity].filter(Boolean).length > 0
                  ? ` · ${[trigger, intensity].filter(Boolean).join(' · ')}`
                  : ''}
              </small>
            </li>
          );
        })}
      </ul>

      {hidden > 0 ? (
        <p className="lkdv-sortie-proof">
          Et {hidden} autre{hidden > 1 ? 's' : ''} tour{hidden > 1 ? 's' : ''}{' '}
          conservé{hidden > 1 ? 's' : ''}, non détaillé{hidden > 1 ? 's' : ''} ici.
        </p>
      ) : null}

      {hasSynthetic ? (
        <p className="lkdv-sortie-proof">
          Un FIT sans message <code>lap</code> produit un tour unique reconstruit depuis les
          données de séance : il n’a pas été déclenché sur la montre.
        </p>
      ) : null}

      <p className="lkdv-sortie-proof">
        Tours fournis par le fichier. Les splits km/mile calculés dans l’Explorer ne sont
        pas stockés ici et ne sont jamais fusionnés avec ces tours.
      </p>
    </section>
  );
}

export default OutingLaps;
