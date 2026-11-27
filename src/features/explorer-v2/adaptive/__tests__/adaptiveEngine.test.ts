import { describe, expect, it } from 'vitest';
import {
  computeEffectiveRidgeWind,
  computeExplorerReadiness,
  computeOfflineDaylight,
  computeSessionLoadUnits,
  computeThermalStress,
  estimateHydrationLiters,
  estimateSafeEta,
  rankContextualItems,
  recommendActivityPreset,
  scoreOutingFit,
  type SessionRecord,
} from '../index';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const NOW_MS = Date.UTC(2026, 5, 21, 10, 0, 0); // 21 juin 2026, 10:00 UTC

function makeSession(
  id: string,
  daysAgo: number,
  overrides: Partial<SessionRecord> = {},
): SessionRecord {
  const endedAtMs = NOW_MS - daysAgo * DAY_MS;
  const movingS = overrides.movingS ?? 5400; // 1h30
  return {
    id,
    sport: 'rando',
    startedAtMs: endedAtMs - movingS * 1000,
    endedAtMs,
    movingS,
    distanceKm: 12,
    elevationGainM: 600,
    elevationLossM: 600,
    maxAltitudeM: 1600,
    ...overrides,
  };
}

describe('Adaptive Performance Engine — Load & Readiness', () => {
  it('returns explicit cold_start with null score and zero mock values when no history or wellness exists', () => {
    const res = computeExplorerReadiness({ sessions: [] }, NOW_MS);
    expect(res.status).toBe('cold_start');
    expect(res.score).toBeNull();
    expect(res.band).toBeNull();
    expect(res.confidence).toBe(0);
    expect(res.acwr.rawRatio).toBeNull();
    expect(res.acwr.dampedRatio).toBeNull();
    expect(res.acwr.zone).toBe('insufficient_data');
    expect(res.aerobicEnduranceIndex).toBeNull();
    expect(res.wellnessScore).toBeNull();
  });

  it('respects the 4-tier session load hierarchy (Power TSS > HR Relative Effort > sRPE > GPS Ke)', () => {
    const base = makeSession('t1', 1, {
      sport: 'velo',
      movingS: 3600,
      distanceKm: 30,
      elevationGainM: 400,
      normalizedPowerW: 250,
      ftpW: 250,
      hrRelativeEffort: 180,
      rpe: 8,
    });
    const t1 = computeSessionLoadUnits(base);
    expect(t1.tier).toBe('power_tss');
    expect(t1.loadUnits).toBeCloseTo(100, 0);

    const t2 = computeSessionLoadUnits({ ...base, normalizedPowerW: null, ftpW: null });
    expect(t2.tier).toBe('hr_relative_effort');
    expect(t2.loadUnits).toBeCloseTo(90, 0);

    const t3 = computeSessionLoadUnits({
      ...base,
      normalizedPowerW: null,
      ftpW: null,
      hrRelativeEffort: null,
    });
    expect(t3.tier).toBe('srpe');
    expect(t3.loadUnits).toBeGreaterThan(90);

    const t4 = computeSessionLoadUnits({
      ...base,
      sport: 'rando',
      normalizedPowerW: null,
      ftpW: null,
      hrRelativeEffort: null,
      rpe: null,
      distanceKm: 15,
      elevationGainM: 900,
      elevationLossM: 900,
    });
    expect(t4.tier).toBe('gps_mechanical_ke');
    expect(t4.effortScoreKe).toBeGreaterThan(20);
    expect(t4.eccentricLoadUnits).toBeGreaterThan(30);
  });

  it('distinguishes ACWR sweet spot from ACWR spike and applies Bühlmann cold-start damping', () => {
    // 28 jours réguliers (1 séance tous les 2 jours) -> sweet_spot
    const steadySessions: SessionRecord[] = [];
    for (let d = 27; d >= 1; d -= 2) {
      steadySessions.push(makeSession(`steady-${d}`, d, { rpe: 5, movingS: 4500 }));
    }
    const steady = computeExplorerReadiness({ sessions: steadySessions }, NOW_MS);
    expect(steady.status).toBe('calibrated');
    expect(steady.acwr.zone).toBe('sweet_spot');
    expect(steady.acwr.dampedRatio).not.toBeNull();
    expect(steady.acwr.dampedRatio!).toBeGreaterThanOrEqual(0.75);
    expect(steady.acwr.dampedRatio!).toBeLessThanOrEqual(1.3);
    expect(steady.score!).toBeGreaterThanOrEqual(65);

    // 3 semaines très légères puis surcharge brutale sur les 4 derniers jours -> spike
    const spikeSessions: SessionRecord[] = [];
    for (let d = 27; d >= 7; d -= 3) {
      spikeSessions.push(makeSession(`base-${d}`, d, { rpe: 2, movingS: 1800 }));
    }
    for (let d = 4; d >= 0; d -= 1) {
      spikeSessions.push(
        makeSession(`overload-${d}`, d, {
          sport: 'trail',
          rpe: 9,
          movingS: 10800,
          distanceKm: 26,
          elevationGainM: 1700,
          elevationLossM: 1700,
        }),
      );
    }
    const spike = computeExplorerReadiness({ sessions: spikeSessions }, NOW_MS);
    expect(spike.acwr.zone).toBe('spike');
    expect(spike.acwr.dampedRatio!).toBeGreaterThan(1.5);
    expect(spike.score!).toBeLessThan(steady.score!);
    expect(spike.eccentricDomsScore).toBeGreaterThan(40);

    // Cold-start Bühlmann damping : 2 jours actifs amortissent rawRatio vers 1.0
    const sparse = computeExplorerReadiness(
      {
        sessions: [
          makeSession('s-1', 10, { rpe: 2, movingS: 1200 }),
          makeSession('s-2', 0, { rpe: 9, movingS: 10800 }),
        ],
      },
      NOW_MS,
    );
    expect(sparse.status).toBe('partial');
    expect(sparse.acwr.credibilityWeight).toBeLessThan(0.35);
    expect(Math.abs(sparse.acwr.dampedRatio! - 1)).toBeLessThan(
      Math.abs(sparse.acwr.rawRatio! - 1),
    );
  });

  it('caps readiness and switches to rehab_guarded when rehab pain >= 7', () => {
    const res = computeExplorerReadiness(
      {
        sessions: [makeSession('r1', 2, { rpe: 3, movingS: 2400 })],
        wellness: {
          recordedAtMs: NOW_MS - 2 * HOUR_MS,
          sleepHours: 8.5,
          sleepQuality: 5,
          subjectiveEnergy: 5,
          rehabPainLevel: 8,
          rehabBodyZone: 'genou droit',
        },
      },
      NOW_MS,
    );
    expect(res.rehabPainCapApplied).toBe(true);
    expect(res.activeRehabPainLevel).toBe(8);
    expect(res.score).toBeLessThanOrEqual(28);
    expect(res.band).toBe('rehab_guarded');
  });

  it('elevates 21-day altitude acclimatization ceiling and attenuates hypoxic Safe ETA penalty', () => {
    const acclimated = computeExplorerReadiness(
      {
        sessions: [
          makeSession('alt-1', 3, { maxAltitudeM: 3450, movingS: 14400 }),
          makeSession('alt-2', 8, { maxAltitudeM: 3200, movingS: 12600 }),
          makeSession('alt-3', 14, { maxAltitudeM: 3100, movingS: 10800 }),
        ],
      },
      NOW_MS,
    );
    const seaLevel = computeExplorerReadiness(
      {
        sessions: [
          makeSession('low-1', 3, { maxAltitudeM: 400, movingS: 14400 }),
          makeSession('low-2', 8, { maxAltitudeM: 450, movingS: 12600 }),
        ],
      },
      NOW_MS,
    );

    expect(acclimated.altitudeAcclimatization.ceilingM).toBeGreaterThan(2800);
    expect(acclimated.altitudeAcclimatization.attenuationFactor).toBeGreaterThan(0.3);
    expect(seaLevel.altitudeAcclimatization.ceilingM).toBe(1800);

    const routeBase = {
      activity: 'rando' as const,
      distanceKm: 14,
      elevationGainM: 1100,
      maxAltitudeM: 3300,
      meanAltitudeM: 2800,
      lat: 45.899,
      lng: 6.129,
      departureAtMs: Date.UTC(2026, 6, 15, 6, 0, 0),
    };

    const etaAcclimated = estimateSafeEta({ ...routeBase, readiness: acclimated });
    const etaSeaLevel = estimateSafeEta({ ...routeBase, readiness: seaLevel });

    expect(etaAcclimated.multipliers.altitudeAttenuated).toBeLessThan(1.0);
    expect(etaSeaLevel.flags).toContain('high_altitude_unacclimatized');
    expect(etaAcclimated.adjustedDurationHoursP50).toBeLessThan(
      etaSeaLevel.adjustedDurationHoursP50,
    );
  });
});

