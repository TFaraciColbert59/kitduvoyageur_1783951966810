/**
 * S2.37 — faits d'une sortie, construits uniquement depuis la ligne
 * `hike_sessions` autorisée. Aucune métrique n'est déduite d'un capteur
 * absent : la fréquence cardiaque, les calories et les splits ne sont pas
 * stockés par le pipeline actuel et restent explicitement `absent`.
 */

import {
  AI_ASSISTANT_CONTRACT_VERSION,
  absent,
  calculated,
  declared,
  formatDurationFr,
  formatNumberFr,
  formatPaceFr,
  hasValue,
  measured,
  numericDataPoint,
  type DataCitation,
  type DataPoint,
} from '../contracts';

/** Ligne minimale lue après vérification du propriétaire. */
export interface HikeSessionRecord {
  id: string;
  user_id?: string | null;
  route_id?: number | string | null;
  started_at: string;
  ended_at: string | null;
  distance_km?: number | string | null;
  duration_seconds?: number | string | null;
  elevation_gain_m?: number | string | null;
  max_altitude_m?: number | string | null;
  title?: string | null;
  visibility?: string | null;
  weather?: unknown;
  track_quality?: unknown;
  poi_events?: unknown;
  route_name?: string | null;
  region?: string | null;
}

export interface ActivityWeather {
  condition: string | null;
  temperatureC: number | null;
  windKmh: number | null;
  precipitationProbability: number | null;
}

export interface ActivityMetrics {
  distanceKm: DataPoint<number>;
  durationSeconds: DataPoint<number>;
  elapsedSeconds: DataPoint<number>;
  elevationGainM: DataPoint<number>;
  maxAltitudeM: DataPoint<number>;
  averageSpeedKmh: DataPoint<number>;
  averagePaceSecondsPerKm: DataPoint<number>;
  poiCount: DataPoint<number>;
  weather: DataPoint<ActivityWeather>;
  heartRateBpm: DataPoint<number>;
  caloriesKcal: DataPoint<number>;
  splits: DataPoint<number>;
}

export interface ActivityFacts {
  contractVersion: string;
  session: {
    id: string;
    startedAt: string;
    endedAt: string | null;
    title: string | null;
    visibility: string | null;
    routeName: string | null;
    region: string | null;
  };
  metrics: ActivityMetrics;
  /** Faits absents, avec la raison exacte (jamais « 0 » à la place). */
  missing: DataCitation[];
  /** Faits disponibles, prêts à être cités par le récit déterministe. */
  citations: DataCitation[];
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * La météo est un JSON libre dans `hike_sessions.weather`. On ne lit que des
 * champs connus ; un objet non reconnu devient `absent`, pas une invention.
 */
export function readActivityWeather(value: unknown): ActivityWeather | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const condition =
    stringOrNull(row.condition) ??
    stringOrNull(row.summary) ??
    stringOrNull(row.description) ??
    stringOrNull(row.weather);
  const temperatureC =
    numberOrNull(row.tempC) ??
    numberOrNull(row.temperatureC) ??
    numberOrNull(row.temperature_c) ??
    numberOrNull(row.temp);
  const windKmh =
    numberOrNull(row.windKmH) ??
    numberOrNull(row.windKmh) ??
    numberOrNull(row.wind_kmh) ??
    numberOrNull(row.wind);
  const precipitationProbability =
    numberOrNull(row.precipitationProbability) ??
    numberOrNull(row.precipitation_probability) ??
    numberOrNull(row.precipitation);

  if (condition === null && temperatureC === null && windKmh === null && precipitationProbability === null) {
    return null;
  }
  return { condition, temperatureC, windKmh, precipitationProbability };
}

function citation(
  field: string,
  label: string,
  point: DataPoint<number>,
  format: (value: number) => string
): DataCitation {
  return {
    field,
    label,
    value: hasValue(point) ? format(point.value) : null,
    status: point.status,
    source: point.source,
  };
}

function absentCitation(field: string, label: string, point: DataPoint<unknown>): DataCitation {
  return {
    field,
    label,
    value: null,
    status: 'absent',
    source: point.source,
  };
}

