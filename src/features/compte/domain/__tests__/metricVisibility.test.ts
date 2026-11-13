import { describe, expect, it } from 'vitest';
import {
  ALL_OUTING_METRICS,
  NO_OUTING_METRICS,
  OUTING_METRIC_KEYS,
  SHARED_SUMMARY_METRICS,
  averagePaceMinPerKm,
  isOutingMetricVisible,
  metricVisibilityFromKeys,
  movingTimeSeconds,
  observedMaxAltitudeM,
  parseMetricVisibility,
  projectOutingMetrics,
  projectTraceMetrics,
  resolveOutingMetricVisibility,
} from '../metricVisibility';

const VALUES = {
  distanceKm: 8.2,
  elevationGainM: 600,
  maxAltitudeM: 1800,
  durationS: 14400,
  paceMinPerKm: 29.268,
  movingTimeS: 10800,
  heartRateBpm: 142,
  powerW: 210,
  cadenceRpm: 84,
  caloriesKcal: 720,
};

describe('resolveOutingMetricVisibility — droits et défauts', () => {
  it('accorde toutes les métriques au propriétaire et au participant', () => {
    expect(resolveOutingMetricVisibility({ viewer: 'owner' })).toEqual(ALL_OUTING_METRICS);
    expect(
      resolveOutingMetricVisibility({
        viewer: 'participant',
        visibility: 'private',
        policy: { distance: false },
      })
    ).toEqual(ALL_OUTING_METRICS);
  });

  it('ferme tout pour un visiteur d’une sortie privée ou inconnue', () => {
    for (const visibility of ['private', null, undefined, '', 'collective']) {
      expect(resolveOutingMetricVisibility({ viewer: 'visitor', visibility })).toEqual(
        NO_OUTING_METRICS
      );
    }
  });

  it('ne publie que le socle agrégé pour un partage explicite', () => {
    expect(
      resolveOutingMetricVisibility({
        viewer: 'visitor',
        visibility: 'collective_anonymized',
      })
    ).toEqual(SHARED_SUMMARY_METRICS);
    expect(isOutingMetricVisible(SHARED_SUMMARY_METRICS, 'pace')).toBe(false);
    expect(isOutingMetricVisible(SHARED_SUMMARY_METRICS, 'heartRate')).toBe(false);
    expect(isOutingMetricVisible(SHARED_SUMMARY_METRICS, 'distance')).toBe(true);
  });

  it('accorde le socle à un abonné vérifié, jamais à un simple visiteur', () => {
    expect(
      resolveOutingMetricVisibility({ viewer: 'follower', visibility: 'friends' })
    ).toEqual(SHARED_SUMMARY_METRICS);
    expect(
      resolveOutingMetricVisibility({ viewer: 'follower', visibility: 'followers' })
    ).toEqual(SHARED_SUMMARY_METRICS);
    expect(
      resolveOutingMetricVisibility({ viewer: 'visitor', visibility: 'friends' })
    ).toEqual(NO_OUTING_METRICS);
  });

  it('applique une politique persistée stricte, sans compléter les clés absentes', () => {
    expect(
      resolveOutingMetricVisibility({
        viewer: 'visitor',
        visibility: 'collective_anonymized',
        policy: { pace: true },
      })
    ).toEqual(parseMetricVisibility({ pace: true }));
    expect(
      resolveOutingMetricVisibility({
        viewer: 'visitor',
        visibility: 'collective_anonymized',
        policy: {},
      })
    ).toEqual(NO_OUTING_METRICS);
  });
});

describe('parseMetricVisibility — liste fermée', () => {
  it('n’accorde que des booléens stricts', () => {
    const parsed = parseMetricVisibility({
      distance: true,
      pace: 'true',
      power: 1,
      heartRate: null,
      unknown: true,
    });
    expect(parsed.distance).toBe(true);
    expect(parsed.pace).toBe(false);
    expect(parsed.power).toBe(false);
    expect(parsed.heartRate).toBe(false);
  });

  it('échoue fermé sur un tableau, une chaîne ou une valeur nulle', () => {
    for (const value of [[], 'distance', null, undefined, 42]) {
      expect(parseMetricVisibility(value)).toEqual(NO_OUTING_METRICS);
    }
  });

  it('construit une politique depuis une sélection de clés connues', () => {
    const visibility = metricVisibilityFromKeys(['distance', 'pace', 'inconnue', 42]);
    expect(visibility.distance).toBe(true);
    expect(visibility.pace).toBe(true);
    expect(visibility.power).toBe(false);
    expect(OUTING_METRIC_KEYS.every((key) => typeof visibility[key] === 'boolean')).toBe(true);
  });
});