describe('Adaptive Environment — Offline NOAA Daylight & Physics', () => {
  it('computes accurate offline NOAA sunrise, sunset and civil twilight for Annecy in summer', () => {
    const summerSolstice = Date.UTC(2026, 5, 21, 12, 0, 0);
    const dl = computeOfflineDaylight(45.8992, 6.1294, summerSolstice);
    expect(dl.status).toBe('normal');
    expect(dl.sunriseMs).not.toBeNull();
    expect(dl.sunsetMs).not.toBeNull();
    expect(dl.civilDawnMs).not.toBeNull();
    expect(dl.civilDuskMs).not.toBeNull();
    expect(dl.civilDawnMs!).toBeLessThan(dl.sunriseMs!);
    expect(dl.civilDuskMs!).toBeGreaterThan(dl.sunsetMs!);
    // Annecy au solstice d'été : ~15.5 à 16 h de jour
    expect(dl.daylightHours).toBeGreaterThan(15.2);
    expect(dl.daylightHours).toBeLessThan(16.2);
  });

  it('handles polar day (midnight sun) and polar night cleanly at 70°N (Tromsø)', () => {
    const juneDay = computeOfflineDaylight(69.6492, 18.9553, Date.UTC(2026, 5, 21, 12, 0, 0));
    expect(juneDay.status).toBe('polar_day');
    expect(juneDay.sunriseMs).toBeNull();
    expect(juneDay.sunsetMs).toBeNull();
    expect(juneDay.daylightHours).toBe(24);

    const decNight = computeOfflineDaylight(69.6492, 18.9553, Date.UTC(2026, 11, 21, 12, 0, 0));
    expect(decNight.status).toBe('polar_night');
    expect(decNight.sunriseMs).toBeNull();
    expect(decNight.sunsetMs).toBeNull();
    expect(decNight.daylightHours).toBe(0);
  });

  it('computes ridge wind, thermal stress and hydration accurately', () => {
    const wind = computeEffectiveRidgeWind(45, 2800, true, 65);
    expect(wind.effectiveWindKmh).toBeGreaterThan(70);
    expect(wind.hazardLevel).toBe('storm');

    const cold = computeThermalStress({ temperatureC: -8, windSpeedKmh: 35 }, 45);
    expect(cold.level).toBe('cold_extreme');
    expect(cold.windChillC!).toBeLessThan(-18);

    const hot = computeThermalStress({ temperatureC: 34, humidityPct: 65 });
    expect(hot.level).toBe('heat_extreme');
    expect(hot.hydrationMultiplier).toBeGreaterThan(1.5);

    const liters = estimateHydrationLiters({
      durationHours: 4,
      elevationGainM: 1000,
      maxAltitudeM: 2500,
      weather: { temperatureC: 33, humidityPct: 60 },
    });
    expect(liters).toBeGreaterThan(3.5);
  });
});

