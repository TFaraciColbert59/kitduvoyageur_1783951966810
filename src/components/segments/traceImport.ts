import type {
  ActivityTraceForSegments,
  SegmentSport,
  SegmentTrackPoint,
} from '@/features/segments';

const SPORTS: SegmentSport[] = [
  'running',
  'trail',
  'cycling',
  'gravel',
  'mtb',
  'hiking',
  'walking',
  'ski',
];

const VISIBILITIES = ['public', 'communaute', 'followers', 'private', 'collective_anonymized'] as const;

export type TraceImportResult =
  | { ok: true; activity: ActivityTraceForSegments }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Importe une trace GPS collée en JSON (export Explorer ou fichier d'activité).
 * L'import est volontairement strict : aucune coordonnée inventée, aucune
 * métrique capteur fabriquée, visibilité privée par défaut.
 */
export function parseActivityTraceJson(raw: string, viewerUserId: string): TraceImportResult {
  if (!raw.trim()) return { ok: false, error: 'Collez une trace GPS au format JSON.' };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Le JSON est invalide.' };
  }

  // Accepte aussi un objet { activity: … } ou { trace: … }
  const candidate =
    isRecord(value) && isRecord(value.activity)
      ? value.activity
      : isRecord(value) && isRecord(value.trace)
        ? value.trace
        : value;

  if (!isRecord(candidate)) return { ok: false, error: 'La trace doit être un objet JSON.' };

  const pointsRaw = candidate.points;
  if (!Array.isArray(pointsRaw) || pointsRaw.length < 2) {
    return { ok: false, error: 'La trace doit contenir au moins 2 points.' };
  }
  if (pointsRaw.length > 100_000) {
    return { ok: false, error: 'La trace dépasse 100 000 points.' };
  }

  const points: SegmentTrackPoint[] = [];
  for (let index = 0; index < pointsRaw.length; index += 1) {
    const point = pointsRaw[index];
    if (!isRecord(point)) return { ok: false, error: `Point ${index + 1} invalide.` };

    const lat = Number(point.lat);
    const lng = Number(point.lng);
    const timestamp = typeof point.timestamp === 'string' ? point.timestamp : '';
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return { ok: false, error: `Latitude invalide au point ${index + 1}.` };
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return { ok: false, error: `Longitude invalide au point ${index + 1}.` };
    }
    if (!timestamp || !Number.isFinite(Date.parse(timestamp))) {
      return { ok: false, error: `Horodatage invalide au point ${index + 1}.` };
    }

    const optionalNumber = (key: string): number | null | undefined => {
      const rawValue = point[key];
      if (rawValue === null || rawValue === undefined) return rawValue === null ? null : undefined;
      const parsed = Number(rawValue);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    points.push({
      lat,
      lng,
      ele: optionalNumber('ele') ?? null,
      timestamp,
      accuracyM: optionalNumber('accuracyM') ?? null,
      speedMps: optionalNumber('speedMps') ?? null,
      heartRateBpm: optionalNumber('heartRateBpm') ?? null,
      powerW: optionalNumber('powerW') ?? null,
      cadenceRpm: optionalNumber('cadenceRpm') ?? null,
      maskedByPrivacyZone: point.maskedByPrivacyZone === true,
    });
  }

  const declaredSport = candidate.sport;
  if (typeof declaredSport !== 'string' || !SPORTS.includes(declaredSport as SegmentSport)) {
    return { ok: false, error: 'Le sport de la trace est absent ou inconnu.' };
  }

  const declaredUserId = candidate.userId;
  if (typeof declaredUserId === 'string' && declaredUserId && declaredUserId !== viewerUserId) {
    return { ok: false, error: "Cette trace appartient à un autre compte." };
  }

  const visibility = VISIBILITIES.includes(candidate.visibility as (typeof VISIBILITIES)[number])
    ? (candidate.visibility as ActivityTraceForSegments['visibility'])
    : 'private';

  const activityVersion = Number(candidate.activityVersion);

  return {
    ok: true,
    activity: {
      activityId:
        typeof candidate.activityId === 'string' && candidate.activityId
          ? candidate.activityId
          : `import_${Date.now()}`,
      activityVersion:
        Number.isInteger(activityVersion) && activityVersion >= 1 ? activityVersion : 1,
      userId:
        typeof declaredUserId === 'string' && declaredUserId ? declaredUserId : viewerUserId,
      sport: declaredSport as SegmentSport,
      points,
      visibility,
      isManualOrIndoor: candidate.isManualOrIndoor === true,
      ebikeOrAssisted: candidate.ebikeOrAssisted === true,
      optOutPublicLeaderboards: candidate.optOutPublicLeaderboards === true,
      ...(Array.isArray(candidate.hiddenZones)
        ? { hiddenZones: candidate.hiddenZones as ActivityTraceForSegments['hiddenZones'] }
        : {}),
      ...(Array.isArray(candidate.maskedPointIndices)
        ? {
            maskedPointIndices: candidate.maskedPointIndices.filter(
              (index): index is number => Number.isInteger(index) && index >= 0
            ),
          }
        : {}),
    },
  };
}