describe('projectOutingMetrics — valeurs masquées', () => {
  it('rend toutes les valeurs au propriétaire', () => {
    const projected = projectOutingMetrics(VALUES, ALL_OUTING_METRICS);
    expect(projected).toMatchObject(VALUES);
    expect(projected.masked).toBe(false);
    expect(projected.hidden).toEqual([]);
  });

  it('retire l’allure, le temps en mouvement et les données biométriques du socle', () => {
    const projected = projectOutingMetrics(VALUES, SHARED_SUMMARY_METRICS);
    expect(projected.distanceKm).toBe(8.2);
    expect(projected.durationS).toBe(14400);
    expect(projected.paceMinPerKm).toBeNull();
    expect(projected.movingTimeS).toBeNull();
    expect(projected.heartRateBpm).toBeNull();
    expect(projected.powerW).toBeNull();
    expect(projected.masked).toBe(true);
    expect(projected.hidden).toContain('pace');
  });

  it('ne publie jamais NaN ni Infinity, même quand la métrique est visible', () => {
    const projected = projectOutingMetrics(
      { ...VALUES, distanceKm: Number.NaN, durationS: Number.POSITIVE_INFINITY },
      ALL_OUTING_METRICS
    );
    expect(projected.distanceKm).toBeNull();
    expect(projected.durationS).toBeNull();
  });
});

describe('projectTraceMetrics — métadonnées de trace', () => {
  const points = [
    { lat: 45.8, lng: 6.8, elevationM: 1000, timestamp: '2026-11-01T08:00:00Z' },
    { lat: 45.81, lng: 6.8, elevationM: 1100, timestamp: '2026-11-01T08:05:00Z' },
  ];

  it('conserve altitude et heure quand toutes les métriques liées sont visibles', () => {
    const projected = projectTraceMetrics([points], ALL_OUTING_METRICS);
    expect(projected.elevationExposed).toBe(true);
    expect(projected.timingExposed).toBe(true);
    expect(projected.segments[0][0].elevationM).toBe(1000);
    expect(projected.segments[0][0].timestamp).toBe('2026-11-01T08:00:00Z');
  });

  it('retire l’altitude si une seule métrique d’altitude est masquée', () => {
    const projected = projectTraceMetrics(
      [points],
      { ...ALL_OUTING_METRICS, maxAltitude: false }
    );
    expect(projected.elevationExposed).toBe(false);
    expect(projected.segments.flat().every((point) => point.elevationM === null)).toBe(true);
    /* Les coordonnées restent intactes : le masquage géométrique est distinct. */
    expect(projected.segments[0][0].lat).toBe(45.8);
  });

  it('retire l’heure si une seule métrique temporelle est masquée', () => {
    const projected = projectTraceMetrics(
      [points],
      { ...ALL_OUTING_METRICS, movingTime: false }
    );
    expect(projected.timingExposed).toBe(false);
    expect(projected.segments.flat().every((point) => point.timestamp === null)).toBe(true);
  });

  it('échoue fermé sans politique : rien de temporel ni d’altimétrique', () => {
    const projected = projectTraceMetrics([points], undefined);
    expect(projected.elevationExposed).toBe(false);
    expect(projected.timingExposed).toBe(false);
    expect(projected.masked).toBe(true);
  });
});

describe('calculs d’effort', () => {
  it('somme les intervalles courts et ignore les pauses de dix minutes ou plus', () => {
    const points = [
      { timestamp: '2026-11-01T08:00:00Z' },
      { timestamp: '2026-11-01T08:05:00Z' },
      { timestamp: '2026-11-01T08:20:00Z' },
      { timestamp: '2026-11-01T08:25:00Z' },
    ];
    expect(movingTimeSeconds(points)).toBe(600);
  });

  it('ne fabrique pas de temps en mouvement sans deux heures valides', () => {
    expect(movingTimeSeconds([])).toBeNull();
    expect(movingTimeSeconds([{ timestamp: '2026-11-01T08:00:00Z' }])).toBeNull();
    expect(
      movingTimeSeconds([
        { timestamp: '2026-11-01T08:00:00Z' },
        { timestamp: 'pas-une-date' },
      ])
    ).toBeNull();
  });

  it('calcule l’allure seulement depuis des valeurs positives finies', () => {
    expect(averagePaceMinPerKm(14400, 8)).toBe(30);
    expect(averagePaceMinPerKm(null, 8)).toBeNull();
    expect(averagePaceMinPerKm(14400, 0)).toBeNull();
    expect(averagePaceMinPerKm(Number.NaN, 8)).toBeNull();
  });

  it('observe l’altitude max sans inventer de valeur', () => {
    expect(
      observedMaxAltitudeM([
        { elevationM: 1200 },
        { elevationM: null },
        { elevationM: 1800 },
      ])
    ).toBe(1800);
    expect(observedMaxAltitudeM([{ elevationM: null }])).toBeNull();
  });
});