describe('Safe ETA & Hard Safety Vetoes (Outing Fit)', () => {
  const readyState = computeExplorerReadiness(
    {
      sessions: [
        makeSession('f1', 2, { rpe: 5 }),
        makeSession('f2', 5, { rpe: 5 }),
        makeSession('f3', 9, { rpe: 5 }),
      ],
    },
    NOW_MS,
  );

  it('widens P90 by +8% offline and computes turnaround before civil dusk', () => {
    const common = {
      activity: 'rando' as const,
      distanceKm: 16,
      elevationGainM: 1000,
      lat: 45.899,
      lng: 6.129,
      departureAtMs: Date.UTC(2026, 9, 25, 13, 0, 0), // départ tardif en octobre
      readiness: readyState,
    };
    const online = estimateSafeEta({ ...common, offline: false });
    const offline = estimateSafeEta({ ...common, offline: true });

    expect(offline.multipliers.offlineP90Spread).toBe(1.08);
    expect(offline.flags).toContain('offline_uncertainty');
    expect(offline.adjustedDurationHoursP90).toBeGreaterThan(online.adjustedDurationHoursP90);
    expect(offline.flags).toContain('darkness_risk');
    expect(offline.turnaroundAtMs).not.toBeNull();
  });

  it('triggers hard veto (fitScore <= 25, not_recommended) for darkness without headlamp', () => {
    const lateEta = estimateSafeEta({
      activity: 'rando',
      distanceKm: 15,
      elevationGainM: 900,
      lat: 45.899,
      lng: 6.129,
      departureAtMs: Date.UTC(2026, 10, 20, 14, 30, 0),
      readiness: readyState,
    });
    expect(lateEta.flags).toContain('darkness_risk');

    const fit = scoreOutingFit({
      safeEta: lateEta,
      readiness: readyState,
      gear: { hasHeadlamp: false, hasWaterFilterOrCapacityL: 2.5 },
    });
    expect(fit.vetoed).toBe(true);
    expect(fit.vetoes).toContain('darkness_no_headlamp');
    expect(fit.fitScore).toBeLessThanOrEqual(25);
    expect(fit.verdict).toBe('not_recommended');
    expect(fit.gearDeltas.some((d) => d.itemId === 'headlamp' && d.severity === 'critical')).toBe(
      true,
    );
  });

  it('triggers hard veto for missing avalanche kit on snowy terrain with BRA >= 3', () => {
    const snowEta = estimateSafeEta({
      activity: 'ski',
      distanceKm: 12,
      elevationGainM: 1000,
      maxAltitudeM: 2600,
      lat: 45.899,
      lng: 6.129,
      departureAtMs: Date.UTC(2026, 1, 10, 7, 30, 0),
      surface: 'snow',
      weather: { temperatureC: -3, avalancheRiskLevel: 3 },
      readiness: readyState,
    });

    const fit = scoreOutingFit({
      safeEta: snowEta,
      readiness: readyState,
      surface: 'snow',
      weather: { temperatureC: -3, avalancheRiskLevel: 3 },
      gear: { hasAvalancheKit: false, hasHeadlamp: true, hasThermalLayer: true },
    });
    expect(fit.vetoed).toBe(true);
    expect(fit.vetoes).toContain('avalanche_no_kit');
    expect(fit.fitScore).toBeLessThanOrEqual(25);
    expect(fit.verdict).toBe('not_recommended');
  });

  it('triggers hard veto when rehab pain >= 7 and keeps equipment null when gear is omitted', () => {
    const rehabReadiness = computeExplorerReadiness(
      {
        sessions: [makeSession('rh1', 1, { rehabPainLevel: 7 })],
      },
      NOW_MS,
    );
    const easyEta = estimateSafeEta({
      activity: 'rando',
      distanceKm: 6,
      elevationGainM: 150,
      lat: 45.899,
      lng: 6.129,
      departureAtMs: Date.UTC(2026, 5, 21, 8, 0, 0),
      readiness: rehabReadiness,
    });

    const fit = scoreOutingFit({
      safeEta: easyEta,
      readiness: rehabReadiness,
      gear: null,
    });
    expect(fit.subScores.equipment).toBeNull();
    expect(fit.vetoed).toBe(true);
    expect(fit.vetoes).toContain('rehab_pain_high');
    expect(fit.fitScore).toBeLessThanOrEqual(25);
    expect(fit.verdict).toBe('not_recommended');
  });
});

