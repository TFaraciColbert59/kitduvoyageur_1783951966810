/**
 * Projecteur de trace partageable.
 *
 * Le domaine ne connaît ni la carte, ni le GPX, ni la base : il reçoit une
 * géométrie et des masques, puis rend uniquement les morceaux visibles. Un
 * masque retire un intervalle le long de la trace ; deux morceaux séparés par
 * cet intervalle ne sont jamais recollés, même si la zone masquée ne contient
 * aucun sommet d'origine (segment traversant).
 *
 * Les coordonnées sont synthétiques et exprimées en WGS84 (lng/lat). Les
 * distances de début/fin sont mesurées le long de la trace (haversine) ; les
 * zones sont des disques ou des boîtes en degrés. Aucun appel réseau, aucune
 * lecture de base et aucune donnée réelle n'est nécessaire.
 *
 * Défense en profondeur : une trace ou une zone hors du domaine de calcul sûr
 * (pôle, antiméridien, zone trop grande, segment au-delà des bornes de découpe)
 * échoue fermée. Les zones et les masques début/fin sont élargis de 50 m, les
 * points publiés sont arrondis à 5 décimales, puis chaque morceau est vérifié
 * avant publication : il doit rester assez long et hors des zones élargies,
 * segment par segment. Une coupure n'est jamais recollée.
 *
 * Domaine géométrique couvert : chaque segment de la trace mesure au plus
 * `MAX_SAFE_SEGMENT_M` (2 km) et son arc orthodromique reste dans
 * `|lat| <= MAX_SAFE_ABS_LAT` (85°) sans traverser l'antiméridien. Sur un
 * segment de 2 km, l'écart entre l'arc géodésique et la corde interpolée en
 * lng/lat reste inférieur à ~2 m, très en dessous de la marge de 50 m. Un
 * segment plus long est d'abord découpé le long de la polyligne source, puis
 * chaque sous-segment est contrôlé ; au-delà de 512 découpes ou 20 000 points
 * ajoutés, la trace échoue fermée (`unsafe_geometry`). Les cercles privés sont
 * intersectés sur la sphère (et non par projection locale), donc la taille de
 * la zone n'introduit pas d'erreur supplémentaire.
 *
 * En cas d'entrée douteuse, le projecteur échoue fermé : il ne rend aucune
 * géométrie plutôt que de risquer de divulguer une portion masquée.
 */

// Réutilise la distance orthodromique déjà testée du domaine Adventure
// Intelligence. Les helpers de `compte/map/geometry` parsent, simplifient et
// bornent une trace, mais ne découpent pas de segments : les réutiliser ici
// n'apporterait pas la primitive manquante.
import {
  EARTH_RADIUS_M,
  cumulativeDistancesM,
  haversineM,
} from '../../adventure-intelligence/domain/geo';

export interface TracePoint {
  lng: number;
  lat: number;
}

/** [ouest, sud, est, nord], en degrés WGS84. */
export type TraceBounds = readonly [west: number, south: number, east: number, north: number];

export type PrivacyZone =
  { kind: 'circle'; center: TracePoint; radiusM: number } | { kind: 'bbox'; bounds: TraceBounds };

export type TraceMask =
  | { kind: 'start'; meters: number }
  | { kind: 'end'; meters: number }
  | { kind: 'all' }
  | { kind: 'zone'; zone: PrivacyZone };

export type TraceProjectionError =
  'invalid_points' | 'invalid_masks' | 'unsafe_geometry' | 'unpublishable_geometry' | null;

export interface TraceProjection {
  /** Morceaux visibles, dans l'ordre de la trace. Jamais reliés à travers un masque. */
  segments: TracePoint[][];
  /**
   * Vrai dès qu'une liste de masques non vide a été fournie, même si la
   * géométrie ou les masques sont invalides. `error` reste prioritaire : aucune
   * géométrie n'est rendue tant qu'il est non nul.
   */
  masked: boolean;
  /**
   * Vrai uniquement si `error === null`, qu'au moins un masque a été fourni et
   * que les masques ont retiré la totalité de la trace. Faux si des intervalles
   * visibles subsistent mais sont trop courts pour être publiés : ce cas rend
   * `unpublishable_geometry`, jamais `fullyMasked`.
   */
  fullyMasked: boolean;
  /** `null` si l'entrée est exploitable ; sinon la trace n'est jamais rendue. */
  error: TraceProjectionError;
  inputPointCount: number;
  visiblePointCount: number;
}

