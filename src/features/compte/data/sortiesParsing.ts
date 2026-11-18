export type OutingVisibility = 'private' | 'followers' | 'public' | 'collective_anonymized';

export interface OutingPoint {
  lat: number;
  lng: number;
  elevationM: number | null;
  timestamp: string | null;
}

export function numericOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeVisibility(value: unknown): OutingVisibility {
  if (
    value === 'followers' ||
    value === 'public' ||
    value === 'collective_anonymized'
  ) {
    return value;
  }
  return 'private';
}

function pointFromCoordinate(coordinate: unknown): OutingPoint | null {
  if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
  const lng = numericOrNull(coordinate[0]);
  const lat = numericOrNull(coordinate[1]);
  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    lat,
    lng,
    elevationM: coordinate.length > 2 ? numericOrNull(coordinate[2]) : null,
    timestamp: null,
  };
}

function geojsonSegments(value: unknown): OutingPoint[][] {
  if (!value || typeof value !== 'object') return [];
  const geometry = value as {
    type?: unknown;
    coordinates?: unknown;
    geometry?: unknown;
  };
  if (geometry.type === 'Feature') return geojsonSegments(geometry.geometry);

  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    const points = geometry.coordinates
      .map(pointFromCoordinate)
      .filter((point): point is OutingPoint => point !== null);
    return points.length > 0 ? [points] : [];
  }

  if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates
      .map((line) => {
        if (!Array.isArray(line)) return [];
        return line
          .map(pointFromCoordinate)
          .filter((point): point is OutingPoint => point !== null);
      })
      .filter((segment) => segment.length > 0);
  }

  return [];
}

/**
 * Deux formats coexistent en base : `positions_timed` (échantillons horodatés
 * `{lat,lng,timestamp,elevationM}`) et `positions_geojson` (LineString ou
 * MultiLineString). Les morceaux d'un MultiLineString restent séparés : une
 * frontière n'est jamais recollée.
 */
export function parsePositionSegments(timed: unknown, geojson: unknown): OutingPoint[][] {
  const timedPoints: OutingPoint[] = [];

  if (Array.isArray(timed)) {
    for (const sample of timed) {
      if (!sample || typeof sample !== 'object') continue;
      const row = sample as Record<string, unknown>;
      const lat = numericOrNull(row.lat ?? row.latitude);
      const lng = numericOrNull(row.lng ?? row.lon ?? row.longitude);
      if (lat === null || lng === null) continue;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
      timedPoints.push({
        lat,
        lng,
        elevationM: numericOrNull(row.elevationM ?? row.altitude ?? row.ele),
        timestamp: typeof row.timestamp === 'string' ? row.timestamp : null,
      });
    }
  }

  if (timedPoints.length > 0) return [timedPoints];
  return geojsonSegments(geojson);
}

/** Points aplatis, pour les consommateurs qui ne dessinent pas de morceaux. */
export function parsePositions(timed: unknown, geojson: unknown): OutingPoint[] {
  return parsePositionSegments(timed, geojson).flat();
}
