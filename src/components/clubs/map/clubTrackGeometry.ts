import type { ClubTrackCoord } from './clubMapTypes';

export interface BuildOutingTrackInput {
  id?: string;
  title?: string;
  massif?: string;
  lat?: number | null;
  lng?: number | null;
  km?: number | null;
  dplus?: number | null;
  maxAlt?: number | null;
  routeTrace?: unknown;
  index?: number;
}

export interface BuiltOutingTrack {
  coords: ClubTrackCoord[];
  start: [number, number];
  peak: [number, number, number];
  bounds: [number, number, number, number];
  isApproximateRoute: boolean;
}

interface MassifTemplate {
  id: string;
  keywords: RegExp;
  /** Base valley/ridge waypoints [lng, lat, normalizedEle 0..1] (10-12 anchors -> 36-40 points). */
  anchors: Array<[number, number, number]>;
  baseEle: number;
  defaultPeakEle: number;
}

const MASSIF_TEMPLATES: MassifTemplate[] = [
  {
    id: 'mont-blanc',
    keywords: /mont[- ]blanc|chamonix|miage|aiguille|argenti[eè]re|houches|contamines/i,
    baseEle: 1080,
    defaultPeakEle: 3420,
    anchors: [
      [6.774, 45.812, 0.0],
      [6.783, 45.805, 0.14],
      [6.794, 45.799, 0.31],
      [6.801, 45.791, 0.52],
      [6.812, 45.786, 0.74],
      [6.824, 45.784, 0.91],
      [6.835, 45.789, 1.0],
      [6.829, 45.798, 0.82],
      [6.818, 45.804, 0.59],
      [6.804, 45.808, 0.34],
      [6.789, 45.811, 0.12],
      [6.774, 45.812, 0.0],
    ],
  },
  {
    id: 'vanoise',
    keywords: /vanoise|pralognan|tignes|val d['’ ]is[eè]re|champagny|modane|aussois/i,
    baseEle: 1420,
    defaultPeakEle: 2810,
    anchors: [
      [6.722, 45.381, 0.0],
      [6.734, 45.384, 0.16],
      [6.748, 45.389, 0.34],
      [6.762, 45.394, 0.55],
      [6.775, 45.401, 0.78],
      [6.788, 45.407, 1.0],
      [6.794, 45.398, 0.86],
      [6.783, 45.389, 0.63],
      [6.768, 45.384, 0.41],
      [6.749, 45.381, 0.19],
      [6.733, 45.380, 0.06],
      [6.722, 45.381, 0.0],
    ],
  },
  {
    id: 'ecrins',
    keywords: /[eé]crins|oisans|bourg[- ]d['’ ]oisans|lauvitel|venosc|b[eé]rarde|pelvoux|barre/i,
    baseEle: 980,
    defaultPeakEle: 2680,
    anchors: [
      [6.048, 44.982, 0.0],
      [6.058, 44.974, 0.17],
      [6.066, 44.965, 0.36],
      [6.073, 44.956, 0.58],
      [6.084, 44.948, 0.81],
      [6.096, 44.944, 1.0],
      [6.103, 44.953, 0.84],
      [6.095, 44.963, 0.61],
      [6.084, 44.971, 0.39],
      [6.071, 44.977, 0.18],
      [6.058, 44.981, 0.05],
      [6.048, 44.982, 0.0],
    ],
  },
  {
    id: 'lautaret',
    keywords: /lautaret|galibier|grave|combeynot|guisane|serre[- ]chevalier/i,
    baseEle: 2058,
    defaultPeakEle: 2940,
    anchors: [
      [6.404, 45.035, 0.0],
      [6.412, 45.041, 0.18],
      [6.419, 45.048, 0.39],
      [6.425, 45.056, 0.64],
      [6.432, 45.063, 0.88],
      [6.441, 45.067, 1.0],
      [6.437, 45.057, 0.79],
      [6.429, 45.049, 0.54],
      [6.421, 45.042, 0.31],
      [6.412, 45.037, 0.12],
      [6.404, 45.035, 0.0],
    ],
  },
  {
    id: 'belledonne',
    keywords: /belledonne|chamrousse|croix de belledonne|oursi[eè]re|sept[- ]laux|allevard/i,
    baseEle: 1650,
    defaultPeakEle: 2926,
    anchors: [
      [5.878, 45.113, 0.0],
      [5.891, 45.118, 0.15],
      [5.904, 45.126, 0.34],
      [5.918, 45.134, 0.53],
      [5.932, 45.143, 0.76],
      [5.946, 45.154, 0.94],
      [5.955, 45.163, 1.0],
      [5.942, 45.159, 0.82],
      [5.925, 45.149, 0.58],
      [5.909, 45.137, 0.33],
      [5.893, 45.124, 0.14],
      [5.878, 45.113, 0.0],
    ],
  },
  {
    id: 'vercors',
    keywords: /vercors|veymont|aiguille|glandasse|autrans|villard|corren[cç]on|moucherotte/i,
    baseEle: 1180,
    defaultPeakEle: 2341,
    anchors: [
      [5.498, 44.892, 0.0],
      [5.507, 44.884, 0.19],
      [5.515, 44.875, 0.41],
      [5.522, 44.866, 0.66],
      [5.527, 44.856, 0.88],
      [5.526, 44.847, 1.0],
      [5.534, 44.855, 0.83],
      [5.536, 44.866, 0.59],
      [5.529, 44.876, 0.36],
      [5.518, 44.885, 0.16],
      [5.498, 44.892, 0.0],
    ],
  },
  {
    id: 'chartreuse',
    keywords: /chartreuse|chamechaude|dent de crolles|granier|charmant som|sappey/i,
    baseEle: 1326,
    defaultPeakEle: 2082,
    anchors: [
      [5.769, 45.276, 0.0],
      [5.776, 45.281, 0.21],
      [5.783, 45.286, 0.47],
      [5.789, 45.291, 0.74],
      [5.791, 45.296, 1.0],
      [5.798, 45.292, 0.81],
      [5.795, 45.285, 0.54],
      [5.786, 45.279, 0.27],
      [5.776, 45.275, 0.09],
      [5.769, 45.276, 0.0],
    ],
  },
  {
    id: 'devoluy',
    keywords: /d[eé]voluy|bure|obiou|superd[eé]voluy|plateau de bure/i,
    baseEle: 1460,
    defaultPeakEle: 2709,
    anchors: [
      [5.918, 44.651, 0.0],
      [5.925, 44.644, 0.19],
      [5.931, 44.637, 0.42],
      [5.936, 44.629, 0.68],
      [5.938, 44.622, 0.91],
      [5.935, 44.616, 1.0],
      [5.943, 44.621, 0.82],
      [5.944, 44.630, 0.55],
      [5.937, 44.639, 0.30],
      [5.928, 44.646, 0.12],
      [5.918, 44.651, 0.0],
    ],
  },
];

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function isValidGeoCoord(pt: unknown): pt is ClubTrackCoord {
  if (!Array.isArray(pt) || pt.length < 2) return false;
  const lng = Number(pt[0]);
  const lat = Number(pt[1]);
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    Math.abs(lng) <= 180 &&
    Math.abs(lat) <= 90 &&
    !(lng === 0 && lat === 0)
  );
}

function normalizeGeoTrace(raw: unknown): ClubTrackCoord[] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const coords: ClubTrackCoord[] = [];
  for (const pt of raw) {
    if (!isValidGeoCoord(pt)) continue;
    const lng = Number(pt[0]);
    const lat = Number(pt[1]);
    const ele = pt.length >= 3 && Number.isFinite(Number(pt[2])) ? Number(pt[2]) : undefined;
    coords.push(ele !== undefined ? [lng, lat, ele] : [lng, lat]);
  }
  return coords.length >= 2 ? coords : null;
}

