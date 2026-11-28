import { describe, expect, it } from 'vitest';
import type { ProgressionSession } from '@/features/compte/progression/engine';
import { resolveActivityProfile } from '../../../specs/resolveActivityProfile';
import {
  computeSummaryExpertAnalysis,
  interpolateDemElevationOnPoints,
  type SummaryTrackPointInput,
} from '../summaryAnalysisEngine';
import { formatDurationShort, formatPaceMinKm } from '../panels/panelFormatters';

function buildRealisticMountainTrace(options: {
  startMs: number;
  count: number;
  stepS: number;
  stepLatDeg: number;
  peakGainM: number;
  withHr?: boolean;
  withElevation?: boolean;
}): SummaryTrackPointInput[] {
  const pts: SummaryTrackPointInput[] = [];
  const baseLat = 45.88;
  const baseLng = 6.86;
  const baseEle = 1050;
  for (let i = 0; i < options.count; i += 1) {
    const progress = i / Math.max(1, options.count - 1);
    // Climb up for 65%, descend for 35%
    const eleOffset =
      progress <= 0.65
        ? (progress / 0.65) * options.peakGainM
        : ((1 - progress) / 0.35) * options.peakGainM;
    pts.push({
      lat: baseLat + i * options.stepLatDeg,
      lng: baseLng + Math.sin(progress * Math.PI) * 0.002,
      ele: options.withElevation === false ? null : Math.round((baseEle + eleOffset) * 10) / 10,
      t: options.startMs + i * options.stepS * 1000,
      hr: options.withHr ? Math.round(132 + Math.sin(progress * Math.PI) * 28) : null,
      acc: 6,
    });
  }
  return pts;
}

const SAMPLE_HISTORY: ProgressionSession[] = [
  {
    id: 'hist-1',
    title: 'Sortie Trail · Chamonix',
    startedAt: new Date(Date.UTC(2026, 6, 10, 7, 0)).toISOString(),
    endedAt: new Date(Date.UTC(2026, 6, 10, 8, 30)).toISOString(),
    km: 10.2,
    dplus: 420,
    durationS: 5400,
    sport: 'trail',
    massif: 'Mont-Blanc',
  },
  {
    id: 'hist-2',
    title: 'Sortie Trail · Chamonix',
    startedAt: new Date(Date.UTC(2026, 6, 14, 7, 0)).toISOString(),
    endedAt: new Date(Date.UTC(2026, 6, 14, 8, 10)).toISOString(),
    km: 9.8,
    dplus: 390,
    durationS: 4200,
    sport: 'trail',
    massif: 'Mont-Blanc',
  },
];