export function buildActivityFacts(session: HikeSessionRecord): ActivityFacts {
  const distance = numericDataPoint(session.distance_km, {
    status: 'measured',
    source: 'hike_sessions.distance_km',
    unit: 'km',
    absentReason: 'distance non enregistrée pour cette sortie',
  });
  const duration = numericDataPoint(session.duration_seconds, {
    status: 'measured',
    source: 'hike_sessions.duration_seconds (durée de séance)',
    unit: 's',
    absentReason: 'durée non enregistrée pour cette sortie',
  });
  const elevation = numericDataPoint(session.elevation_gain_m, {
    status: 'measured',
    source: 'hike_sessions.elevation_gain_m',
    unit: 'm',
    absentReason: 'dénivelé positif non enregistré pour cette sortie',
  });
  const maxAltitude = numericDataPoint(session.max_altitude_m, {
    status: 'measured',
    source: 'hike_sessions.max_altitude_m',
    unit: 'm',
    absentReason: 'altitude maximale non enregistrée pour cette sortie',
  });

  const startedAt = parseTimestamp(session.started_at);
  const endedAt = parseTimestamp(session.ended_at);
  const elapsedSeconds =
    startedAt !== null && endedAt !== null && endedAt >= startedAt
      ? calculated((endedAt - startedAt) / 1000, 'calculé : ended_at − started_at', 's')
      : absent<number>('horodatages de début et de fin incomplets');

  const averageSpeedKmh =
    hasValue(distance) && hasValue(duration) && distance.value > 0 && duration.value > 0
      ? calculated(
          distance.value / (duration.value / 3600),
          'calculé : distance ÷ durée de séance',
          'km/h'
        )
      : absent<number>('vitesse moyenne non calculable sans distance et durée valides');

  const averagePaceSecondsPerKm =
    hasValue(distance) && hasValue(duration) && distance.value > 0 && duration.value > 0
      ? calculated(
          duration.value / distance.value,
          'calculé : durée de séance ÷ distance',
          's/km'
        )
      : absent<number>('allure moyenne non calculable sans distance et durée valides');

  const poiCount = Array.isArray(session.poi_events)
    ? measured(session.poi_events.length, 'hike_sessions.poi_events', 'points')
    : absent<number>('points de passage non enregistrés');

  const weatherFacts = readActivityWeather(session.weather);
  const weather = weatherFacts
    ? declared(weatherFacts, 'hike_sessions.weather')
    : absent<ActivityWeather>('météo absente ou non exploitable pour cette sortie');

  const heartRateBpm = absent<number>(
    'aucune ceinture cardio connectée : LKDV n’invente pas de fréquence cardiaque',
    'hike_sessions (aucune mesure cardio)'
  );
  const caloriesKcal = absent<number>(
    'aucune mesure de dépense énergétique enregistrée pour cette sortie',
    'hike_sessions (aucune mesure calorique)'
  );
  const splits = absent<number>(
    'splits non persistés dans hike_sessions : aucun découpage à afficher',
    'hike_sessions (aucun split)'
  );

  const citations: DataCitation[] = [
    citation('metrics.distanceKm', 'Distance', distance, (value) => `${formatNumberFr(value, 2)} km`),
    citation('metrics.durationSeconds', 'Durée', duration, (value) => formatDurationFr(value)),
    citation('metrics.elapsedSeconds', 'Temps écoulé', elapsedSeconds, (value) => formatDurationFr(value)),
    citation('metrics.elevationGainM', 'Dénivelé positif', elevation, (value) => `${formatNumberFr(value, 0)} m`),
    citation('metrics.maxAltitudeM', 'Altitude maximale', maxAltitude, (value) => `${formatNumberFr(value, 0)} m`),
    citation('metrics.averageSpeedKmh', 'Vitesse moyenne', averageSpeedKmh, (value) => `${formatNumberFr(value, 1)} km/h`),
    citation(
      'metrics.averagePaceSecondsPerKm',
      'Allure moyenne (durée totale)',
      averagePaceSecondsPerKm,
      (value) => formatPaceFr(value)
    ),
    citation('metrics.poiCount', 'Points de passage', poiCount, (value) => `${formatNumberFr(value, 0)}`),
  ].filter((entry) => entry.status !== 'absent');

  if (hasValue(weather)) {
    const weatherValue = weather.value;
    const label = [
      weatherValue.condition,
      weatherValue.temperatureC !== null ? `${formatNumberFr(weatherValue.temperatureC, 0)} °C` : null,
      weatherValue.windKmh !== null ? `${formatNumberFr(weatherValue.windKmh, 0)} km/h de vent` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    citations.push({
      field: 'metrics.weather',
      label: 'Météo',
      value: label.length > 0 ? label : null,
      status: weather.status,
      source: weather.source,
    });
  }

  const missing: DataCitation[] = [
    absentCitation('metrics.elevationGainM', 'Dénivelé positif', elevation),
    absentCitation('metrics.maxAltitudeM', 'Altitude maximale', maxAltitude),
    absentCitation('metrics.weather', 'Météo', weather),
    absentCitation('metrics.heartRateBpm', 'Fréquence cardiaque', heartRateBpm),
    absentCitation('metrics.caloriesKcal', 'Calories', caloriesKcal),
    absentCitation('metrics.splits', 'Splits', splits),
  ].filter((entry) => entry.status === 'absent');

  return {
    contractVersion: AI_ASSISTANT_CONTRACT_VERSION,
    session: {
      id: session.id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      title: stringOrNull(session.title),
      visibility: stringOrNull(session.visibility),
      routeName: stringOrNull(session.route_name),
      region: stringOrNull(session.region),
    },
    metrics: {
      distanceKm: distance,
      durationSeconds: duration,
      elapsedSeconds,
      elevationGainM: elevation,
      maxAltitudeM: maxAltitude,
      averageSpeedKmh,
      averagePaceSecondsPerKm,
      poiCount,
      weather,
      heartRateBpm,
      caloriesKcal,
      splits,
    },
    missing,
    citations,
  };
}
