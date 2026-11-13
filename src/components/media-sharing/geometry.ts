export interface LatLng {
  lat: number;
  lng: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
}

export interface ProjectedBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface ProjectedTrack {
  points: ProjectedPoint[];
  path: string;
  width: number;
  height: number;
  bounds: ProjectedBounds | null;
}

export function projectPointInBounds(
  point: LatLng,
  bounds: ProjectedBounds | null,
  width: number,
  height: number,
  padding: number,
): ProjectedPoint | null {
  if (!bounds || !isFinitePoint(point)) return null;
  const spanLng = Math.max(1e-6, bounds.maxLng - bounds.minLng);
  const spanLat = Math.max(1e-6, bounds.maxLat - bounds.minLat);
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);
  return {
    x: padding + ((point.lng - bounds.minLng) / spanLng) * innerWidth,
    y: padding + (1 - (point.lat - bounds.minLat) / spanLat) * innerHeight,
  };
}

export interface ElevationPoint {
  distanceM: number;
  elevationM: number | null;
}

export interface ElevationGraph {
  line: string;
  area: string;
  minElevationM: number;
  maxElevationM: number;
  hasElevation: boolean;
}

function isFinitePoint(point: LatLng): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng);
}

export function projectPoints(
  points: readonly LatLng[],
  width = 320,
  height = 180,
  padding = 18,
): ProjectedTrack {
  const valid = points.filter(isFinitePoint);
  if (valid.length === 0) {
    return { points: [], path: '', width, height, bounds: null };
  }

  if (valid.length === 1) {
    const center = { x: width / 2, y: height / 2 };
    return {
      points: [center],
      path: `M ${center.x.toFixed(1)} ${center.y.toFixed(1)} L ${center.x.toFixed(1)} ${center.y.toFixed(1)}`,
      width,
      height,
      bounds: {
        minLat: valid[0].lat,
        maxLat: valid[0].lat,
        minLng: valid[0].lng,
        maxLng: valid[0].lng,
      },
    };
  }

  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;

  for (const point of valid) {
    if (point.lat < minLat) minLat = point.lat;
    if (point.lat > maxLat) maxLat = point.lat;
    if (point.lng < minLng) minLng = point.lng;
    if (point.lng > maxLng) maxLng = point.lng;
  }

  const spanLng = Math.max(1e-6, maxLng - minLng);
  const spanLat = Math.max(1e-6, maxLat - minLat);
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);

  const projected = valid.map((point) => ({
    x: padding + ((point.lng - minLng) / spanLng) * innerWidth,
    y: padding + (1 - (point.lat - minLat) / spanLat) * innerHeight,
  }));

  return {
    points: projected,
    path: projected
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
      )
      .join(' '),
    width,
    height,
    bounds: { minLat, maxLat, minLng, maxLng },
  };
}

export function elevationGraph(
  profile: readonly ElevationPoint[],
  width = 320,
  height = 120,
  padding = 14,
): ElevationGraph {
  const measured = profile.filter(
    (point) => Number.isFinite(point.distanceM) && point.elevationM !== null,
  ) as Array<{ distanceM: number; elevationM: number }>;

  if (measured.length < 2) {
    return {
      line: '',
      area: '',
      minElevationM: 0,
      maxElevationM: 0,
      hasElevation: false,
    };
  }

  const minDistance = measured[0].distanceM;
  const maxDistance = measured[measured.length - 1].distanceM;
  let minElevation = Number.POSITIVE_INFINITY;
  let maxElevation = Number.NEGATIVE_INFINITY;

  for (const point of measured) {
    if (point.elevationM < minElevation) minElevation = point.elevationM;
    if (point.elevationM > maxElevation) maxElevation = point.elevationM;
  }

  const spanDistance = Math.max(1, maxDistance - minDistance);
  const spanElevation = Math.max(1, maxElevation - minElevation);
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);

  const coordinates = measured.map((point) => {
    const x =
      padding + ((point.distanceM - minDistance) / spanDistance) * innerWidth;
    const y =
      padding + (1 - (point.elevationM - minElevation) / spanElevation) * innerHeight;
    return { x, y };
  });

  const line = coordinates
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(' ');

  const baseline = height - padding;
  const area = [
    `M ${coordinates[0].x.toFixed(1)} ${baseline.toFixed(1)}`,
    ...coordinates.map(
      (point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    ),
    `L ${coordinates[coordinates.length - 1].x.toFixed(1)} ${baseline.toFixed(1)}`,
    'Z',
  ].join(' ');

  return {
    line,
    area,
    minElevationM: Math.round(minElevation),
    maxElevationM: Math.round(maxElevation),
    hasElevation: true,
  };
}