describe('summaryAnalysisEngine — orchestrateur 6 volets', () => {
  it('calcule les 6 domaines pour une sortie rando/montagne complète (LCDA Shapley, montées, splits, CTL/ATL/TSB, NOAA, récup)', () => {
    const startMs = Date.UTC(2026, 6, 18, 7, 0, 0);
    // ~5.5 km at ~4.8 km/h (~68 min) -> right inside LCDA pedestrian domain [1.6, 7.1] km/h
    const points = buildRealisticMountainTrace({
      startMs,
      count: 140,
      stepS: 30,
      stepLatDeg: 0.00036, // ~40 m per 30s -> ~4.8 km/h
      peakGainM: 480,
      withHr: true,
    });
    const endedAt = points[points.length - 1].t as number;
    const movingS = Math.round((endedAt - startMs) / 1000);
    const profile = resolveActivityProfile('hiking');

    const res = computeSummaryExpertAnalysis({
      profile,
      summary: {
        sport: 'rando',
        startedAt: startMs,
        endedAt,
        distanceM: 5560,
        movingS,
        elevGainM: 480,
      },
      points,
      title: 'Rando Brévent',
      rpe: 7,
      packWeightKg: 6,
      locationLabel: 'Mont-Blanc',
      weather: { temperatureC: 19, windSpeedKmh: 18, humidityPct: 50 },
      historySessions: SAMPLE_HISTORY,
    });

    // 1. Synthèse & LCDA Shapley 6 piliers
    expect(res.lcda.status).toBe('in_domain');
    expect(res.lcda.output).not.toBeNull();
    expect(res.lcda.shapleyPillars).toHaveLength(6);
    expect(res.fatigue.score).toBeGreaterThan(0);
    expect(res.outingFit.fitScore).toBeGreaterThan(0);

    // 2. Relief & montées Cat 1-5
    expect(res.verticality.minAltM).not.toBeNull();
    expect(res.verticality.maxAltM).toBeGreaterThan(1400);
    expect(res.climbs.climbs.length).toBeGreaterThanOrEqual(1);
    expect(res.verticality.slopeBuckets.some((b) => b.distanceKm > 0)).toBe(true);

    // 3. Splits & cadence / HR zones
    expect(res.telemetry.kmSplits.length).toBeGreaterThanOrEqual(5);
    expect(res.telemetry.hrZones).not.toBeNull();

    // 4. Charge canonique & CTL/ATL/TSB Avant -> Après
    expect(res.loadProjection.canonicalLoad.loadUnits).toBeGreaterThan(0);
    expect(res.loadProjection.trainingLoadAfter.status).toBe('available');
    expect(res.loadProjection.deltaAtl).not.toBeNull();
    expect(res.loadProjection.deltaAtl!).toBeGreaterThan(0);
    expect(res.loadProjection.deltaTsb).not.toBeNull();
    expect(res.loadProjection.deltaTsb!).toBeLessThan(0);
    expect(res.loadProjection.projectedTsbAfter).not.toBeNull();
    expect(res.loadProjection.readinessAfter.score).not.toBeNull();

    // 5. NOAA offline & récupération 0-48h
    expect(res.daylight).not.toBeNull();
    expect(res.daylight?.sunriseMs).not.toBeNull();
    expect(res.hydrationLiters).toBeGreaterThanOrEqual(0.5);
    expect(res.recoveryTimeline).toHaveLength(3);

    // 6. Pont IA autorisé sur profil rando standard
    expect(res.aiGuard.allowed).toBe(true);
  });

  it('estime la puissance vélo sans capteur (cycling-physics-v1) avec badge Estimée et bloque le domaine LCDA pédestre', () => {
    const startMs = Date.UTC(2026, 6, 18, 8, 0, 0);
    // ~14 km at ~26 km/h (~32 min) -> cycling physics power + MMP curve + Power Skills
    const points = buildRealisticMountainTrace({
      startMs,
      count: 190,
      stepS: 10,
      stepLatDeg: 0.00065, // ~72 m per 10s -> ~26 km/h
      peakGainM: 220,
      withHr: false,
    });
    const endedAt = points[points.length - 1].t as number;
    const movingS = Math.round((endedAt - startMs) / 1000);
    const profile = resolveActivityProfile('road_cycling');

    const res = computeSummaryExpertAnalysis({
      profile,
      summary: {
        sport: 'velo',
        startedAt: startMs,
        endedAt,
        distanceM: 13_700,
        movingS,
        elevGainM: 220,
      },
      points,
      rpe: 6,
      bodyWeightKg: 72,
    });

    expect(res.telemetry.powerAnalysis.status).toBe('available');
    expect(res.telemetry.powerAnalysis.quality).toBe('estimated');
    expect(res.telemetry.powerAnalysis.method).toBe('cycling-physics-v1');
    expect(res.telemetry.powerAnalysis.averageW).toBeGreaterThan(50);
    expect(res.cycling.powerSkills.status).toBe('available');
    expect(res.lcda.status).toBe('non_pedestrian');
    expect(res.equipmentEco.co2Applicable).toBe(true);
    expect(res.equipmentEco.co2SavedKg).toBeGreaterThan(2);
  });

  it('gère une sortie courte / 0 point GPS / indoor sans crash ni bloc vide', () => {
    const startMs = Date.UTC(2026, 6, 18, 18, 0, 0);
    const endedAt = startMs + 2400 * 1000;
    const profile = resolveActivityProfile('strength_training');

    const res = computeSummaryExpertAnalysis({
      profile,
      summary: {
        sport: 'rando',
        startedAt: startMs,
        endedAt,
        distanceM: 0,
        movingS: 2400,
        elevGainM: 0,
      },
      points: [],
      rpe: 8,
      centerCoords: [2.3522, 48.8566],
    });

    expect(res.gpsAudit.qualityLabel).toBe('Sans trace GPS');
    expect(res.loadProjection.canonicalLoad.tier).toBe('srpe');
    expect(res.loadProjection.canonicalLoad.loadUnits).toBeGreaterThan(0);
    expect(res.loadProjection.fosterAu).toBe(320);
    expect(res.daylight).not.toBeNull();
    expect(res.recoveryTimeline).toHaveLength(3);
    expect(res.hydrationLiters).toBeGreaterThanOrEqual(0.5);
  });

  it('interpole les altitudes DEM par distance cumulée et préserve strictement null sur les trous DEM (C-MET)', () => {
    const pts: SummaryTrackPointInput[] = [
      { lat: 45.0, lng: 6.0, ele: null },
      { lat: 45.0009, lng: 6.0, ele: null }, // ~100 m
      { lat: 45.0018, lng: 6.0, ele: null }, // ~200 m
      { lat: 45.0027, lng: 6.0, ele: null }, // ~300 m
    ];

    const demProfile = {
      points: [
        { d: 0, ele: 1000 },
        { d: 150, ele: 1030 },
        { d: 250, ele: null }, // DEM hole!
        { d: 350, ele: 1080 },
      ],
    };

    const result = interpolateDemElevationOnPoints(pts, demProfile);
    expect(result).toHaveLength(4);
    expect(result[0].ele).toBe(1000);
    // Point at ~100 m sits cleanly between d=0 (1000) and d=150 (1030) -> ~1020
    expect(result[1].ele).toBeGreaterThan(1015);
    expect(result[1].ele).toBeLessThan(1025);
    // Points bracketing the DEM hole (d=250 -> ele=null) MUST stay strictly null
    expect(result[2].ele).toBeNull();
    expect(result[3].ele).toBeNull();
  });

  it('bloque strictement le pont IA sur un profil santé sensible RGPD Art. 9', () => {
    const startMs = Date.UTC(2026, 6, 18, 10, 0, 0);
    const endedAt = startMs + 1800 * 1000;
    const baseProfile = resolveActivityProfile('hiking');
    const rgpdProfile = {
      ...baseProfile,
      privacyAndCompliance: {
        ...baseProfile.privacyAndCompliance,
        rgpdArt9SensitiveHealth: true,
        aiInsightAllowedDefault: false,
      },
    };

    const res = computeSummaryExpertAnalysis({
      profile: rgpdProfile,
      summary: {
        sport: 'rando',
        startedAt: startMs,
        endedAt,
        distanceM: 2000,
        movingS: 1800,
        elevGainM: 30,
      },
      points: [],
      rpe: 4,
    });

    expect(res.aiGuard.allowed).toBe(false);
    if (!res.aiGuard.allowed) {
      expect(res.aiGuard.reason).toBe('rgpd_art9_sensitive');
    }
  });

  it('détecte le dépassement du domaine LCDA en course rapide tout en fournissant GAP Minetti et prédictions Riegel', () => {
    const startMs = Date.UTC(2026, 6, 18, 7, 30, 0);
    // ~5.5 km at ~12 km/h (~27 min) -> out of LCDA [1.6, 7.1] km/h, inside GAP & Riegel!
    const points = buildRealisticMountainTrace({
      startMs,
      count: 110,
      stepS: 15,
      stepLatDeg: 0.00045, // ~50 m per 15s -> ~12 km/h
      peakGainM: 120,
      withHr: true,
    });
    const endedAt = points[points.length - 1].t as number;
    const movingS = Math.round((endedAt - startMs) / 1000);
    const profile = resolveActivityProfile('trail_running');

    const res = computeSummaryExpertAnalysis({
      profile,
      summary: {
        sport: 'trail',
        startedAt: startMs,
        endedAt,
        distanceM: 5450,
        movingS,
        elevGainM: 120,
      },
      points,
      rpe: 7,
      historySessions: SAMPLE_HISTORY,
    });

    expect(res.lcda.status).toBe('out_of_domain_fast');
    expect(res.telemetry.gap?.status).toBe('available');
    expect(res.runningTraceRecords).not.toBeNull();
    expect(res.racePredictions.status).toBe('available');
    expect(res.racePredictions.predictions.length).toBeGreaterThanOrEqual(3);
  });

  it('lit les séries cumulatives calories et pas sans les moyenner et formate proprement durées/allures', () => {
    const startMs = Date.UTC(2026, 6, 18, 9, 0, 0);
    const endedAt = startMs + 3600 * 1000;
    const profile = resolveActivityProfile('hiking');

    const res = computeSummaryExpertAnalysis({
      profile,
      summary: {
        sport: 'rando',
        startedAt: startMs,
        endedAt,
        distanceM: 5000,
        movingS: 3600,
        elevGainM: 200,
        metricSeries: [
          {
            key: 'calories',
            label: 'Énergie',
            unit: 'kcal',
            source: 'sensor',
            quality: 'measured',
            samples: [
              { t: startMs + 600_000, value: 110, source: 'sensor', quality: 'measured' },
              { t: startMs + 1_800_000, value: 260, source: 'sensor', quality: 'measured' },
              { t: endedAt, value: 440, source: 'sensor', quality: 'measured' },
            ],
            stats: {
              count: 3,
              sum: 810,
              min: 110,
              max: 440,
              first: 110,
              last: 440,
              firstT: startMs + 600_000,
              lastT: endedAt,
              weightedSum: 0,
              weightedDurationS: 0,
            },
          },
          {
            key: 'steps',
            label: 'Pas',
            unit: 'pas',
            source: 'sensor',
            quality: 'measured',
            samples: [
              { t: startMs + 1_800_000, value: 3200, source: 'sensor', quality: 'measured' },
              { t: endedAt, value: 6850, source: 'sensor', quality: 'measured' },
            ],
            stats: {
              count: 2,
              sum: 10050,
              min: 3200,
              max: 6850,
              first: 3200,
              last: 6850,
              firstT: startMs + 1_800_000,
              lastT: endedAt,
              weightedSum: 0,
              weightedDurationS: 0,
            },
          },
        ],
      },
      points: [],
      rpe: 5,
    });

    expect(res.telemetry.energyAndSteps.caloriesKcal).toBe(440);
    expect(res.telemetry.energyAndSteps.caloriesQuality).toBe('measured');
    expect(res.telemetry.energyAndSteps.steps).toBe(6850);
    expect(res.telemetry.energyAndSteps.stepsQuality).toBe('measured');

    // Formatter edge cases (C-MET unavailable vs 0, and 59.7s rollover never producing 4:60)
    expect(formatDurationShort(undefined)).toBe('—');
    expect(formatDurationShort(null)).toBe('—');
    expect(formatDurationShort(0)).toBe('0:00');
    expect(formatDurationShort(420)).toBe('7:00');
    expect(formatPaceMinKm(299.7 / 60)).toBe('5:00');
  });
});