/**
 * Subdivides anchor waypoints into 34–42 realistic ridge/valley coordinates with
 * deterministic micro-relief undulation so parallel outings never overlap identically.
 */
function densifyAlpineAnchors(
  anchors: Array<[number, number, number]>,
  baseEle: number,
  peakEle: number,
  offsetLng: number,
  offsetLat: number,
  bearingJitterRad: number,
  seed: number,
  targetPoints: number,
): ClubTrackCoord[] {
  const originLng = anchors[0][0];
  const originLat = anchors[0][1];
  const cosB = Math.cos(bearingJitterRad);
  const sinB = Math.sin(bearingJitterRad);
  const scale = 0.88 + seed * 0.28;

  const transformed = anchors.map(([lng, lat, normEle]) => {
    const dx = (lng - originLng) * scale;
    const dy = (lat - originLat) * scale;
    const rx = dx * cosB - dy * sinB;
    const ry = dx * sinB + dy * cosB;
    return [originLng + offsetLng + rx, originLat + offsetLat + ry, normEle] as [number, number, number];
  });

  const result: ClubTrackCoord[] = [];
  const totalSegments = transformed.length - 1;
  for (let i = 0; i < targetPoints; i += 1) {
    const u = (i / (targetPoints - 1)) * totalSegments;
    const segIdx = Math.min(totalSegments - 1, Math.floor(u));
    const localT = u - segIdx;
    const a = transformed[segIdx];
    const b = transformed[segIdx + 1];

    // Smoothstep for natural valley-to-ridge curvature + slight switchback ridge jitter
    const smoothT = localT * localT * (3 - 2 * localT);
    const switchback =
      i === 0 || i === targetPoints - 1
        ? 0
        : Math.sin(i * 1.45 + seed * 12.0) * 0.00055 * Math.sin(Math.PI * (i / (targetPoints - 1)));
    const perpX = -(b[1] - a[1]);
    const perpY = b[0] - a[0];
    const perpLen = Math.hypot(perpX, perpY) || 1;

    const lng = a[0] + (b[0] - a[0]) * smoothT + (perpX / perpLen) * switchback;
    const lat = a[1] + (b[1] - a[1]) * smoothT + (perpY / perpLen) * switchback;
    const normEle = a[2] + (b[2] - a[2]) * localT;
    const ele = Math.round(baseEle + normEle * Math.max(250, peakEle - baseEle));

    result.push([Number(lng.toFixed(5)), Number(lat.toFixed(5)), ele]);
  }
  return result;
}