describe('Activity Preset & Adaptive HUD Cognitive Load Switching', () => {
  const ready = computeExplorerReadiness(
    {
      sessions: [
        makeSession('p1', 1, { rpe: 5 }),
        makeSession('p2', 4, { rpe: 5 }),
        makeSession('p3', 7, { rpe: 5 }),
      ],
    },
    NOW_MS,
  );

  it('switches HUD density cleanly across high-speed, technical, expedition and standard scenarios', () => {
    const fastBike = recommendActivityPreset({
      readiness: ready,
      preferredSport: 'velo',
      expectedSpeedKmh: 28,
    });
    expect(fastBike.hud.profile).toBe('minimal_high_speed');
    expect(fastBike.hud.maxPrimaryMetrics).toBe(2);
    expect(fastBike.autoPauseConfig.enabled).toBe(true);
    expect(fastBike.autoPauseConfig.durationS).toBe(30);

    const tacticalAlpine = recommendActivityPreset({
      readiness: ready,
      preferredSport: 'rando',
      technicalGrade: 'T5',
      activeHazardCount: 2,
      isNight: true,
      expectedSpeedKmh: 3.5,
    });
    expect(tacticalAlpine.hud.profile).toBe('tactical_technical');
    expect(tacticalAlpine.hud.showCompass).toBe(true);
    expect(tacticalAlpine.hud.showHazardBanner).toBe(true);

    const calmBivouac = recommendActivityPreset({
      readiness: ready,
      preferredSport: 'bivouac',
      technicalGrade: 'T1',
      activeHazardCount: 0,
      isNight: false,
      expectedSpeedKmh: 3.8,
    });
    expect(calmBivouac.hud.profile).toBe('expedition_rich');
    expect(calmBivouac.hud.maxPrimaryMetrics).toBe(5);

    const normalTrail = recommendActivityPreset({
      readiness: ready,
      preferredSport: 'trail',
      technicalGrade: 'T2',
      expectedSpeedKmh: 10.5,
    });
    expect(normalTrail.hud.profile).toBe('standard');
    expect(normalTrail.hud.maxPrimaryMetrics).toBe(4);
  });
});