const DEG_TO_RAD = Math.PI / 180;
const EPSILON = 1e-9;
const MIN_INTERVAL = 1e-10;

/** Au-delà, l'arc géodésique et la lecture de zone ne sont plus sûres. */
const MAX_SAFE_ABS_LAT = 85;
const MAX_SAFE_ANTIMERIDIAN_SPAN_DEG = 180;
const MAX_SAFE_ZONE_RADIUS_M = 100_000;
/**
 * Longueur maximale d'un segment pour que l'arc géodésique reste à moins de
 * ~2 m de la corde interpolée en lng/lat, même à 85° de latitude. Un segment
 * plus long est découpé le long de la polyligne source avant la projection :
 * la géométrie rendue reste celle des coordonnées d'origine, et chaque
 * sous-segment reste dans le domaine de calcul sûr. Au-delà des bornes de
 * découpe ci-dessous, la trace échoue fermée.
 */
const MAX_SAFE_SEGMENT_M = 2_000;
/** Au-delà de 512 découpes (environ 1 000 km), la trace échoue fermée. */
const MAX_SEGMENT_SPLITS = 512;
/** Plafond de points ajoutés par la densification, pour borner le travail. */
const MAX_DENSIFIED_POINTS = 20_000;

/** Marge volontairement perdue autour d'une zone privée (mètres). */
const ZONE_SAFETY_MARGIN_M = 50;
/** Tolérance de quantification : le point reste à ≥ 48,5 m de la zone. */
const QUANTIZATION_TOLERANCE_M = 1.5;
/** 5 décimales ≈ 1,1 m : assez fin, sans exposer une frontière au mètre. */
const COORDINATE_DECIMALS = 5;
/** Un morceau plus court que cette longueur n'est pas publiable. */
const MIN_PUBLISHABLE_SEGMENT_M = 2;