function buildGenericAlpineRidge(
  centerLng: number,
  centerLat: number,
  km: number,
  baseEle: number,
  peakEle: number,
  seed: number,
): Array<[number, number, number]> {
  const span = Math.min(0.055, Math.max(0.016, km / 480));
  const mainAngle = (seed * 2 - 1) * Math.PI;
  const ux = Math.cos(mainAngle);
  const uy = Math.sin(mainAngle) * 0.72;
  const px = -uy;
  const py = ux;

  return [
    [centerLng, centerLat, 0.0],
    [centerLng + ux * span * 0.22 + px * span * 0.08, centerLat + uy * span * 0.22 + py * span * 0.08, 0.16],
    [centerLng + ux * span * 0.45 - px * span * 0.06, centerLat + uy * span * 0.45 - py * span * 0.06, 0.36],
    [centerLng + ux * span * 0.70 + px * span * 0.11, centerLat + uy * span * 0.70 + py * span * 0.11, 0.62],
    [centerLng + ux * span * 0.92 + px * span * 0.04, centerLat + uy * span * 0.92 + py * span * 0.04, 0.88],
    [centerLng + ux * span * 1.08 - px * span * 0.05, centerLat + uy * span * 1.08 - py * span * 0.05, 1.0],
    [centerLng + ux * span * 0.88 - px * span * 0.18, centerLat + uy * span * 0.88 - py * span * 0.18, 0.79],
    [centerLng + ux * span * 0.58 - px * span * 0.24, centerLat + uy * span * 0.58 - py * span * 0.24, 0.51],
    [centerLng + ux * span * 0.30 - px * span * 0.16, centerLat + uy * span * 0.30 - py * span * 0.16, 0.25],
    [centerLng + ux * span * 0.10 - px * span * 0.06, centerLat + uy * span * 0.10 - py * span * 0.06, 0.08],
    [centerLng, centerLat, 0.0],
  ];
}

export function computeTrackBounds(coords: ClubTrackCoord[]): [number, number, number, number] {
  if (coords.length === 0) return [6.8, 45.8, 6.9, 45.9];
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

export function findPeakPoint(coords: ClubTrackCoord[], fallbackAlt = 2200): [number, number, number] {
  if (coords.length === 0) return [6.8694, 45.9237, fallbackAlt];
  let best = coords[0];
  let bestEle = typeof best[2] === 'number' ? best[2] : -Infinity;
  let hasAnyEle = typeof best[2] === 'number';
  for (let i = 1; i < coords.length; i += 1) {
    const pt = coords[i];
    if (typeof pt[2] === 'number') {
      hasAnyEle = true;
      if (pt[2] > bestEle) {
        best = pt;
        bestEle = pt[2];
      }
    }
  }
  if (!hasAnyEle) {
    const mid = coords[Math.floor(coords.length / 2)];
    return [mid[0], mid[1], fallbackAlt];
  }
  return [best[0], best[1], bestEle];
}

export function snapPointAlongTrack(coords: ClubTrackCoord[], t: number): [number, number, number] {
  if (coords.length === 0) return [6.8694, 45.9237, 1500];
  if (coords.length === 1) return [coords[0][0], coords[0][1], coords[0][2] ?? 0];

  const clamped = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const cumDist: number[] = [0];
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const dx = coords[i][0] - coords[i - 1][0];
    const dy = coords[i][1] - coords[i - 1][1];
    total += Math.hypot(dx, dy);
    cumDist.push(total);
  }

  if (total === 0) {
    const idx = Math.min(coords.length - 1, Math.round(clamped * (coords.length - 1)));
    const pt = coords[idx];
    return [pt[0], pt[1], pt[2] ?? 0];
  }

  const target = clamped * total;
  for (let i = 1; i < cumDist.length; i += 1) {
    if (cumDist[i] >= target || i === cumDist.length - 1) {
      const segLen = cumDist[i] - cumDist[i - 1] || 1;
      const localT = (target - cumDist[i - 1]) / segLen;
      const a = coords[i - 1];
      const b = coords[i];
      const eleA = a[2] ?? 0;
      const eleB = b[2] ?? eleA;
      return [
        Number((a[0] + (b[0] - a[0]) * localT).toFixed(5)),
        Number((a[1] + (b[1] - a[1]) * localT).toFixed(5)),
        Math.round(eleA + (eleB - eleA) * localT),
      ];
    }
  }

  const last = coords[coords.length - 1];
  return [last[0], last[1], last[2] ?? 0];
}