describe('4-Pillar Contextual Ranker & ROUTE_CATALOG_SPORT Zero-Mock Invariant', () => {
  it('excludes hiking catalog routes when another sport is explicitly requested', () => {
    const result = rankContextualItems({
      userLat: 45.899,
      userLng: 6.129,
      requestedSport: 'velo',
      items: [
        {
          id: 'osm-hike-1',
          kind: 'route',
          title: 'GR 96 · Tour du Lac',
          sport: null,
          lat: 45.901,
          lng: 6.13,
          fitScore: 92,
        },
        {
          id: 'osm-hike-2',
          kind: 'route',
          title: 'Sentier du Semnoz',
          sport: 'rando',
          lat: 45.895,
          lng: 6.125,
          fitScore: 88,
        },
        {
          id: 'pokedex-1',
          kind: 'pokedex_species',
          title: 'Gypaète barbu',
          lat: 45.91,
          lng: 6.15,
          pokedexNovelty: true,
          pokedexRarity: 'threatened',
        },
      ],
    });

    expect(result.filteredOutRoutesCount).toBe(2);
    expect(result.routeCatalogNoteFr).toContain('velo');
    expect(result.ranked.map((r) => r.item.id)).toEqual(['pokedex-1']);
  });

  it('fuses the 4 pillars and demotes vetoed items to the bottom', () => {
    const result = rankContextualItems({
      userLat: 45.899,
      userLng: 6.129,
      requestedSport: 'rando',
      items: [
        {
          id: 'vetoed-route',
          kind: 'route',
          title: 'Arête exposée sous orage',
          sport: 'rando',
          lat: 45.9,
          lng: 6.13,
          fitScore: 20,
          vetoed: true,
          fromJoinedClub: true,
        },
        {
          id: 'rich-4pillar',
          kind: 'route',
          title: 'Crête des Bauges inexplorée',
          sport: 'rando',
          lat: 45.905,
          lng: 6.135,
          fitScore: 90,
          fogOfWarUnvisited: true,
          matchesRoutineTime: true,
          fromJoinedClub: true,
          friendsCount: 2,
          hasCarnetEntry: true,
          pokedexNovelty: true,
          pokedexRarity: 'rare',
        },
        {
          id: 'plain-far',
          kind: 'route',
          title: 'Boucle lointaine',
          sport: 'rando',
          lat: 46.12,
          lng: 6.4,
          fitScore: 60,
        },
      ],
    });

    expect(result.filteredOutRoutesCount).toBe(0);
    expect(result.ranked[0]!.item.id).toBe('rich-4pillar');
    expect(result.ranked[result.ranked.length - 1]!.item.id).toBe('vetoed-route');
    expect(result.ranked[result.ranked.length - 1]!.totalScore).toBeLessThanOrEqual(18);
  });
});
