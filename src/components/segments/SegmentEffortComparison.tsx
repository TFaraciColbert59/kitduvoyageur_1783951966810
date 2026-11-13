'use client';

import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { EffortComparisonResult } from '@/features/segments';
import { formatClock, formatDelta, formatDistance } from './format';

export interface SegmentEffortComparisonProps {
  result: EffortComparisonResult;
  candidateLabel?: string;
  referenceLabel?: string;
}

/** S4.07 — comparaison point par point de deux passages sur le même segment. */
export function SegmentEffortComparison({
  result,
  candidateLabel = 'Passage comparé',
  referenceLabel = 'Référence',
}: SegmentEffortComparisonProps) {
  const chart = useMemo(() => {
    const width = 640;
    const height = 132;
    const padding = 22;
    const samples = result.samples;
    const maxAbs = Math.max(
      1,
      ...samples.map((sample) => Math.abs(sample.deltaTimeS))
    );
    const mid = height / 2;

    const points = samples.map((sample) => {
      const x = padding + sample.progressFraction * (width - padding * 2);
      const y = mid - (sample.deltaTimeS / maxAbs) * (height / 2 - padding);
      return { x, y, sample };
    });
    return { width, height, mid, padding, points, maxAbs };
  }, [result.samples]);

  const faster = result.candidateFaster;
  const equal = Math.abs(result.totalDeltaTimeS) < 0.01;

  return (
    <section className="lkdv-seg-compare" aria-labelledby="segment-compare-title">
      <header className="lkdv-seg-compare-head">
        <div>
          <p className="lkdv-seg-eyebrow">S4.07 · Comparaison</p>
          <h3 id="segment-compare-title">Point par point</h3>
        </div>
        <div className={`lkdv-seg-delta${faster ? ' is-faster' : equal ? '' : ' is-slower'}`}>
          {faster ? (
            <ArrowUpRight size={18} aria-hidden="true" />
          ) : (
            <ArrowDownRight size={18} aria-hidden="true" />
          )}
          <div>
            <span>{candidateLabel} / {referenceLabel}</span>
            <strong>
              {equal ? 'Temps identique' : `${faster ? '−' : '+'}${formatDelta(result.totalDeltaTimeS)}`}
            </strong>
          </div>
        </div>
      </header>

      <div className="lkdv-seg-compare-summary">
        <div>
          <span>Meilleure avance</span>
          <strong>−{formatDelta(result.maxLeadS)}</strong>
        </div>
        <div>
          <span>Plus grand retard</span>
          <strong>+{formatDelta(result.maxDeficitS)}</strong>
        </div>
        <div>
          <span>Jalons</span>
          <strong>{result.samples.length}</strong>
        </div>
      </div>

      <svg
        className="lkdv-seg-chart"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-label="Écart de temps cumulé le long du segment"
        preserveAspectRatio="none"
      >
        <line
          x1={chart.padding}
          x2={chart.width - chart.padding}
          y1={chart.mid}
          y2={chart.mid}
          className="lkdv-seg-chart-baseline"
        />
        <polyline
          className="lkdv-seg-chart-line"
          points={chart.points.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
        />
        {chart.points.map((point) => (
          <circle
            key={point.sample.stepIndex}
            cx={point.x}
            cy={point.y}
            r={2.6}
            className={
              point.sample.deltaTimeS < 0
                ? 'lkdv-seg-chart-dot is-faster'
                : point.sample.deltaTimeS > 0
                  ? 'lkdv-seg-chart-dot is-slower'
                  : 'lkdv-seg-chart-dot'
            }
          />
        ))}
      </svg>

      <div className="lkdv-seg-table-wrap">
        <table className="lkdv-seg-table">
          <caption className="lkdv-seg-visually-hidden">
            Écart de temps, de vitesse et capteurs à chaque jalon de distance
          </caption>
          <thead>
            <tr>
              <th scope="col">Distance</th>
              <th scope="col">{candidateLabel}</th>
              <th scope="col">{referenceLabel}</th>
              <th scope="col">Écart</th>
              <th scope="col">FC</th>
              <th scope="col">Puissance</th>
            </tr>
          </thead>
          <tbody>
            {result.samples.map((sample) => (
              <tr key={sample.stepIndex}>
                <th scope="row">{formatDistance(sample.distanceAlongSegmentM)}</th>
                <td>{formatClock(sample.candidateElapsedS)}</td>
                <td>{formatClock(sample.referenceElapsedS)}</td>
                <td className={sample.deltaTimeS <= 0 ? 'is-faster' : 'is-slower'}>
                  {sample.deltaTimeS === 0
                    ? '0 s'
                    : `${sample.deltaTimeS < 0 ? '−' : '+'}${formatDelta(sample.deltaTimeS)}`}
                </td>
                <td>
                  {sample.candidateHeartRateBpm === null && sample.referenceHeartRateBpm === null
                    ? '—'
                    : `${sample.candidateHeartRateBpm ?? '—'} / ${sample.referenceHeartRateBpm ?? '—'}`}
                </td>
                <td>
                  {sample.candidatePowerW === null && sample.referencePowerW === null
                    ? '—'
                    : `${sample.candidatePowerW ?? '—'} / ${sample.referencePowerW ?? '—'} W`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default SegmentEffortComparison;
