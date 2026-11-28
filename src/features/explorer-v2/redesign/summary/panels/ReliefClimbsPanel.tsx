'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, Mountain, TrendingUp } from 'lucide-react';
import type { GradientSection } from '@/features/routes/analysis/climbs';
import { formatSkiRunForDisplay } from '../../../activity/modes/skiActivity';
import type { SummaryExpertAnalysisResult } from '../summaryAnalysisEngine';
import {
  InlineInteractiveTraceSvg,
  type HighlightedTraceRange,
} from './InlineInteractiveTraceSvg';
import { formatDurationShort, HonestyBadge } from './panelFormatters';

export interface ReliefClimbsPanelProps {
  readonly analysis: SummaryExpertAnalysisResult;
  readonly onHighlightSegment?: (
    segment: { coordinates: Array<[number, number]>; label?: string } | null,
  ) => void;
}

const BUCKET_COLORS: Record<string, string> = {
  descent_steep: '#0369a1',
  descent: '#38bdf8',
  flat: '#94a3b8',
  climb_mild: '#16a34a',
  climb_steep: '#d97706',
  climb_extreme: '#dc2626',
};

const CAT_BADGE_COLORS: Record<number, { bg: string; fg: string }> = {
  1: { bg: 'rgba(22, 163, 74, 0.14)', fg: '#15803d' },
  2: { bg: 'rgba(101, 163, 13, 0.14)', fg: '#4d7c0f' },
  3: { bg: 'rgba(217, 119, 6, 0.16)', fg: '#b45309' },
  4: { bg: 'rgba(234, 88, 12, 0.16)', fg: '#c2410c' },
  5: { bg: 'rgba(220, 38, 38, 0.16)', fg: '#b91c1c' },
};

