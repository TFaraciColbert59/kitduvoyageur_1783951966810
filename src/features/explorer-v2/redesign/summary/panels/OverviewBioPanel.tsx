'use client';

import React, { useMemo } from 'react';
import {
  Activity,
  Award,
  Flame,
  Gauge,
  Leaf,
  Mountain,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Waves,
} from 'lucide-react';
import { OutingInsightBridge } from '@/features/ai-assistant/ui/OutingInsightBridge';
import type { ActivityTelemetryFactsInput, HikeSessionRecord } from '@/features/ai-assistant/activity/activityFacts';
import { MuscleMapSvg } from '../../../strength/MuscleMapSvg';
import type { SummaryExpertAnalysisResult } from '../summaryAnalysisEngine';
import { formatDurationShort, formatPaceMinKm, HonestyBadge, RadialGauge } from './panelFormatters';

export interface OverviewBioPanelProps {
  readonly analysis: SummaryExpertAnalysisResult;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly routeName?: string | null;
  readonly locationLabel?: string | null;
}

const VERDICT_LABEL: Record<string, { text: string; tone: string }> = {
  ideal: { text: 'Idéale', tone: 'good' },
  good: { text: 'Adaptée', tone: 'good' },
  caution: { text: 'Vigilance', tone: 'warn' },
  not_recommended: { text: 'Exigeante / Alerte', tone: 'bad' },
};

