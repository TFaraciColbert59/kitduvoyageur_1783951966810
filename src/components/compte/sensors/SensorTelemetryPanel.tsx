'use client';

import React from 'react';
import { Activity, Gauge } from 'lucide-react';
import type {
  QualifiedTelemetrySnapshot,
  QualifiedTelemetrySummary,
  TelemetryQualification,
} from '@/features/sensors';
import SensorStatusBadge, { type SensorStatusTone } from './SensorStatusBadge';
import {
  SENSOR_METRICS,
  formatMeasurementAge,
  formatMetricValue,
  hasAnyMeasuredMetric,
  qualificationLabel,
} from './sensorFormat';

function qualificationTone(qualification: TelemetryQualification): SensorStatusTone {
  switch (qualification) {
    case 'measured':
      return 'success';
    case 'stale':
      return 'warning';
    case 'unavailable':
      return 'neutral';
  }
}

export interface SensorTelemetryPanelProps {
  snapshot: QualifiedTelemetrySnapshot;
  nowMs: number;
  summary?: QualifiedTelemetrySummary;
}

/**
 * Télémétrie qualifiée : une valeur n'apparaît que si une trame réelle l'a
 * portée. Une valeur périmée est affichée avec sa qualification, jamais
 * rafraîchie artificiellement.
 */
export function SensorTelemetryPanel({
  snapshot,
  nowMs,
  summary,
}: SensorTelemetryPanelProps) {
  const measured = hasAnyMeasuredMetric(snapshot);

  return (
    <section className="lkdv-sensor-panel lkv-glass" aria-labelledby="lkdv-sensor-telemetry-title">
      <header className="lkdv-sensor-panel-head">
        <span className="lkdv-sensor-panel-ico" aria-hidden="true">
          <Activity size={17} />
        </span>
        <div>
          <h2 id="lkdv-sensor-telemetry-title">Télémétrie</h2>
          <p>
            {measured
              ? 'Mesures reçues des capteurs connectés.'
              : 'Aucune mesure reçue. Rien n’est simulé en attendant un capteur.'}
          </p>
        </div>
      </header>

      <div className="lkdv-sensor-metric-grid" role="list" aria-label="Métriques qualifiées">
        {SENSOR_METRICS.map((metric) => {
          const value = snapshot[metric.key];
          return (
            <div
              className="lkdv-sensor-metric"
              role="listitem"
              key={metric.key}
              data-qualification={value.qualification}
            >
              <span className="lkdv-sensor-metric-label">{metric.shortLabel}</span>
              <strong className="lkdv-sensor-metric-value">
                {formatMetricValue(metric.key, value.value)}
              </strong>
              <span className="lkdv-sensor-metric-foot">
                <SensorStatusBadge
                  label={qualificationLabel(value.qualification)}
                  tone={qualificationTone(value.qualification)}
                />
                <span>{formatMeasurementAge(value.updatedAtMs, nowMs)}</span>
              </span>
            </div>
          );
        })}
      </div>

      {summary && summary.sampleCount > 0 ? (
        <dl className="lkdv-sensor-summary" aria-label="Résumé des mesures réelles">
          <div>
            <dt>
              <Gauge size={13} aria-hidden="true" /> Échantillons
            </dt>
            <dd>{summary.sampleCount}</dd>
          </div>
          {summary.avgHeartRateBpm !== null ? (
            <div>
              <dt>FC moyenne</dt>
              <dd>{formatMetricValue('heartRateBpm', summary.avgHeartRateBpm)}</dd>
            </div>
          ) : null}
          {summary.maxHeartRateBpm !== null ? (
            <div>
              <dt>FC max</dt>
              <dd>{formatMetricValue('heartRateBpm', summary.maxHeartRateBpm)}</dd>
            </div>
          ) : null}
          {summary.avgPowerWatts !== null ? (
            <div>
              <dt>Puissance moy.</dt>
              <dd>{formatMetricValue('cyclingPowerWatts', summary.avgPowerWatts)}</dd>
            </div>
          ) : null}
          {summary.avgCadenceRpm !== null ? (
            <div>
              <dt>Cadence moy.</dt>
              <dd>{formatMetricValue('cyclingCadenceRpm', summary.avgCadenceRpm)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <p className="lkdv-sensor-panel-note">
        « Périmé » signifie qu’une mesure réelle n’a pas été rafraîchie depuis plus de 5 s.
      </p>
    </section>
  );
}

export default SensorTelemetryPanel;