type Interval = [start: number, end: number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidLngLat(lng: unknown, lat: unknown): boolean {
  return (
    isFiniteNumber(lng) &&
    isFiniteNumber(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

function readPoint(value: unknown): TracePoint | null {
  if (!isRecord(value)) return null;
  const { lng, lat } = value;
  if (!isValidLngLat(lng, lat)) return null;
  return { lng: lng as number, lat: lat as number };
}

type ZoneRead =
  { zone: PrivacyZone; error: null } | { zone: null; error: 'invalid_masks' | 'unsafe_geometry' };

type MasksRead =
  { masks: TraceMask[]; error: null } | { masks: []; error: 'invalid_masks' | 'unsafe_geometry' };

function invalidZone(): ZoneRead {
  return { zone: null, error: 'invalid_masks' };
}

function unsafeZone(): ZoneRead {
  return { zone: null, error: 'unsafe_geometry' };
}

function readZone(value: unknown): ZoneRead {
  if (!isRecord(value)) return invalidZone();

  if (value.kind === 'circle') {
    const center = readPoint(value.center);
    const radiusM = value.radiusM;
    if (!center || !isFiniteNumber(radiusM) || radiusM <= 0) return invalidZone();
    if (Math.abs(center.lat) > MAX_SAFE_ABS_LAT || radiusM > MAX_SAFE_ZONE_RADIUS_M) {
      return unsafeZone();
    }
    const radiusDeg =
      (radiusM + ZONE_SAFETY_MARGIN_M) /
      (EARTH_RADIUS_M * DEG_TO_RAD * Math.max(Math.cos(center.lat * DEG_TO_RAD), 1e-6));
    if (Math.abs(center.lng) + radiusDeg > MAX_SAFE_ANTIMERIDIAN_SPAN_DEG) {
      return unsafeZone();
    }
    return { zone: { kind: 'circle', center, radiusM }, error: null };
  }

  if (value.kind === 'bbox') {
    const bounds = value.bounds;
    if (!Array.isArray(bounds) || bounds.length !== 4) return invalidZone();
    const southWest = readPoint({ lng: bounds[0], lat: bounds[1] });
    const northEast = readPoint({ lng: bounds[2], lat: bounds[3] });
    if (!southWest || !northEast) return invalidZone();
    // Une boîte ouest > est traverse l'antiméridien : hors domaine sûr.
    if (southWest.lng > northEast.lng) return unsafeZone();
    if (southWest.lng === northEast.lng || southWest.lat >= northEast.lat) {
      return invalidZone();
    }
    if (
      Math.abs(southWest.lat) > MAX_SAFE_ABS_LAT ||
      Math.abs(northEast.lat) > MAX_SAFE_ABS_LAT ||
      northEast.lng - southWest.lng > MAX_SAFE_ANTIMERIDIAN_SPAN_DEG
    ) {
      return unsafeZone();
    }
    const padding = longitudePaddingDeg(southWest.lat, northEast.lat, ZONE_SAFETY_MARGIN_M);
    if (southWest.lng - padding < -180 || northEast.lng + padding > 180) {
      return unsafeZone();
    }
    return {
      zone: {
        kind: 'bbox',
        bounds: [southWest.lng, southWest.lat, northEast.lng, northEast.lat],
      },
      error: null,
    };
  }

  return invalidZone();
}

function readMasks(value: unknown): MasksRead {
  if (value === undefined) return { masks: [], error: null };
  if (!Array.isArray(value)) return { masks: [], error: 'invalid_masks' };

  const masks: TraceMask[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return { masks: [], error: 'invalid_masks' };

    if (raw.kind === 'all') {
      masks.push({ kind: 'all' });
      continue;
    }

    if (raw.kind === 'start' || raw.kind === 'end') {
      const meters = raw.meters;
      if (!isFiniteNumber(meters) || meters < 0) {
        return { masks: [], error: 'invalid_masks' };
      }
      masks.push({ kind: raw.kind, meters });
      continue;
    }

    if (raw.kind === 'zone') {
      const parsed = readZone(raw.zone);
      if (parsed.error) return { masks: [], error: parsed.error };
      masks.push({ kind: 'zone', zone: parsed.zone });
      continue;
    }

    return { masks: [], error: 'invalid_masks' };
  }

  return { masks, error: null };
}

/**
 * Une seule coordonnée corrompue invalide toute la trace : ignorer un point
 * créerait un segment qui relie deux endroits séparés par une donnée absente.
 * Les doublons strictement consécutifs sont retirés (ils ne portent aucune
 * longueur), sans supprimer un retour sur un point déjà visité.
 */
function readPoints(value: unknown): TracePoint[] | null {
  if (!Array.isArray(value) || value.length < 2) return null;

  const points: TracePoint[] = [];
  for (const raw of value) {
    const point = readPoint(raw);
    if (!point) return null;
    const previous = points[points.length - 1];
    if (previous && previous.lng === point.lng && previous.lat === point.lat) continue;
    points.push(point);
  }

  return points.length >= 2 ? points : null;
}

/**
 * Découpe les segments plus longs que `MAX_SAFE_SEGMENT_M` le long de la
 * polyligne source (interpolation lng/lat). C'est la géométrie réellement
 * affichée et exportée : on ne remplace pas un trou GPS par un arc
 * orthodromique différent. Chaque sous-segment reste dans le domaine sûr, et
 * les masques sont appliqués après découpe, donc une zone traversée reste
 * coupée.
 *
 * Rend `null` si un segment traverse l'antiméridien ou dépasse les bornes de
 * découpe : mieux vaut échouer fermé que produire une trace non couverte.
 */
function densifyLongSegments(points: TracePoint[]): TracePoint[] | null {
  const out: TracePoint[] = [points[0]];
  let added = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    const length = haversineM(a, b);
    if (Number.isFinite(length) && length > MAX_SAFE_SEGMENT_M) {
      if (Math.abs(b.lng - a.lng) >= MAX_SAFE_ANTIMERIDIAN_SPAN_DEG) return null;
      /*
       * Longueur maximale de la polyligne interpolée en lng/lat, majorée par
       * la métrique au plus petit |lat| (où cos(lat) est le plus grand). Le
       * grand cercle sous-estime cette longueur aux hautes latitudes : s'y
       * fier produirait des sous-segments encore > 2 km, refusés par le
       * contrôle de sûreté que la découpe est censée satisfaire. Si le segment
       * traverse l'équateur, cos(lat) y vaut 1 : le minimum des deux extrémités
       * ne majore plus la longueur, il faut prendre la métrique de l'équateur.
       */
      const latSpan = Math.abs(b.lat - a.lat) * DEG_TO_RAD;
      const lngSpan = Math.abs(b.lng - a.lng) * DEG_TO_RAD;
      const minAbsLat = a.lat * b.lat <= 0 ? 0 : Math.min(Math.abs(a.lat), Math.abs(b.lat));
      const pathUpperM =
        EARTH_RADIUS_M * Math.hypot(latSpan, Math.cos(minAbsLat * DEG_TO_RAD) * lngSpan);
      const steps = Math.ceil(pathUpperM / (MAX_SAFE_SEGMENT_M * 0.999));
      if (!Number.isFinite(steps) || steps < 2 || steps > MAX_SEGMENT_SPLITS) return null;
      for (let step = 1; step < steps; step += 1) {
        const t = step / steps;
        out.push({
          lng: a.lng + (b.lng - a.lng) * t,
          lat: a.lat + (b.lat - a.lat) * t,
        });
      }
      added += steps - 1;
    }
    out.push(b);
    /*
     * Le plafond borne les points **ajoutés** par la découpe, pas la longueur
     * d'une trace déjà dense : une trace de 30 000 points sans trou GPS reste
     * valide, seules les découpes excessives échouent fermées.
     */
    if (added > MAX_DENSIFIED_POINTS) return null;
  }
  return out;
}

type Vec3 = readonly [x: number, y: number, z: number];

function toUnitVector(point: TracePoint): Vec3 {
  const lat = point.lat * DEG_TO_RAD;
  const lng = point.lng * DEG_TO_RAD;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lng), cosLat * Math.sin(lng), Math.sin(lat)];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function norm3(value: Vec3): number {
  return Math.sqrt(dot3(value, value));
}

/** Angle central (radians) entre deux vecteurs unitaires. */
function angle3(a: Vec3, b: Vec3): number {
  return Math.atan2(norm3(cross3(a, b)), dot3(a, b));
}

/**
 * Latitude absolue maximale atteinte par l'arc orthodromique [a,b].
 *
 * L'arc appartient au grand cercle dont le plan passe par l'origine et dont la
 * normale est `a × b`. Le sommet nord de ce grand cercle est la projection du
 * pôle sur ce plan. On ne retient ce sommet (ou son antipode sud) que s'il
 * tombe effectivement sur l'arc court, sinon le maximum est porté par une
 * extrémité. C'est ce contrôle qui ferme le cas « sommets à 85°, arc au-delà ».
 */
function maxAbsLatitudeOnArc(a: TracePoint, b: TracePoint): number {
  const av = toUnitVector(a);
  const bv = toUnitVector(b);
  const base = Math.max(Math.abs(a.lat), Math.abs(b.lat));
  const normal = cross3(av, bv);
  const normalNorm = norm3(normal);
  if (normalNorm <= EPSILON) return base;

  const nz = normal[2];
  const factor = nz / (normalNorm * normalNorm);
  const rawNorth: Vec3 = [-factor * normal[0], -factor * normal[1], 1 - factor * normal[2]];
  const rawNorm = norm3(rawNorth);
  if (rawNorm <= EPSILON) return base;

  const north: Vec3 = [rawNorth[0] / rawNorm, rawNorth[1] / rawNorm, rawNorth[2] / rawNorm];
  const south: Vec3 = [-north[0], -north[1], -north[2]];
  const arcAngle = angle3(av, bv);
  const onArc = (vertex: Vec3): boolean =>
    angle3(av, vertex) + angle3(vertex, bv) <= arcAngle + 1e-9;

  if (!onArc(north) && !onArc(south)) return base;
  const vertexLat = Math.asin(Math.max(-1, Math.min(1, north[2]))) / DEG_TO_RAD;
  return Math.max(base, Math.abs(vertexLat));
}

function isSafePoint(point: TracePoint): boolean {
  return (
    Math.abs(point.lat) <= MAX_SAFE_ABS_LAT && Math.abs(point.lng) < MAX_SAFE_ANTIMERIDIAN_SPAN_DEG
  );
}

/**
 * Refuse un segment dont la corde lng/lat n'est plus une approximation sûre de
 * l'arc orthodromique : saut de longitude ambigu, longueur excessive ou arc qui
 * sort de la bande de latitude couverte. Le contrôle est fait sur le segment,
 * pas seulement sur ses extrémités : deux sommets sûrs peuvent porter un arc
 * qui passe au-dessus de 85° ou traverse une zone loin de la corde.
 */
function isSafeSegment(a: TracePoint, b: TracePoint): boolean {
  if (Math.abs(b.lng - a.lng) >= MAX_SAFE_ANTIMERIDIAN_SPAN_DEG) return false;

  const length = haversineM(a, b);
  if (!Number.isFinite(length) || length > MAX_SAFE_SEGMENT_M) return false;

  const maxAbsLat = maxAbsLatitudeOnArc(a, b);
  return Number.isFinite(maxAbsLat) && maxAbsLat <= MAX_SAFE_ABS_LAT;
}

function isSafeGeometry(points: TracePoint[]): boolean {
  for (let index = 0; index < points.length; index += 1) {
    if (!isSafePoint(points[index])) return false;
    if (index > 0 && !isSafeSegment(points[index - 1], points[index])) return false;
  }
  return true;
}

function interpolate(a: TracePoint, b: TracePoint, t: number): TracePoint {
  if (t <= EPSILON) return { lng: a.lng, lat: a.lat };
  if (t >= 1 - EPSILON) return { lng: b.lng, lat: b.lat };
  return {
    lng: a.lng + (b.lng - a.lng) * t,
    lat: a.lat + (b.lat - a.lat) * t,
  };
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .map(([start, end]): Interval => [
      Math.max(0, Math.min(1, start)),
      Math.max(0, Math.min(1, end)),
    ])
    .filter(([start, end]) => end - start > MIN_INTERVAL)
    .sort((a, b) => a[0] - b[0]);

  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval[0] <= last[1] + EPSILON) {
      last[1] = Math.max(last[1], interval[1]);
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

function subtractIntervals(visible: Interval, removed: Interval[]): Interval[] {
  let current: Interval[] = [visible];

  for (const [removeStart, removeEnd] of mergeIntervals(removed)) {
    const next: Interval[] = [];
    for (const [visibleStart, visibleEnd] of current) {
      if (removeEnd <= visibleStart + EPSILON || removeStart >= visibleEnd - EPSILON) {
        next.push([visibleStart, visibleEnd]);
        continue;
      }
      if (removeStart > visibleStart + EPSILON) {
        next.push([visibleStart, Math.min(removeStart, visibleEnd)]);
      }
      if (removeEnd < visibleEnd - EPSILON) {
        next.push([Math.max(removeEnd, visibleStart), visibleEnd]);
      }
    }
    current = next;
  }

  return current.filter(([start, end]) => end - start > MIN_INTERVAL);
}

/** Marge en longitude pour une marge métrique, à la latitude la plus défavorable. */
function longitudePaddingDeg(southLat: number, northLat: number, meters: number): number {
  const latPad = meters / (EARTH_RADIUS_M * DEG_TO_RAD);
  const cosLat = Math.max(
    Math.cos(Math.max(Math.abs(southLat), Math.abs(northLat)) * DEG_TO_RAD),
    1e-6
  );
  return latPad / cosLat;
}

/** Boîte élargie de la marge de sécurité, bornée au monde connu. */
function expandedBbox(bounds: TraceBounds, marginM: number): TraceBounds {
  const [west, south, east, north] = bounds;
  const latPad = marginM / (EARTH_RADIUS_M * DEG_TO_RAD);
  const lngPad = longitudePaddingDeg(south, north, marginM);
  return [
    Math.max(-180, west - lngPad),
    Math.max(-90, south - latPad),
    Math.min(180, east + lngPad),
    Math.min(90, north + latPad),
  ];
}

/**
 * Intervalle du segment [a,b] situé dans un cercle élargi, calculé sur la
 * sphère.
 *
 * On paramètre l'arc par `u = t * Ω` et on écrit la distance au centre comme
 * `f(u) = A cos u + C sin u`. L'ensemble `f(u) >= cos(alpha)` est un intervalle
 * unique (le cap sphérique est convexe), que l'on intersecte avec `[0, Ω]`.
 * Cette formulation ne dépend pas d'une projection locale : elle reste exacte
 * même pour une zone de 100 km ou un point éloigné du centre, là où
 * l'équirectangulaire dérive de plusieurs centaines de mètres.
 */
function circleInterval(
  a: TracePoint,
  b: TracePoint,
  zone: Extract<PrivacyZone, { kind: 'circle' }>,
  marginM: number
): Interval | null {
  const angularRadius = (zone.radiusM + marginM) / EARTH_RADIUS_M;
  const threshold = Math.cos(angularRadius);
  const av = toUnitVector(a);
  const bv = toUnitVector(b);
  const cv = toUnitVector(zone.center);

  // Angle et tangente sont dérivés des vecteurs unitaires, pas d'une
  // différence de cosinus : sur un segment de 2 km, cette différence perd
  // plusieurs chiffres significatifs et déplacerait la frontière de la zone.
  const cosArc = Math.max(-1, Math.min(1, dot3(av, bv)));
  const arcAngle = Math.atan2(norm3(cross3(av, bv)), cosArc);

  if (arcAngle <= EPSILON) {
    return haversineM(a, zone.center) <= zone.radiusM + marginM ? [0, 1] : null;
  }

  const sinArc = Math.sqrt(Math.max(0, 1 - cosArc * cosArc));
  if (sinArc <= EPSILON) {
    // Arc quasi demi-grand-cercle : ambigu, le domaine l'a déjà refusé.
    return null;
  }

  const tangent: Vec3 = [
    (bv[0] - av[0] * cosArc) / sinArc,
    (bv[1] - av[1] * cosArc) / sinArc,
    (bv[2] - av[2] * cosArc) / sinArc,
  ];
  const ca = dot3(cv, av);
  const cm = dot3(cv, tangent);
  const amplitude = Math.hypot(ca, cm);
  if (amplitude <= EPSILON) {
    return threshold <= 0 ? [0, 1] : null;
  }

  const ratio = threshold / amplitude;
  if (ratio > 1) return null;
  if (ratio < -1) return [0, 1];

  const halfWidth = Math.acos(Math.max(-1, Math.min(1, ratio)));
  const phase = Math.atan2(cm, ca);
  const TWO_PI = 2 * Math.PI;

  // Le début de l'intervalle est ramené dans [0, 2π). Comme la largeur peut
  // dépasser 2π - début, on teste aussi la branche décalée d'un tour : sans
  // cela, un arc situé juste après 0 manquerait la fin de l'intervalle.
  const intervalStart = (((phase - halfWidth) % TWO_PI) + TWO_PI) % TWO_PI;
  const intervalEnd = intervalStart + 2 * halfWidth;
  let best: Interval | null = null;

  for (const shift of [0, -TWO_PI]) {
    const clippedStart = Math.max(0, intervalStart + shift);
    const clippedEnd = Math.min(arcAngle, intervalEnd + shift);
    if (clippedEnd - clippedStart <= MIN_INTERVAL) continue;
    const interval: Interval = [clippedStart / arcAngle, clippedEnd / arcAngle];
    if (!best) {
      best = interval;
    } else {
      // Fusion conservatrice si une erreur d'arrondi produisait deux branches.
      best[0] = Math.min(best[0], interval[0]);
      best[1] = Math.max(best[1], interval[1]);
    }
  }

  return best;
}

/** Intervalle du segment [a,b] situé dans une boîte élargie. */
function bboxInterval(
  a: TracePoint,
  b: TracePoint,
  zone: Extract<PrivacyZone, { kind: 'bbox' }>,
  marginM: number
): Interval | null {
  const [west, south, east, north] = expandedBbox(zone.bounds, marginM);
  let start = 0;
  let end = 1;

  const axes = [
    { origin: a.lng, delta: b.lng - a.lng, min: west, max: east },
    { origin: a.lat, delta: b.lat - a.lat, min: south, max: north },
  ];

  for (const axis of axes) {
    if (Math.abs(axis.delta) <= EPSILON) {
      if (axis.origin < axis.min - EPSILON || axis.origin > axis.max + EPSILON) return null;
      continue;
    }

    let first = (axis.min - axis.origin) / axis.delta;
    let second = (axis.max - axis.origin) / axis.delta;
    if (first > second) [first, second] = [second, first];

    start = Math.max(start, first);
    end = Math.min(end, second);
    if (start > end + EPSILON) return null;
  }

  if (end - start <= MIN_INTERVAL) return null;
  return [start, end];
}

function zoneInterval(
  a: TracePoint,
  b: TracePoint,
  zone: PrivacyZone,
  marginM: number
): Interval | null {
  return zone.kind === 'circle'
    ? circleInterval(a, b, zone, marginM)
    : bboxInterval(a, b, zone, marginM);
}

function removedIntervals(
  startDistance: number,
  segmentLength: number,
  totalDistance: number,
  a: TracePoint,
  b: TracePoint,
  masks: TraceMask[]
): Interval[] {
  const removed: Interval[] = [];

  for (const mask of masks) {
    if (mask.kind === 'all') {
      removed.push([0, 1]);
      continue;
    }

    if (mask.kind === 'start') {
      const effectiveMeters = mask.meters > 0 ? mask.meters + ZONE_SAFETY_MARGIN_M : 0;
      if (effectiveMeters <= 0 || startDistance >= effectiveMeters - EPSILON) continue;
      if (startDistance + segmentLength <= effectiveMeters + EPSILON) {
        removed.push([0, 1]);
      } else {
        removed.push([0, (effectiveMeters - startDistance) / segmentLength]);
      }
      continue;
    }

    if (mask.kind === 'end') {
      const effectiveMeters = mask.meters > 0 ? mask.meters + ZONE_SAFETY_MARGIN_M : 0;
      if (effectiveMeters <= 0) continue;
      const boundary = totalDistance - effectiveMeters;
      if (startDistance >= boundary - EPSILON) {
        removed.push([0, 1]);
      } else if (startDistance + segmentLength <= boundary + EPSILON) {
        continue;
      } else {
        removed.push([(boundary - startDistance) / segmentLength, 1]);
      }
      continue;
    }

    const interval = zoneInterval(a, b, mask.zone, ZONE_SAFETY_MARGIN_M);
    if (interval) removed.push(interval);
  }

  return removed;
}

interface Piece {
  segmentIndex: number;
  endT: number;
  points: TracePoint[];
}

function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Réduit la précision sans jamais laisser un point sur une frontière exacte. */
function quantizePiece(points: TracePoint[]): TracePoint[] {
  const quantized: TracePoint[] = [];
  for (const point of points) {
    const next = {
      lng: roundCoordinate(point.lng),
      lat: roundCoordinate(point.lat),
    };
    const last = quantized[quantized.length - 1];
    if (last && last.lng === next.lng && last.lat === next.lat) continue;
    quantized.push(next);
  }
  return quantized;
}

function pieceLengthM(points: TracePoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversineM(points[index - 1], points[index]);
  }
  return total;
}

function isOutsideZones(point: TracePoint, masks: TraceMask[], marginM: number): boolean {
  for (const mask of masks) {
    if (mask.kind !== 'zone') continue;
    const zone = mask.zone;
    if (zone.kind === 'circle') {
      if (haversineM(point, zone.center) < zone.radiusM + marginM) {
        return false;
      }
      continue;
    }
    const [west, south, east, north] = expandedBbox(zone.bounds, marginM);
    if (point.lng > west && point.lng < east && point.lat > south && point.lat < north) {
      return false;
    }
  }
  return true;
}

/**
 * Dernier contrôle avant publication : le morceau quantifié doit rester long
 * assez, dans le domaine couvert, et hors de toutes les zones élargies. Le
 * contrôle n'échantillonne plus un milieu : chaque sous-segment est intersecté
 * analytiquement avec chaque zone, ce qui ferme le cas d'une zone frôlée près
 * d'une extrémité du morceau.
 */
function isPublishablePiece(points: TracePoint[], masks: TraceMask[]): boolean {
  if (points.length < 2 || pieceLengthM(points) < MIN_PUBLISHABLE_SEGMENT_M) return false;

  const marginM = ZONE_SAFETY_MARGIN_M - QUANTIZATION_TOLERANCE_M;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!isSafePoint(point)) return false;
    if (index > 0 && !isSafeSegment(points[index - 1], point)) return false;
    if (!isOutsideZones(point, masks, marginM)) return false;
  }

  for (let index = 1; index < points.length; index += 1) {
    for (const mask of masks) {
      if (mask.kind !== 'zone') continue;
      if (zoneInterval(points[index - 1], points[index], mask.zone, marginM)) {
        return false;
      }
    }
  }

  return true;
}

