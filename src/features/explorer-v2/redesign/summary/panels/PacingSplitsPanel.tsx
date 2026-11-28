'use client';

import React, { useState } from 'react';
import {
  Award,
  Clock,
  Compass,
  Flag,
  Gauge,
  RefreshCw,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import { formatDurationDelta } from '@/features/compte/progression/comparableOutings';
import { formatChronoS } from '@/features/compte/progression/runningRecords';
import type { ActivitySplit } from '../../../state/types';
import type { SummaryExpertAnalysisResult } from '../summaryAnalysisEngine';
import type { SegmentDetectionState } from '../useSummaryExpertAnalysis';
import { formatDurationShort, formatPaceMinKm, HonestyBadge } from './panelFormatters';

export interface PacingSplitsPanelProps {
  readonly analysis: SummaryExpertAnalysisResult;
  readonly laps?: readonly ActivitySplit[];
  readonly segmentDetection: SegmentDetectionState;
  readonly onDetectSegments: () => void;
}

type SplitMode = 'km' | 'mi' | 'laps';

export function PacingSplitsPanel({
  analysis,
  laps = [],
  segmentDetection,
  onDetectSegments,
}: PacingSplitsPanelProps) {
  const {
    telemetry,
    pacing,
    runningTraceRecords,
    racePredictions,
    highlights,
    comparableOutings,
    units,
  } = analysis;

  const [splitMode, setSplitMode] = useState<SplitMode>(units === 'imperial' ? 'mi' : 'km');

  const activeTraceSplits = splitMode === 'mi' ? telemetry.miSplits : telemetry.kmSplits;
  const maxSplitPace = activeTraceSplits.reduce(
    (max, s) => (s.paceMinPerKm && s.paceMinPerKm > max ? s.paceMinPerKm : max),
    0,
  );
  const minSplitPace = activeTraceSplits.reduce(
    (min, s) => (s.paceMinPerKm && s.paceMinPerKm < min ? s.paceMinPerKm : min),
    Infinity,
  );

  const validBestEfforts = (runningTraceRecords?.bestEfforts ?? []).filter(
    (b) => b.quality !== 'unavailable' && b.estimatedTimeS !== null,
  );

  return (
    <div className="xp20-exp-stack" data-testid="xp20-exp-panel-pacing">
      {/* 1. Pacing Dynamics (Negative/Positive Split & CV%) + GAP Minetti (2002) */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Gauge size={14} aria-hidden="true" />
            <span>Dynamique d’allure &amp; Régularité</span>
          </div>
          <span
            className={`xp20-exp-tone-pill ${
              pacing.splitStrategyLabel === 'Negative Split'
                ? 'is-good'
                : pacing.splitStrategyLabel === 'Positive Split'
                  ? 'is-warn'
                  : 'is-neutral'
            }`}
          >
            {pacing.splitStrategyLabel}
          </span>
        </div>

        <div className="xp20-exp-bench-grid">
          <div className="xp20-exp-kpi-box">
            <span>Split 2e / 1re moitié</span>
            <strong>
              {pacing.splitDeltaPct !== null
                ? `${pacing.splitDeltaPct > 0 ? '+' : ''}${pacing.splitDeltaPct} %`
                : '—'}
            </strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Régularité (CV)</span>
            <strong>{pacing.regularityCvPct !== null ? `${pacing.regularityCvPct} %` : '—'}</strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>1re → 2e moitié</span>
            <strong>
              {pacing.firstHalfPaceMinKm !== null && pacing.secondHalfPaceMinKm !== null
                ? `${formatPaceMinKm(pacing.firstHalfPaceMinKm)} → ${formatPaceMinKm(pacing.secondHalfPaceMinKm)}`
                : '—'}
            </strong>
          </div>
        </div>

        {/* GAP Minetti (2002) */}
        {telemetry.gap ? (
          <div className="xp20-exp-subbox">
            <div className="xp20-exp-card-head">
              <span className="xp20-exp-subbox-title">Allure ajustée pente · GAP Minetti (2002)</span>
              <HonestyBadge
                quality={telemetry.gap.status === 'available' ? 'estimated' : 'unavailable'}
              />
            </div>
            {telemetry.gap.status === 'available' ? (
              <div className="xp20-exp-bench-grid">
                <div className="xp20-exp-kpi-box">
                  <span>Allure brute</span>
                  <strong>{formatPaceMinKm(telemetry.gap.rawPaceSecondsPerKm / 60)} /km</strong>
                </div>
                <div className="xp20-exp-kpi-box">
                  <span>Allure GAP plat</span>
                  <strong>{formatPaceMinKm(telemetry.gap.gapPaceSecondsPerKm / 60)} /km</strong>
                </div>
                <div className="xp20-exp-kpi-box">
                  <span>Facteur coût</span>
                  <strong>×{telemetry.gap.gradeFactor.toFixed(2)}</strong>
                </div>
              </div>
            ) : (
              <p className="xp20-exp-note">{telemetry.gap.reason}</p>
            )}
          </div>
        ) : null}
      </section>

      {/* 2. Splits km / mi / tours */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Timer size={14} aria-hidden="true" />
            <span>Découpage &amp; Splits</span>
          </div>
          <div className="xp20-exp-seg-mini" role="tablist" aria-label="Unité des splits">
            {(['km', 'mi', 'laps'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={splitMode === m}
                className={`xp20-exp-seg-mini-btn${splitMode === m ? ' is-active' : ''}`}
                onClick={() => setSplitMode(m)}
              >
                {m === 'km' ? 'km' : m === 'mi' ? 'mi' : `Tours (${laps.length})`}
              </button>
            ))}
          </div>
        </div>

        {splitMode === 'laps' ? (
          laps.length === 0 ? (
            <p className="xp20-exp-note">Aucun tour manuel enregistré pendant cette sortie.</p>
          ) : (
            <div className="xp20-exp-split-list">
              {laps.map((lap) => (
                <div key={lap.index} className="xp20-exp-split-row">
                  <strong className="xp20-exp-split-idx">T{lap.index}</strong>
                  <span>{(lap.distanceM / 1000).toFixed(2)} km</span>
                  <strong>{formatDurationShort(lap.movingS)}</strong>
                </div>
              ))}
            </div>
          )
        ) : activeTraceSplits.length === 0 ? (
          <p className="xp20-exp-note">
            Distance inférieure à 1 {splitMode === 'mi' ? 'mile' : 'km'} : aucun split complet disponible.
          </p>
        ) : (
          <div className="xp20-exp-split-list">
            {activeTraceSplits.map((s) => {
              // Shorter pace = faster = longer bar
              const barPct =
                s.paceMinPerKm && maxSplitPace > 0
                  ? Math.max(
                      18,
                      Math.min(
                        100,
                        maxSplitPace === minSplitPace
                          ? 72
                          : 100 - ((s.paceMinPerKm - minSplitPace) / (maxSplitPace - minSplitPace)) * 68,
                      ),
                    )
                  : 40;
              return (
                <div
                  key={`${s.unit}-${s.index}`}
                  className={`xp20-exp-split-visual-row${s.isFastest ? ' is-fastest' : ''}`}
                >
                  <div className="xp20-exp-split-top">
                    <span className="xp20-exp-split-idx">
                      {s.unit === 'mi' ? 'Mi' : 'Km'} {s.index}
                      {!s.completed ? '*' : ''}
                      {s.isFastest ? <span className="xp20-exp-fastest-tag">Rapide</span> : null}
                    </span>
                    <strong className="xp20-exp-split-val">
                      {analysis.sport === 'velo' && s.speedKmh !== null
                        ? s.unit === 'mi'
                          ? `${(s.speedKmh * 0.621371).toFixed(1)} mph`
                          : `${s.speedKmh.toFixed(1)} km/h`
                        : s.paceMinPerKm !== null
                          ? s.unit === 'mi'
                            ? `${formatPaceMinKm(s.paceMinPerKm * 1.609344)} /mi`
                            : `${formatPaceMinKm(s.paceMinPerKm)} /km`
                          : formatDurationShort(s.durationS)}
                    </strong>
                    <span className="xp20-exp-split-meta">
                      {s.gapPaceMinPerKm !== null
                        ? `GAP ${formatPaceMinKm(
                            s.unit === 'mi' ? s.gapPaceMinPerKm * 1.609344 : s.gapPaceMinPerKm,
                          )} · `
                        : ''}
                      {s.elevationGainM !== null ? `+${Math.round(s.elevationGainM)}m` : ''}
                      {s.averageHrBpm !== null ? ` · ${s.averageHrBpm} bpm` : ''}
                      {s.averagePowerW !== null ? ` · ${s.averagePowerW} W` : ''}
                    </span>
                  </div>
                  <div className="xp20-exp-bar-track">
                    <span
                      className="xp20-exp-bar-fill"
                      style={{
                        width: `${Math.round(barPct)}%`,
                        background: s.isFastest ? '#0e8f5b' : '#17402c',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Auto-Detected Effort Intervals */}
      {telemetry.intervals.length > 0 ? (
        <section className="xp20-exp-card">
          <div className="xp20-exp-card-head">
            <div className="xp20-exp-card-title">
              <Zap size={14} aria-hidden="true" />
              <span>Intervalles détectés automatiquement</span>
            </div>
            <span className="xp20-exp-micro-muted">{telemetry.intervals.length} blocs</span>
          </div>
          <div className="xp20-exp-interval-list">
            {telemetry.intervals.slice(0, 8).map((iv) => (
              <div key={iv.index} className="xp20-exp-interval-row">
                <span className={`xp20-exp-tone-pill ${iv.kind === 'effort' ? 'is-warn' : 'is-good'}`}>
                  {iv.kind === 'effort' ? `Effort #${iv.index}` : `Récup #${iv.index}`}
                </span>
                <span>
                  km {iv.startKm.toFixed(1)}→{iv.endKm.toFixed(1)} ({formatDurationShort(iv.durationS)})
                </span>
                <strong>
                  {iv.averagePaceMinPerKm
                    ? `${formatPaceMinKm(iv.averagePaceMinPerKm)} /km`
                    : iv.averageSpeedKmh
                      ? `${iv.averageSpeedKmh.toFixed(1)} km/h`
                      : '—'}
                </strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 4. Running Records (400 m -> Marathon) & Riegel Predictions */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Trophy size={14} aria-hidden="true" />
            <span>Meilleurs efforts &amp; Prédictions Riegel</span>
          </div>
          {runningTraceRecords && runningTraceRecords.filteredSpikeCount > 0 ? (
            <span className="xp20-exp-micro-muted">
              {runningTraceRecords.filteredSpikeCount} saut(s) GPS filtré(s)
            </span>
          ) : null}
        </div>

        {validBestEfforts.length > 0 ? (
          <div className="xp20-exp-records-grid">
            {validBestEfforts.map((eff) => (
              <div key={eff.targetId} className="xp20-exp-kpi-box">
                <span>{eff.label}</span>
                <strong>{formatChronoS(eff.estimatedTimeS)}</strong>
                <small>{eff.paceMinPerKm ? `${formatPaceMinKm(eff.paceMinPerKm)} /km` : ''}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="xp20-exp-note">
            Distance ou horodatage insuffisant pour extraire un meilleur effort sur la trace (400 m → Marathon).
          </p>
        )}

        {racePredictions.status === 'available' && racePredictions.predictions.length > 0 ? (
          <div className="xp20-exp-subbox">
            <div className="xp20-exp-card-head">
              <span className="xp20-exp-subbox-title">Projections Riegel (T₂ = T₁ · (D₂/D₁)^1.06)</span>
              <HonestyBadge quality="estimated" />
            </div>
            <div className="xp20-exp-records-grid">
              {racePredictions.predictions.map((pred) => (
                <div key={pred.targetId} className="xp20-exp-kpi-box">
                  <span>{pred.label}</span>
                  <strong>{formatChronoS(pred.predictedTimeS)}</strong>
                  <small>{formatPaceMinKm(pred.predictedPaceMinPerKm)} /km</small>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* 5. Opt-in Segments Detection (/api/segments/detect on click only) */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Flag size={14} aria-hidden="true" />
            <span>Segments traversés</span>
          </div>
          <button
            type="button"
            className="xp20-exp-action-btn"
            data-testid="xp20-exp-detect-segments-btn"
            disabled={segmentDetection.status === 'loading'}
            onClick={onDetectSegments}
          >
            <RefreshCw
              size={12}
              className={segmentDetection.status === 'loading' ? 'animate-spin' : undefined}
              aria-hidden="true"
            />
            <span>
              {segmentDetection.status === 'loading'
                ? 'Analyse…'
                : 'Détecter les segments'}
            </span>
          </button>
        </div>

        {segmentDetection.message ? (
          <p className="xp20-exp-note" data-testid="xp20-exp-segments-status">
            {segmentDetection.message}
          </p>
        ) : (
          <p className="xp20-exp-note">
            Action optionnelle : lance la correspondance de votre trace avec le catalogue de segments (requête authentifiée à la demande).
          </p>
        )}

        {segmentDetection.efforts.length > 0 ? (
          <div className="xp20-exp-split-list" data-testid="xp20-exp-segments-list">
            {segmentDetection.efforts.map((eff) => (
              <div key={eff.effortId} className="xp20-exp-split-row">
                <span className="xp20-exp-split-idx">
                  <strong>{eff.segmentName ?? `Segment ${eff.segmentId.slice(0, 8)}`}</strong>
                  {eff.isPersonalRecord ? <span className="xp20-exp-fastest-tag">PR</span> : null}
                </span>
                <span className="xp20-exp-split-meta">
                  {eff.coveredDistanceM !== null
                    ? `${(eff.coveredDistanceM / 1000).toFixed(2)} km`
                    : ''}
                  {eff.avgSpeedKmh !== null ? ` · ${eff.avgSpeedKmh.toFixed(1)} km/h` : ''}
                  {eff.elevationGainM !== null && eff.elevationGainM > 0
                    ? ` · +${Math.round(eff.elevationGainM)} m`
                    : ''}
                </span>
                <strong>{formatDurationShort(eff.movingDurationS ?? eff.elapsedDurationS)}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* 6. Highlights & Comparable Outings */}
      {highlights.length > 0 ? (
        <section className="xp20-exp-card">
          <div className="xp20-exp-card-head">
            <div className="xp20-exp-card-title">
              <Award size={14} aria-hidden="true" />
              <span>Temps forts de la sortie</span>
            </div>
          </div>
          <div className="xp20-exp-highlight-list">
            {highlights.map((h) => (
              <div key={h.id} className="xp20-exp-highlight-row">
                <div>
                  <strong>{h.title}</strong>
                  <span>{h.detail}</span>
                </div>
                <span className="xp20-exp-pill-strong">{h.metricValue}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Compass size={14} aria-hidden="true" />
            <span>Sorties comparables</span>
          </div>
          <span className="xp20-exp-micro-muted">{comparableOutings.length} trouvée(s)</span>
        </div>
        {comparableOutings.length === 0 ? (
          <p className="xp20-exp-note">
            Aucune sortie antérieure comparable (même itinéraire ou massif/distance proche) dans votre historique local.
          </p>
        ) : (
          <div className="xp20-exp-split-list">
            {comparableOutings.map((comp) => (
              <div key={comp.id} className="xp20-exp-highlight-row">
                <div>
                  <strong>{comp.title}</strong>
                  <span>
                    {comp.dateKey ?? '—'} · {comp.distanceKm?.toFixed(1) ?? '—'} km · +
                    {comp.dplusM ?? 0} m
                  </span>
                </div>
                <span className="xp20-exp-micro-muted">
                  <Clock size={10} className="inline mr-1" />
                  {formatDurationDelta(comp.deltaDurationS)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