export function buildOutingTrackGeometry(input: BuildOutingTrackInput): BuiltOutingTrack {
  const realTrace = normalizeGeoTrace(input.routeTrace);
  const hasRealCoords =
    typeof input.lat === 'number' &&
    Number.isFinite(input.lat) &&
    input.lat !== 0 &&
    typeof input.lng === 'number' &&
    Number.isFinite(input.lng) &&
    input.lng !== 0;

  if (realTrace) {
    const start: [number, number] = [realTrace[0][0], realTrace[0][1]];
    const peak = findPeakPoint(realTrace, input.maxAlt ?? 2400);
    return {
      coords: realTrace,
      start,
      peak,
      bounds: computeTrackBounds(realTrace),
      isApproximateRoute: false,
    };
  }

  const matchText = `${input.massif ?? ''} ${input.title ?? ''}`.trim();
  const template = MASSIF_TEMPLATES.find((tpl) => tpl.keywords.test(matchText));
  const seedKey = `${input.id ?? ''}:${input.title ?? ''}:${input.index ?? 0}`;
  const seed = hashSeed(seedKey);
  const idx = input.index ?? 0;
  const targetPoints = 34 + (Math.floor(seed * 9) % 9); // 34..42 points

  const dplus = typeof input.dplus === 'number' && input.dplus > 0 ? input.dplus : 1150;
  const baseEle = template?.baseEle ?? 1250;
  const peakEle =
    typeof input.maxAlt === 'number' && input.maxAlt > baseEle
      ? input.maxAlt
      : Math.max(template?.defaultPeakEle ?? baseEle + dplus, baseEle + dplus);

  let coords: ClubTrackCoord[];

  if (template) {
    const anchorStart = template.anchors[0];
    const baseOffsetLng = hasRealCoords
      ? Math.max(-0.08, Math.min(0.08, (input.lng as number) - anchorStart[0]))
      : (((idx % 5) - 2) * 0.014);
    const baseOffsetLat = hasRealCoords
      ? Math.max(-0.06, Math.min(0.06, (input.lat as number) - anchorStart[1]))
      : ((((idx * 3) % 5) - 2) * 0.011);
    const jitterLng = baseOffsetLng + (seed - 0.5) * 0.012;
    const jitterLat = baseOffsetLat + (hashSeed(`${seedKey}:lat`) - 0.5) * 0.01;
    const bearingJitter = (seed - 0.5) * 0.42;

    coords = densifyAlpineAnchors(
      template.anchors,
      baseEle,
      peakEle,
      jitterLng,
      jitterLat,
      bearingJitter,
      seed,
      targetPoints,
    );
  } else {
    const centerLng = hasRealCoords ? (input.lng as number) : 6.45 + ((idx % 4) - 1.5) * 0.04;
    const centerLat = hasRealCoords ? (input.lat as number) : 45.25 + (((idx * 3) % 4) - 1.5) * 0.03;
    const anchors = buildGenericAlpineRidge(
      centerLng,
      centerLat,
      typeof input.km === 'number' && input.km > 0 ? input.km : 14,
      baseEle,
      peakEle,
      seed,
    );
    coords = densifyAlpineAnchors(anchors, baseEle, peakEle, 0, 0, (seed - 0.5) * 0.25, seed, targetPoints);
  }

  return {
    coords,
    start: [coords[0][0], coords[0][1]],
    peak: findPeakPoint(coords, peakEle),
    bounds: computeTrackBounds(coords),
    isApproximateRoute: true,
  };
}