function emptyProjection(
  inputPointCount: number,
  error: Exclude<TraceProjectionError, null>,
  masked: boolean
): TraceProjection {
  return {
    segments: [],
    masked,
    fullyMasked: false,
    error,
    inputPointCount,
    visiblePointCount: 0,
  };
}

function projectShareableTraceInternal(
  points: unknown,
  masks: unknown,
  inputPointCount: number,
  masked: boolean
): TraceProjection {
  const parsedPoints = readPoints(points);
  if (!parsedPoints) {
    return emptyProjection(inputPointCount, 'invalid_points', masked);
  }
  const densifiedPoints = densifyLongSegments(parsedPoints);
  if (!densifiedPoints || !isSafeGeometry(densifiedPoints)) {
    return emptyProjection(inputPointCount, 'unsafe_geometry', masked);
  }

  const parsedMasks = readMasks(masks);
  if (parsedMasks.error) {
    return emptyProjection(inputPointCount, parsedMasks.error, masked);
  }

  const cumulative = cumulativeDistancesM(densifiedPoints);
  const totalDistance = cumulative[cumulative.length - 1] ?? 0;
  if (!Number.isFinite(totalDistance) || totalDistance <= EPSILON) {
    return emptyProjection(inputPointCount, 'unsafe_geometry', masked);
  }

  const pieces: Piece[] = [];

  for (let index = 0; index < densifiedPoints.length - 1; index += 1) {
    const a = densifiedPoints[index];
    const b = densifiedPoints[index + 1];
    const startDistance = cumulative[index];
    const segmentLength = cumulative[index + 1] - startDistance;
    if (segmentLength <= EPSILON) continue;

    const visibleIntervals = subtractIntervals(
      [0, 1],
      removedIntervals(startDistance, segmentLength, totalDistance, a, b, parsedMasks.masks)
    );

    for (const [startT, endT] of visibleIntervals) {
      const startPoint = interpolate(a, b, startT);
      const endPoint = interpolate(a, b, endT);
      const previous = pieces[pieces.length - 1];

      const canMerge =
        previous &&
        previous.segmentIndex === index - 1 &&
        previous.endT >= 1 - EPSILON &&
        startT <= EPSILON;

      if (canMerge) {
        previous.points.push(endPoint);
        previous.endT = endT;
        previous.segmentIndex = index;
      } else {
        pieces.push({
          segmentIndex: index,
          endT,
          points: [startPoint, endPoint],
        });
      }
    }
  }

  // `pieces` contient les intervalles encore visibles après soustraction, avant
  // le filtre de longueur. C'est la seule source fiable pour distinguer
  // « les masques ont tout retiré » de « il reste un morceau trop court ».
  const masksRemovedEverything = pieces.length === 0;

  // La quantification se fait pièce par pièce : deux pièces séparées ne sont
  // jamais fusionnées, même si leurs extrémités arrondies coïncident.
  const segments = pieces
    .map((piece) => quantizePiece(piece.points))
    .filter((piece) => isPublishablePiece(piece, parsedMasks.masks));

  if (segments.length === 0) {
    if (masked && masksRemovedEverything) {
      return {
        segments: [],
        masked: true,
        fullyMasked: true,
        error: null,
        inputPointCount,
        visiblePointCount: 0,
      };
    }
    return emptyProjection(inputPointCount, 'unpublishable_geometry', masked);
  }

  const visiblePointCount = segments.reduce((sum, segment) => sum + segment.length, 0);
  return {
    segments,
    masked,
    fullyMasked: false,
    error: null,
    inputPointCount,
    visiblePointCount,
  };
}