export function OverviewBioPanel({
  analysis,
  startedAt,
  endedAt,
  routeName,
  locationLabel,
}: OverviewBioPanelProps) {
  const {
    loadProjection,
    difficulty,
    sortiePerformance,
    lcda,
    fatigue,
    outingFit,
    benchmarkDeltaPct,
    muscleHeatmap,
    swimModule,
    skiDetails,
    equipmentEco,
    aiGuard,
    telemetry,
  } = analysis;

  // Third radial gauge adapts to the sport family & LCDA domain
  const thirdGauge = useMemo(() => {
    if (lcda.status === 'in_domain' && lcda.output) {
      return {
        value: lcda.output.iea,
        max: 100,
        displayValue: `${Math.round(lcda.output.iea)}`,
        unit: '/100',
        label: 'Effort IEA',
        subLabel: `ERP ${Math.round(lcda.output.erp)} · P10–P90 ${Math.round(lcda.output.interval.p10)}–${Math.round(lcda.output.interval.p90)}`,
        tone: 'coral' as const,
      };
    }
    if (telemetry.powerAnalysis.status === 'available' && telemetry.powerAnalysis.normalizedW) {
      return {
        value: Math.min(400, telemetry.powerAnalysis.normalizedW),
        max: 400,
        displayValue: `${telemetry.powerAnalysis.normalizedW}`,
        unit: 'W NP',
        label: 'Puissance NP',
        subLabel:
          analysis.cycling.intensityFactor !== null
            ? `IF ${analysis.cycling.intensityFactor} · ${telemetry.powerAnalysis.quality === 'measured' ? 'Capteur' : 'Estimée'}`
            : `Moy ${telemetry.powerAnalysis.averageW ?? '—'} W`,
        tone: 'violet' as const,
      };
    }
    if (telemetry.gap && telemetry.gap.status === 'available') {
      return {
        value: Math.max(15, Math.min(100, 100 - (telemetry.gap.gapPaceSecondsPerKm - 180) / 4)),
        max: 100,
        displayValue: formatPaceMinKm(telemetry.gap.gapPaceSecondsPerKm / 60),
        unit: '/km GAP',
        label: 'Allure GAP',
        subLabel: `Facteur pente ×${telemetry.gap.gradeFactor.toFixed(2)}`,
        tone: 'sky' as const,
      };
    }
    if (skiDetails && skiDetails.runCount > 0) {
      return {
        value: Math.min(100, skiDetails.runCount * 10),
        max: 100,
        displayValue: `${skiDetails.runCount}`,
        unit: 'runs',
        label: 'Descentes Ski',
        subLabel: `-${Math.round(skiDetails.totalVerticalDropM)} m D−`,
        tone: 'sky' as const,
      };
    }
    return {
      value: Math.round(fatigue.score),
      max: 100,
      displayValue: `${Math.round(fatigue.score)}`,
      unit: '/100',
      label: 'Fatigue séance',
      subLabel: `Modèle ${fatigue.version ?? 'a3-v1'}`,
      tone: 'coral' as const,
    };
  }, [analysis.cycling.intensityFactor, fatigue, lcda, skiDetails, telemetry]);

  const verdict = VERDICT_LABEL[outingFit.verdict] ?? VERDICT_LABEL.good;

  const insightSession = useMemo<HikeSessionRecord>(
    () => ({
      id: analysis.outingId,
      started_at: new Date(startedAt).toISOString(),
      ended_at: new Date(endedAt).toISOString(),
      distance_km: analysis.distanceKm,
      duration_seconds: analysis.movingS,
      elevation_gain_m: analysis.verticality.elevGainM,
      max_altitude_m: analysis.verticality.maxAltM,
      title: analysis.title,
      visibility: 'private',
      route_name: routeName ?? null,
      region: locationLabel ?? null,
    }),
    [analysis, endedAt, locationLabel, routeName, startedAt],
  );

  const insightTelemetry = useMemo<ActivityTelemetryFactsInput>(() => {
    const hrCh = telemetry.sensorChannels.find((c) => c.key === 'heartRate');
    return {
      hrAvgBpm: hrCh?.avg ?? null,
      caloriesKcal: telemetry.energyAndSteps.caloriesKcal,
      caloriesEstimated: telemetry.energyAndSteps.caloriesQuality === 'estimated',
      splitsCount: telemetry.kmSplits.length,
      gapPaceSPerKm: telemetry.gap?.status === 'available' ? telemetry.gap.gapPaceSecondsPerKm : null,
      relativeEffortScore: telemetry.relativeEffort?.score ?? null,
      rpe: analysis.rpe,
      avgPowerW: telemetry.powerAnalysis.averageW,
    };
  }, [analysis.rpe, telemetry]);

  return (
    <div className="xp20-exp-stack" data-testid="xp20-exp-panel-overview">
      {/* 1. 3 Radial Liquid Glass Gauges */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Sparkles size={14} aria-hidden="true" />
            <span>Indices synthétiques</span>
          </div>
          <HonestyBadge
            quality={loadProjection.canonicalLoad.tier === 'power_tss' || loadProjection.canonicalLoad.tier === 'hr_relative_effort' ? 'measured' : 'estimated'}
            label={loadProjection.canonicalTierLabelFr}
          />
        </div>
        <div className="xp20-exp-gauges-grid">
          <RadialGauge
            value={loadProjection.canonicalLoad.loadUnits}
            max={150}
            displayValue={`${Math.round(loadProjection.canonicalLoad.loadUnits)}`}
            unit="UA"
            label="Charge canonique"
            subLabel={loadProjection.canonicalTierLabelFr}
            tone="forest"
          />
          <RadialGauge
            value={difficulty.status !== 'unavailable' ? difficulty.score : Math.min(100, sortiePerformance.ibpIndex)}
            max={100}
            displayValue={
              difficulty.status !== 'unavailable'
                ? `${Math.round(difficulty.score)}`
                : `${Math.round(sortiePerformance.ibpIndex)}`
            }
            unit={difficulty.status !== 'unavailable' ? '/100' : 'IBP'}
            label={difficulty.status !== 'unavailable' ? difficulty.levelLabel : 'Indice IBP'}
            subLabel={`${sortiePerformance.effortScoreKe.toFixed(1)} km-E · IBP ${Math.round(sortiePerformance.ibpIndex)}`}
            tone="amber"
          />
          <RadialGauge {...thirdGauge} />
        </div>
      </section>

      {/* 2. LCDA Bioenergetics + Shapley 6 Pillars */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Flame size={14} aria-hidden="true" />
            <span>Décomposition Shapley 6 piliers (LCDA)</span>
          </div>
          <HonestyBadge
            quality={lcda.status === 'in_domain' ? 'estimated' : 'unavailable'}
            label={
              lcda.status === 'in_domain'
                ? `LCDA · ${lcda.output?.dataLevel ?? 'socle'}`
                : 'Hors domaine LCDA'
            }
          />
        </div>

        {lcda.status === 'in_domain' && lcda.output ? (
          <div className="xp20-exp-shapley-list">
            <div className="xp20-exp-micro-row">
              <span>
                Dose interne <strong>{lcda.output.rawDose.toFixed(1)}</strong> · km-Effort{' '}
                <strong>{lcda.output.eFlatKm.toFixed(1)} km</strong>
              </span>
              <span>
                Puissance métab. <strong>{Math.round(lcda.output.mEffW)} W</strong>
              </span>
            </div>
            {lcda.shapleyPillars.map((pillar) => (
              <div key={pillar.id} className="xp20-exp-bar-row">
                <div className="xp20-exp-bar-head">
                  <span>{pillar.label}</span>
                  <strong>
                    {pillar.sharePct} % <small>({pillar.value.toFixed(1)} pts)</small>
                  </strong>
                </div>
                <div className="xp20-exp-bar-track">
                  <span
                    className="xp20-exp-bar-fill"
                    style={{
                      width: `${Math.max(pillar.value > 0 ? 4 : 0, pillar.sharePct)}%`,
                      background: pillar.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="xp20-exp-note" data-testid="xp20-exp-lcda-out-of-domain">
            {lcda.reason}
          </p>
        )}
      </section>

      {/* 3. Intra-Day Fatigue Breakdown */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Activity size={14} aria-hidden="true" />
            <span>Fatigue intra-journée (bioénergétique)</span>
          </div>
          <span className="xp20-exp-pill-strong">{Math.round(fatigue.score)} / 100</span>
        </div>
        <div className="xp20-exp-fatigue-chips">
          {fatigue.components
            .filter((c) => Math.abs(c.value) >= 0.5)
            .map((comp) => (
              <div key={comp.label} className="xp20-exp-mini-kv">
                <span>{comp.label}</span>
                <strong>
                  {comp.value > 0 ? '+' : ''}
                  {comp.value.toFixed(1)}
                </strong>
              </div>
            ))}
        </div>
      </section>

      {/* 4. Biomechanical Benchmark Real vs P50-P90 + Outing Fit */}
      <section className="xp20-exp-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            <Gauge size={14} aria-hidden="true" />
            <span>Benchmark biomécanique &amp; Adéquation</span>
          </div>
          <span className={`xp20-exp-tone-pill is-${verdict.tone}`}>
            Fit {outingFit.fitScore}/100 · {verdict.text}
          </span>
        </div>

        <div className="xp20-exp-bench-grid">
          <div className="xp20-exp-kpi-box">
            <span>Durée réelle</span>
            <strong>{formatDurationShort(analysis.movingS)}</strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Modèle P50–P90</span>
            <strong>{sortiePerformance.formattedRange}</strong>
          </div>
          <div className="xp20-exp-kpi-box">
            <span>Écart vs P50</span>
            <strong>
              {benchmarkDeltaPct !== null
                ? `${benchmarkDeltaPct > 0 ? '+' : ''}${benchmarkDeltaPct} %`
                : '—'}
            </strong>
          </div>
        </div>

        <div className="xp20-exp-fit-bars">
          {[
            { label: 'Physio', val: outingFit.subScores.physiological },
            { label: 'Technique', val: outingFit.subScores.technical },
            { label: 'Environnement', val: outingFit.subScores.environmental },
          ].map((item) => (
            <div key={item.label} className="xp20-exp-fit-pill">
              <span>{item.label}</span>
              <strong>{item.val}/100</strong>
            </div>
          ))}
        </div>
        {outingFit.reasons.length > 0 ? (
          <p className="xp20-exp-note">{outingFit.reasons[0]}</p>
        ) : null}
      </section>

      {/* 5. Conditional Sport-Specific Module (Strength MuscleMap, Swim, Ski, CO2) */}
      {muscleHeatmap && muscleHeatmap.totalSets > 0 ? (
        <section className="xp20-exp-card">
          <div className="xp20-exp-card-head">
            <div className="xp20-exp-card-title">
              <Award size={14} aria-hidden="true" />
              <span>Carte musculaire &amp; Volume</span>
            </div>
            <span className="xp20-exp-pill-strong">{muscleHeatmap.totalSets} séries</span>
          </div>
          <MuscleMapSvg heatmap={muscleHeatmap} compact />
        </section>
      ) : null}

      {swimModule ? (
        <section className="xp20-exp-card">
          <div className="xp20-exp-card-head">
            <div className="xp20-exp-card-title">
              <Waves size={14} aria-hidden="true" />
              <span>Module Natation</span>
            </div>
            <HonestyBadge quality={swimModule.available ? 'measured' : 'unavailable'} />
          </div>
          <div className="xp20-exp-bench-grid">
            <div className="xp20-exp-kpi-box">
              <span>Allure /100 m</span>
              <strong>{swimModule.pacePer100m.formatted}</strong>
            </div>
            <div className="xp20-exp-kpi-box">
              <span>Bassin</span>
              <strong>
                {swimModule.poolLengthM ? `${swimModule.poolLengthM} m` : 'Eau libre'}
                {swimModule.poolLengthsCount ? ` × ${swimModule.poolLengthsCount}` : ''}
              </strong>
            </div>
            <div className="xp20-exp-kpi-box">
              <span>SWOLF</span>
              <strong>{swimModule.swolf.formatted}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {skiDetails ? (
        <section className="xp20-exp-card">
          <div className="xp20-exp-card-head">
            <div className="xp20-exp-card-title">
              <Mountain size={14} aria-hidden="true" />
              <span>Module Glisse &amp; Runs</span>
            </div>
            <span className="xp20-exp-pill-strong">{skiDetails.runCount} descentes</span>
          </div>
          <div className="xp20-exp-bench-grid">
            <div className="xp20-exp-kpi-box">
              <span>Dénivelé D−</span>
              <strong>-{Math.round(skiDetails.totalVerticalDropM)} m</strong>
            </div>
            <div className="xp20-exp-kpi-box">
              <span>Remontées</span>
              <strong>{skiDetails.liftCount} (+{Math.round(skiDetails.totalLiftGainM)} m)</strong>
            </div>
            <div className="xp20-exp-kpi-box">
              <span>Vitesse max</span>
              <strong>{skiDetails.maxDescentSpeed.formatted}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {equipmentEco.co2Applicable && equipmentEco.co2SavedKg !== null ? (
        <section className="xp20-exp-card is-eco">
          <div className="xp20-exp-card-head">
            <div className="xp20-exp-card-title">
              <Leaf size={14} aria-hidden="true" />
              <span>Mobilité douce · CO₂ évité</span>
            </div>
            <span className="xp20-exp-pill-strong">−{equipmentEco.co2SavedKg.toFixed(2)} kg CO₂</span>
          </div>
          <p className="xp20-exp-note">
            Équivalent trajet thermique moyen (base ADEME 193 g CO₂/km sur {analysis.distanceKm.toFixed(1)} km).
          </p>
        </section>
      ) : null}

      {/* 6. RGPD Art. 9 Strict Guarded AI Insight Bridge */}
      <section className="xp20-exp-card" data-testid="xp20-exp-ai-bridge-card">
        <div className="xp20-exp-card-head">
          <div className="xp20-exp-card-title">
            {aiGuard.allowed ? (
              <ShieldCheck size={14} aria-hidden="true" />
            ) : (
              <ShieldAlert size={14} aria-hidden="true" />
            )}
            <span>Synthèse narrative &amp; conformité IA</span>
          </div>
          <HonestyBadge
            quality={aiGuard.allowed ? 'estimated' : 'unavailable'}
            label={aiGuard.allowed ? 'Minimisé · 0 PII' : 'Bloqué RGPD Art. 9'}
          />
        </div>
        {aiGuard.allowed ? (
          <OutingInsightBridge session={insightSession} telemetry={insightTelemetry} />
        ) : (
          <div className="xp20-exp-rgpd-block" data-testid="xp20-exp-rgpd-blocked">
            <strong>Pont IA strictement désactivé</strong>
            <p>
              {aiGuard.reason === 'rgpd_art9_sensitive'
                ? 'Cette activité relève de données de santé sensibles (RGPD Art. 9). Aucune donnée n’est transmise à un modèle d’intelligence artificielle.'
                : 'Activité issue de Strava : transmission IA bloquée conformément aux conditions d’utilisation.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