export function ReliefClimbsPanel({
  analysis,
  onHighlightSegment,
}: ReliefClimbsPanelProps) {
  const { verticality, climbs, telemetry, skiDetails, units } = analysis;
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [highlightedRange, setHighlightedRange] = useState<HighlightedTraceRange | null>(null);
  const onHighlightSegmentRef = useRef(onHighlightSegment);
  onHighlightSegmentRef.current = onHighlightSegment;

  // Clear map highlight when leaving the Relief tab or unmounting
  useEffect(() => {
    return () => {
      onHighlightSegmentRef.current?.(null);
    };
  }, []);

  const handleToggleSection = (section: GradientSection) => {
    if (selectedSectionId === section.id) {
      setSelectedSectionId(null);
      setHighlightedRange(null);
      onHighlightSegment?.(null);
      return;
    }

    const label = `${section.kind === 'climb' ? 'Montée' : 'Descente'} Cat ${section.category} · ${
      section.avgGradePct > 0 ? '+' : ''
    }${section.avgGradePct.toFixed(1)} %`;

    setSelectedSectionId(section.id);
    setHighlightedRange({
      fromM: section.fromM,
      toM: section.toM,
      label,
    });

    if (onHighlightSegment) {
      const coords: Array<[number, number]> = telemetry.aligned
        .filter((p) => {
          const dM = p.distanceKm * 1000;
          return dM >= section.fromM && dM <= section.toM;
        })
        .map((p) => [p.lng, p.lat]);
      if (coords.length >= 2) {
        onHighlightSegment({ coordinates: coords, label });
      } else {
        onHighlightSegment(null);
      }
    }
  };

  const hasSlopeData = verticality.slopeBuckets.some((b) => b.distanceKm > 0);

  return (
    <div className="xp20-exp-stack" data-testid="xp20-exp-panel-relief">
      {/* 1. Verticality KPI Grid */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Mountain size={14} aria-hidden="true" />
            <span>Verticalité &amp; VAM</span>
          </div>
          <HonestyBadge quality={verticality.elevationQuality} />
        </div>

        <div className="xp20-exp-kpi-grid-3">
          <div className="xp20-exp-kpi-box">
            <span>D+ / D−</span>
            <strong>
              +{verticality.elevGainM} / −{verticality.elevLossM} m
            </strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Alt min / max</span>
            <strong>
              {verticality.minAltM !== null && verticality.maxAltM !== null
                ? `${verticality.minAltM}–${verticality.maxAltM} m`
                : '—'}
            </strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Alt moyenne</span>
            <strong>{verticality.avgAltM !== null ? `${verticality.avgAltM} m` : '—'}</strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>VAM moyenne</span>
            <strong>{verticality.vamAvgMH !== null ? `${verticality.vamAvgMH} m/h` : '—'}</strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>VAM pic (3 min)</span>
            <strong>{verticality.vamPeakMH !== null ? `${verticality.vamPeakMH} m/h` : '—'}</strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Pente max (50 m)</span>
            <strong>
              {verticality.maxGrade50mPct !== null ? `+${verticality.maxGrade50mPct} %` : '—'}
            </strong>
          </div>
        </div>
      </section>

      {/* 2. Slope Distribution Histogram */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <TrendingUp size={14} aria-hidden="true" />
            <span>Distribution des pentes</span>
          </div>
          <span className="xp20-exp-micro-muted">
            Couv. alt {verticality.elevationCoveragePct} %
          </span>
        </div>

        {hasSlopeData ? (
          <div className="xp20-exp-chart-box">
            <ResponsiveContainer width="100%" height={164}>
              <BarChart
                data={[...verticality.slopeBuckets]}
                margin={{ top: 8, right: 6, left: -20, bottom: 0 }}
              >
                <XAxis dataKey="label" tick={{ fontSize: 9.5 }} interval={0} />
                <YAxis tick={{ fontSize: 10 }} unit="%" />
                <Tooltip
                  formatter={(value, _name, item) => {
                    const dKm =
                      (item?.payload as { distanceKm?: number } | undefined)?.distanceKm ?? 0;
                    return [`${String(value ?? 0)} % (${dKm} km)`, 'Part de la distance'];
                  }}
                />
                <Bar dataKey="sharePct" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  {verticality.slopeBuckets.map((b) => (
                    <Cell key={b.id} fill={BUCKET_COLORS[b.tone] ?? '#17402c'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="xp20-exp-note">
            Altitudes insuffisantes pour distribuer les pentes. Utilisez « Recaler altitude DEM » dans Courbes.
          </p>
        )}
      </section>

      {/* 3. Classified Climbs & Descents Cat 1-5 + Highlight on Inline Trace & Map */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <ArrowUpRight size={14} aria-hidden="true" />
            <span>Montées &amp; descentes classées (Cat 1–5)</span>
          </div>
          <span className="xp20-exp-micro-muted">
            {climbs.climbs.length} M · {climbs.descents.length} D
          </span>
        </div>

        {telemetry.aligned.length >= 2 && (climbs.climbs.length > 0 || climbs.descents.length > 0) ? (
          <div className="mb-2.5">
            <InlineInteractiveTraceSvg
              points={telemetry.aligned}
              highlightedRange={highlightedRange}
              height={94}
            />
          </div>
        ) : null}

        {climbs.climbs.length === 0 && climbs.descents.length === 0 ? (
          <p className="xp20-exp-note">
            Aucune ascension ou descente catégorisée (seuil de dénivelé ou d’altitude non atteint sur cette trace).
          </p>
        ) : (
          <div className="xp20-exp-climb-list">
            {[...climbs.climbs, ...climbs.descents].map((sec) => {
              const active = selectedSectionId === sec.id;
              const badge = CAT_BADGE_COLORS[sec.category] ?? CAT_BADGE_COLORS[1];
              const isClimb = sec.kind === 'climb';
              return (
                <button
                  key={sec.id}
                  type="button"
                  className={`xp20-exp-climb-row${active ? ' is-selected' : ''}`}
                  data-testid={`xp20-exp-climb-${sec.id}`}
                  onClick={() => handleToggleSection(sec)}
                >
                  <div className="xp20-exp-climb-left">
                    <span
                      className="xp20-exp-cat-pill"
                      style={{ background: badge.bg, color: badge.fg }}
                    >
                      {isClimb ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                      Cat {sec.category}
                    </span>
                    <div className="xp20-exp-climb-copy">
                      <strong>
                        {isClimb ? 'Montée' : 'Descente'} · km {(sec.fromM / 1000).toFixed(1)} →{' '}
                        {(sec.toM / 1000).toFixed(1)}
                      </strong>
                      <span>
                        {(sec.lengthM / 1000).toFixed(2)} km · {sec.minElevationM}–{sec.maxElevationM} m ·{' '}
                        {sec.categoryLabel}
                      </span>
                    </div>
                  </div>
                  <div className="xp20-exp-climb-right">
                    <strong>
                      {isClimb ? `+${Math.round(sec.gainM)} m` : `−${Math.round(sec.lossM)} m`}
                    </strong>
                    <span>
                      {sec.avgGradePct > 0 ? '+' : ''}
                      {sec.avgGradePct.toFixed(1)} % (max {Math.abs(sec.maxGradePct).toFixed(0)} %)
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Conditional Ski Runs vs Lifts Table */}
      {skiDetails && (skiDetails.runs.length > 0 || skiDetails.lifts.length > 0) ? (
        <section className="xp20-exp-card">
          <div className="xp20-exp-card-head">
            <div className="xp20-exp-card-title">
              <Mountain size={14} aria-hidden="true" />
              <span>Descentes vs Remontées (Ski)</span>
            </div>
            <span className="xp20-exp-micro-muted">
              {skiDetails.runCount} runs · {skiDetails.liftCount} remontées
            </span>
          </div>
          <div className="xp20-exp-table-wrap">
            <table className="xp20-exp-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Dist.</th>
                  <th>D−</th>
                  <th>Vit. moy / max</th>
                  <th>Durée</th>
                </tr>
              </thead>
              <tbody>
                {skiDetails.runs.map((run) => {
                  const fmt = formatSkiRunForDisplay(run, units);
                  return (
                    <tr key={run.index}>
                      <td><strong>{fmt.label}</strong></td>
                      <td>{fmt.distanceFormatted}</td>
                      <td>−{fmt.verticalDropFormatted}</td>
                      <td>{fmt.avgSpeedFormatted} / {fmt.maxSpeedFormatted}</td>
                      <td>{formatDurationShort(run.durationS)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