/**
 * Projette une trace pour un partage : seuls les intervalles non masqués sont
 * rendus, sous forme d'un tableau de segments disjoints.
 *
 * `points` et `masks` sont volontairement reçus en `unknown` : ils viennent de
 * la base ou d'une requête et sont validés ici. Un masque invalide ne doit
 * jamais être ignoré (il pourrait divulguer une zone) : la projection échoue
 * alors entièrement.
 *
 * Sémantique des états :
 * - `masked` dit qu'une liste de masques non vide a été fournie, même si la
 *   géométrie ou les masques sont invalides.
 * - `fullyMasked` n'est vrai que pour une entrée valide dont les masques ont
 *   retiré la totalité de la trace (`error === null`, `segments === []`).
 * - `unpublishable_geometry` signale qu'un intervalle visible subsiste mais
 *   qu'aucun morceau n'atteint `MIN_PUBLISHABLE_SEGMENT_M` ; ce n'est jamais
 *   `fullyMasked`.
 *
 * Invariants d'erreur : si `error !== null`, `segments` est vide,
 * `visiblePointCount` vaut 0 et `fullyMasked` reste faux. Toute exception
 * inattendue échoue fermée en `unsafe_geometry`.
 */
export function projectShareableTrace(points: unknown, masks: unknown = []): TraceProjection {
  let inputPointCount = 0;
  let masked = false;

  try {
    inputPointCount = Array.isArray(points) ? points.length : 0;
    masked = Array.isArray(masks) && masks.length > 0;
    return projectShareableTraceInternal(points, masks, inputPointCount, masked);
  } catch {
    return emptyProjection(inputPointCount, 'unsafe_geometry', masked);
  }
}

/** Alias court, pour les appels internes au domaine. */
export const projectTrace = projectShareableTrace;
