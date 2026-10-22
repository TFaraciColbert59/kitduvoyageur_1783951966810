/**
 * Carte vivante du Compas v5 : modèle PUR (aucun accès au DOM, à MapLibre ni au réseau).
 *
 * Tout ce que la carte décide avant de dessiner est ici, pour être testé sans navigateur :
 *  - le découpage du tracé par jour (l'étape de chaque jour donne l'arrivée) ;
 *  - les emprises du voyage et de chaque jour ;
 *  - le niveau de détail selon le zoom, et le choix des points utiles à afficher ;
 *  - le placement des libellés et des nuits possibles sans chevauchement ;
 *  - la position de la bulle d'information ;
 *  - les chiffres du résumé lu par les lecteurs d'écran.
 *
 * Règle commune : aucune coordonnée inventée. Une coordonnée absente, non numérique, hors du globe ou à
 * (0, 0) (valeur de remplissage classique) est écartée ; sans tracé, les jours sont reliés par des segments
 * droits, marqués « approximatifs ». Limite connue : une emprise qui franchit l'antiméridien n'est pas gérée.
 */

export type LatLon = [lat: number, lon: number];
export type LonLat = [lon: number, lat: number];

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Rectangle écran en pixels (coin haut gauche). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* ---------- Coordonnées ---------- */

/**
 * Coordonnée exploitable : deux nombres finis dans le globe. (0, 0) est refusé : c'est la valeur que prend
 * une coordonnée absente quand elle est forcée en nombre, jamais un lieu d'un voyage.
 */
export function isLatLon(lat: unknown, lon: unknown): boolean {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
  return !(lat === 0 && lon === 0);
}

const EARTH_RADIUS_M = 6371008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distance à vol d'oiseau en mètres (haversine). */
export function distanceM(a: readonly [number, number], b: readonly [number, number]): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Longueur d'une ligne en kilomètres. */
export function lengthKm(line: ReadonlyArray<readonly [number, number]>): number {
  let m = 0;
  for (let i = 1; i < line.length; i++) m += distanceM(line[i - 1], line[i]);
  return m / 1000;
}

/** Garde les couples [lat, lon] valides, dans l'ordre, sans doublon consécutif. */
export function cleanLatLons(list: ReadonlyArray<readonly [unknown, unknown]> | null | undefined): LatLon[] {
  const out: LatLon[] = [];
  if (!Array.isArray(list)) return out;
  for (const p of list) {
    if (!Array.isArray(p) || !isLatLon(p[0], p[1])) continue;
    const prev = out[out.length - 1];
    if (prev && prev[0] === p[0] && prev[1] === p[1]) continue;
    out.push([p[0] as number, p[1] as number]);
  }
  return out;
}

/**
 * Les points d'un GeoJSON (Feature, FeatureCollection, GeometryCollection, LineString, MultiLineString), en
 * [lat, lon]. Les lignes d'un MultiLineString sont mises bout à bout dans l'ordre. Points, polygones et
 * positions invalides sont ignorés.
 */
export function trackFromGeojson(geo: unknown): LatLon[] {
  const raw: Array<[unknown, unknown]> = [];
  const pushLine = (coords: unknown) => {
    if (!Array.isArray(coords)) return;
    for (const pos of coords) {
      if (Array.isArray(pos) && pos.length >= 2) raw.push([pos[1], pos[0]]);
    }
  };
  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 6) return;
    const n = node as Record<string, unknown>;
    switch (n.type) {
      case 'FeatureCollection':
        if (Array.isArray(n.features)) for (const f of n.features) visit(f, depth + 1);
        break;
      case 'GeometryCollection':
        if (Array.isArray(n.geometries)) for (const g of n.geometries) visit(g, depth + 1);
        break;
      case 'Feature':
        visit(n.geometry, depth + 1);
        break;
      case 'LineString':
        pushLine(n.coordinates);
        break;
      case 'MultiLineString':
        if (Array.isArray(n.coordinates)) for (const line of n.coordinates) pushLine(line);
        break;
      default:
        break;
    }
  };
  visit(geo, 0);
  return cleanLatLons(raw);
}

/** Réduit une liste à `max` éléments au plus (pas régulier), en gardant le premier et le dernier. */
export function decimate<T>(items: readonly T[], max: number): T[] {
  if (max < 2 || items.length <= max) return items.slice();
  const out: T[] = [];
  const step = (items.length - 1) / (max - 1);
  for (let i = 0; i < max - 1; i++) out.push(items[Math.round(i * step)]);
  out.push(items[items.length - 1]);
  return out;
}

/* ---------- Tracé par jour ---------- */

export interface StageInput {
  /** Numéro de jour du voyage (1-based). L'étape donne l'ARRIVÉE de ce jour. */
  day: number;
  lat: number;
  lon: number;
  title: string;
}

export interface OriginInput {
  lat: number;
  lon: number;
  title: string;
}

export interface DaySegment {
  day: number;
  /**
   * [lon, lat], prêt pour GeoJSON ; au moins deux points. Le dernier point est le premier du jour suivant.
   * `day` 0 : tracé sans aucune étape géolocalisée.
   */
  coords: LonLat[];
  /** Segment droit entre deux étapes : pas un vrai tracé. */
  approximate: boolean;
}

export interface TripGeometry {
  /** Point de départ : celui qui est donné, sinon le début du tracé. Absent : pas de pastille « D ». */
  origin: OriginInput | null;
  /** Étapes valides, une par jour, dans l'ordre des jours. */
  stages: StageInput[];
  segments: DaySegment[];
  /**
   * D'où vient la ligne : `track` (GeoJSON du voyage), `coords` (liste de points fournie, donc droite entre
   * des points), `stages` (segments droits entre les étapes) ou `none`.
   */
  source: 'track' | 'coords' | 'stages' | 'none';
  /** Au moins un segment est une droite entre deux étapes. */
  approximate: boolean;
  /** Longueur du tracé réel en km ; null sans tracé réel (jamais une longueur de droites). */
  trackKm: number | null;
}

/** Au-delà, le tracé ne passe pas près de l'étape : on ne s'y fie pas pour couper ce jour. */
export const MATCH_TOLERANCE_M = 5000;
/** Points gardés au plus par segment (le tracé d'un GR en compte des dizaines de milliers). */
export const SEGMENT_MAX_POINTS = 1500;

/** Étapes valides, une par jour (la première gagne), triées par jour. */
export function cleanStages(stages: ReadonlyArray<StageInput> | null | undefined): StageInput[] {
  if (!Array.isArray(stages)) return [];
  const byDay = new Map<number, StageInput>();
  for (const s of stages) {
    if (!s || typeof s.day !== 'number' || !Number.isFinite(s.day) || !isLatLon(s.lat, s.lon)) continue;
    if (!byDay.has(s.day)) byDay.set(s.day, { day: s.day, lat: s.lat, lon: s.lon, title: typeof s.title === 'string' ? s.title : '' });
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

/**
 * Premier point de la ligne (à partir de `from`) qui touche l'étape : on cherche le plus proche, puis le tout
 * premier point qui en est presque aussi proche. Ainsi une ligne qui repasse près de l'étape plus tard (boucle)
 * ne mange pas les jours suivants. -1 si la ligne ne passe pas près de l'étape.
 */
function boundaryIndex(line: readonly LatLon[], stage: StageInput, from: number): number {
  let best = -1;
  let bestD = Infinity;
  const target: LatLon = [stage.lat, stage.lon];
  for (let i = from; i < line.length; i++) {
    const d = distanceM(line[i], target);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best < 0 || bestD > MATCH_TOLERANCE_M) return -1;
  const tolerance = bestD * 1.25 + 120;
  for (let i = from; i <= best; i++) if (distanceM(line[i], target) <= tolerance) return i;
  return best;
}

const toLonLat = (p: readonly [number, number]): LonLat => [p[1], p[0]];

/**
 * Découpe le tracé par jour. Chaque point du tracé va au jour dont l'étape (l'arrivée) est la plus proche, en
 * avançant sans jamais reculer ; deux jours voisins se partagent leur point de coupure, donc le trait n'a
 * aucune coupure. La fin du tracé, après la dernière étape, appartient au dernier jour. Repli : un segment
 * droit (marqué approximatif) entre l'étape précédente et celle-ci, quand le tracé manque, ne passe pas près
 * de l'étape ou n'avance plus.
 */
export function buildTripGeometry(input: {
  routeGeojson: unknown;
  /** Liste de points [lat, lon] du voyage : sert de ligne seulement sans GeoJSON, et reste « approximative ». */
  coords: ReadonlyArray<readonly [unknown, unknown]> | null | undefined;
  stages: ReadonlyArray<StageInput> | null | undefined;
  origin?: OriginInput | null;
  maxPoints?: number;
}): TripGeometry {
  const stages = cleanStages(input.stages);
  const maxPoints = input.maxPoints ?? SEGMENT_MAX_POINTS;

  let line: LatLon[] = trackFromGeojson(input.routeGeojson);
  let source: TripGeometry['source'] = 'track';
  if (line.length < 2) {
    line = cleanLatLons(input.coords);
    source = 'coords';
    if (line.length < 2) {
      line = [];
      source = stages.length > 0 ? 'stages' : 'none';
    }
  }

  const given = input.origin && isLatLon(input.origin.lat, input.origin.lon) ? input.origin : null;
  const first = stages[0];
  const origin: OriginInput | null = given
    ? { lat: given.lat, lon: given.lon, title: given.title ?? '' }
    : line.length >= 2 && (!first || distanceM(line[0], [first.lat, first.lon]) > 150)
      ? { lat: line[0][0], lon: line[0][1], title: '' }
      : null;

  const approxAll = source !== 'track';
  const segments: DaySegment[] = [];
  const addSegment = (day: number, pts: ReadonlyArray<readonly [number, number]>, approximate: boolean) => {
    if (pts.length < 2) return;
    if (pts.length === 2 && pts[0][0] === pts[1][0] && pts[0][1] === pts[1][1]) return;
    segments.push({ day, coords: decimate(pts.map(toLonLat), maxPoints), approximate });
  };

  if (line.length >= 2 && stages.length === 0) {
    // Un tracé sans aucune étape géolocalisée : il se dessine d'un trait, sans jour (day 0).
    addSegment(0, line, approxAll);
  } else if (line.length >= 2) {
    let prevIdx = 0;
    let prevEnd: LatLon = origin ? [origin.lat, origin.lon] : line[0];
    stages.forEach((st, j) => {
      const isLast = j === stages.length - 1;
      const idx = isLast ? line.length - 1 : boundaryIndex(line, st, prevIdx);
      if (idx > prevIdx) {
        addSegment(st.day, line.slice(prevIdx, idx + 1), approxAll);
        prevIdx = idx;
        prevEnd = line[idx];
      } else {
        // Le tracé ne passe pas près de l'étape (ou n'avance plus) : droite jusqu'à l'étape, dite approximative.
        addSegment(st.day, [prevEnd, [st.lat, st.lon]], true);
        prevEnd = [st.lat, st.lon];
      }
    });
  } else {
    let prev: LatLon | null = origin ? [origin.lat, origin.lon] : null;
    for (const st of stages) {
      if (prev) addSegment(st.day, [prev, [st.lat, st.lon]], true);
      prev = [st.lat, st.lon];
    }
  }

  return {
    origin,
    stages,
    segments,
    source,
    approximate: segments.some((s) => s.approximate),
    trackKm: source === 'track' ? lengthKm(line) : null,
  };
}

/* ---------- Emprises ---------- */

export function boundsOf(points: Iterable<readonly [number, number]>): Bounds | null {
  let b: Bounds | null = null;
  for (const [lat, lon] of points) {
    if (!isLatLon(lat, lon)) continue;
    if (!b) b = { south: lat, west: lon, north: lat, east: lon };
    else {
      b.south = Math.min(b.south, lat);
      b.north = Math.max(b.north, lat);
      b.west = Math.min(b.west, lon);
      b.east = Math.max(b.east, lon);
    }
  }
  return b;
}

/**
 * Ajoute une marge (part de l'étendue) et garantit une étendue minimale : un point seul, ou deux points
 * voisins, doivent donner une vue lisible, jamais un zoom au mètre.
 */
export function padBounds(b: Bounds, ratio = 0.1, minSpanDeg = 0.012): Bounds {
  const spanLat = Math.max(b.north - b.south, minSpanDeg);
  const spanLon = Math.max(b.east - b.west, minSpanDeg);
  const midLat = (b.north + b.south) / 2;
  const midLon = (b.east + b.west) / 2;
  const halfLat = (spanLat * (1 + 2 * ratio)) / 2;
  const halfLon = (spanLon * (1 + 2 * ratio)) / 2;
  return {
    south: Math.max(-85, midLat - halfLat),
    north: Math.min(85, midLat + halfLat),
    west: Math.max(-180, midLon - halfLon),
    east: Math.min(180, midLon + halfLon),
  };
}

function geometryPoints(g: TripGeometry, day: number | null): LatLon[] {
  const pts: LatLon[] = [];
  const segs = day == null ? g.segments : g.segments.filter((s) => s.day === day);
  for (const s of segs) for (const [lon, lat] of s.coords) pts.push([lat, lon]);
  const stages = day == null ? g.stages : g.stages.filter((s) => s.day === day);
  for (const s of stages) pts.push([s.lat, s.lon]);
  if (day == null && g.origin) pts.push([g.origin.lat, g.origin.lon]);
  return pts;
}

/** Emprise du voyage entier (tracé, étapes, départ, et les points `extra` : nuits retenues), avec marge. */
export function tripBounds(g: TripGeometry, extra: ReadonlyArray<LatLon> = []): Bounds | null {
  const b = boundsOf([...geometryPoints(g, null), ...extra]);
  return b ? padBounds(b) : null;
}

/**
 * Emprise d'un jour (son segment, son étape, et les points `extra` : sa nuit et ses alternatives), avec marge.
 * Null si le jour n'a pas d'étape géolocalisée : l'appelant retombe sur le voyage entier.
 */
export function dayBounds(g: TripGeometry, day: number, extra: ReadonlyArray<LatLon> = []): Bounds | null {
  if (!g.stages.some((s) => s.day === day)) return null;
  const b = boundsOf([...geometryPoints(g, day), ...extra]);
  return b ? padBounds(b) : null;
}

/** Clé stable d'une emprise : sert à ne pas bouger la caméra quand rien n'a changé. */
export function boundsKey(b: Bounds | null): string {
  return b ? [b.south, b.west, b.north, b.east].map((n) => n.toFixed(5)).join(',') : 'none';
}

/** Forme attendue par `map.fitBounds`. */
export function boundsToLngLat(b: Bounds): [[number, number], [number, number]] {
  return [
    [b.west, b.south],
    [b.east, b.north],
  ];
}

export interface Inset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Marges de base de la caméra : sous la capsule de fonds, à gauche des contrôles. À ajouter à `inset`. */
export const CAMERA_MARGIN: Readonly<Inset> = { top: 76, bottom: 36, left: 30, right: 72 };

/**
 * Marge de caméra : `inset` (surcouches) + marges de base, rabotée pour laisser au moins `minVisible` pixels
 * à la carte dans chaque direction (un tiroir très haut ne doit pas écraser la zone visible).
 */
export function cameraPadding(inset: Inset, size: { width: number; height: number }, minVisible = 80): Inset {
  const clean = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  let top = clean(inset.top) + CAMERA_MARGIN.top;
  let bottom = clean(inset.bottom) + CAMERA_MARGIN.bottom;
  let left = clean(inset.left) + CAMERA_MARGIN.left;
  let right = clean(inset.right) + CAMERA_MARGIN.right;
  const fitAxis = (a: number, b: number, total: number): [number, number] => {
    const room = total - minVisible;
    if (room <= 0) return [0, 0];
    if (a + b <= room) return [a, b];
    const k = room / (a + b);
    return [Math.floor(a * k), Math.floor(b * k)];
  };
  [top, bottom] = fitAxis(top, bottom, size.height);
  [left, right] = fitAxis(left, right, size.width);
  return { top, bottom, left, right };
}

/* ---------- Niveau de détail et points utiles ---------- */

export type Lod = 'low' | 'mid' | 'high';

export const LOD_MID_ZOOM = 8.5;
export const LOD_HIGH_ZOOM = 11;
/** Marqueurs HTML de points utiles affichés au plus. */
export const MAX_POI_MARKERS = 40;

/** Niveau de détail : `low` (vue d'ensemble : étapes et nuits seulement), `mid` (l'essentiel), `high` (tout). */
export function lodOf(zoom: number): Lod {
  if (!Number.isFinite(zoom) || zoom < LOD_MID_ZOOM) return 'low';
  return zoom < LOD_HIGH_ZOOM ? 'mid' : 'high';
}

/** Ordre d'importance d'un point (0 = le plus important) ; les catégories inconnues ferment la marche. */
const POI_RANK: Record<string, number> = {
  water: 0,
  refuge: 1,
  peak: 2,
  camping: 3,
  hebergement: 4,
  commerce: 5,
  sante: 6,
  viewpoint: 7,
  parking: 8,
  transport: 9,
  resto: 10,
  toilets: 11,
};
/** Les catégories montrées dès le niveau `mid`. */
const MID_RANK_MAX = 5;

export function poiRank(category: string | null | undefined): number {
  return category != null && category in POI_RANK ? POI_RANK[category] : 99;
}

export interface PoiCandidate {
  id: string;
  lat: number;
  lon: number;
  label: string;
  category: string | null;
}

const inBounds = (b: Bounds, lat: number, lon: number, margin: number) => {
  const mLat = (b.north - b.south) * margin;
  const mLon = (b.east - b.west) * margin;
  return lat >= b.south - mLat && lat <= b.north + mLat && lon >= b.west - mLon && lon <= b.east + mLon;
};

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Points utiles à dessiner en marqueurs : filtrés par niveau de détail et par zone visible, puis éclaircis (un
 * seul point par case de `cellPx` pixels, le plus important d'abord) et plafonnés à `max`. Les points de
 * `keep` (le point ouvert) restent toujours. Déterministe : même entrée, même sortie.
 */
export function selectPoiMarkers<T extends PoiCandidate>(
  points: readonly T[],
  opts: {
    lod: Lod;
    viewport: Bounds | null;
    project: (lat: number, lon: number) => { x: number; y: number };
    cellPx?: number;
    max?: number;
    obstacles?: readonly Rect[];
    keep?: ReadonlySet<string>;
  }
): T[] {
  if (opts.lod === 'low') return points.filter((p) => opts.keep?.has(p.id) && isLatLon(p.lat, p.lon));
  const cell = opts.cellPx ?? 44;
  const max = opts.max ?? MAX_POI_MARKERS;
  const seen = new Set<string>();
  const candidates = points
    .filter((p) => {
      if (!isLatLon(p.lat, p.lon) || seen.has(p.id)) return false;
      seen.add(p.id);
      if (opts.keep?.has(p.id)) return true;
      if (opts.lod === 'mid' && poiRank(p.category) > MID_RANK_MAX) return false;
      return !opts.viewport || inBounds(opts.viewport, p.lat, p.lon, 0.1);
    })
    .sort((a, b) => poiRank(a.category) - poiRank(b.category) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id));

  const out: T[] = [];
  const taken = new Set<string>();
  const place = (p: T, force: boolean) => {
    const { x, y } = opts.project(p.lat, p.lon);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const key = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
    if (!force) {
      if (out.length >= max || taken.has(key)) return;
      if (opts.obstacles?.some((r) => x >= r.x - 10 && x <= r.x + r.w + 10 && y >= r.y - 10 && y <= r.y + r.h + 10)) return;
    }
    taken.add(key);
    out.push(p);
  };
  for (const p of candidates) if (opts.keep?.has(p.id)) place(p, true);
  for (const p of candidates) if (!opts.keep?.has(p.id)) place(p, false);
  return out;
}

/* ---------- Libellés ---------- */

export interface LabelCandidate {
  id: string;
  /** Position du marqueur à l'écran. */
  x: number;
  y: number;
  text: string;
  /** Les plus forts sont placés d'abord. */
  priority?: number;
  /** Rayon du marqueur, pour tenir le libellé à distance. */
  radius?: number;
}

export type LabelSide = 'below' | 'above' | 'right' | 'left';

export interface LabelPlacement {
  id: string;
  /** Décalage du CENTRE du libellé par rapport au marqueur. */
  dx: number;
  dy: number;
  side: LabelSide;
  width: number;
  height: number;
}

export const LABEL_HEIGHT = 16;

/** Largeur estimée d'un libellé de 11 px (plafonnée : la feuille de style coupe avec « … »). */
export function labelWidth(text: string, charPx = 6.2, maxWidth = 168): number {
  return Math.min(maxWidth, Math.ceil(text.length * charPx) + 8);
}

const SIDES: LabelSide[] = ['below', 'above', 'right', 'left'];

/**
 * Place les libellés sans chevauchement (glouton). Chaque libellé essaie dessous, dessus, à droite, à gauche ;
 * il est omis s'il déborde de la vue ou touche un obstacle ou un libellé déjà posé.
 */
export function placeLabels(
  candidates: readonly LabelCandidate[],
  opts: { width: number; height: number; obstacles?: readonly Rect[]; gap?: number; margin?: number }
): LabelPlacement[] {
  const gap = opts.gap ?? 4;
  const margin = opts.margin ?? 4;
  const placed: Rect[] = [];
  const out: LabelPlacement[] = [];
  const order = candidates
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.text.trim() !== '' && Number.isFinite(c.x) && Number.isFinite(c.y))
    .sort((a, b) => (b.c.priority ?? 0) - (a.c.priority ?? 0) || a.i - b.i);
  for (const { c } of order) {
    const w = labelWidth(c.text);
    const h = LABEL_HEIGHT;
    const r = c.radius ?? 14;
    for (const side of SIDES) {
      const dx = side === 'right' ? r + gap + w / 2 : side === 'left' ? -(r + gap + w / 2) : 0;
      const dy = side === 'below' ? r + gap + h / 2 : side === 'above' ? -(r + gap + h / 2) : 0;
      const rect: Rect = { x: c.x + dx - w / 2, y: c.y + dy - h / 2, w, h };
      if (rect.x < margin || rect.y < margin || rect.x + w > opts.width - margin || rect.y + h > opts.height - margin) continue;
      if (opts.obstacles?.some((o) => overlaps(rect, o)) || placed.some((o) => overlaps(rect, o))) continue;
      placed.push(rect);
      out.push({ id: c.id, dx, dy, side, width: w, height: h });
      break;
    }
  }
  return out;
}

/** « Sainte-Eulalie → Rencurel » : le nom du lieu d'arrivée d'un titre de jour ; sinon le titre entier. */
export function placeNameOf(title: string | null | undefined): string {
  if (!title) return '';
  const parts = title.split(/\s*(?:→|->|➜|—>)\s*/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : title.trim();
}

/* ---------- Nuits possibles ---------- */

export interface AltPlacement {
  id: string;
  /** Décalage d'affichage en pixels (0 quand la nuit possible a sa place libre). */
  offsetX: number;
  offsetY: number;
}

/**
 * Éloigne d'un cran, à l'écran seulement, les nuits possibles qui se chevauchent entre elles ou avec la nuit
 * retenue. La position réelle ne change jamais ; le décalage reste inférieur à `maxShift` pixels. Glouton, dans
 * l'ordre reçu (les plus proches de l'arrivée d'abord) : même entrée, même sortie.
 */
export function placeAlternatives(
  anchors: ReadonlyArray<{ x: number; y: number }>,
  alts: ReadonlyArray<{ id: string; x: number; y: number }>,
  opts: { minGap?: number; maxShift?: number } = {}
): AltPlacement[] {
  const minGap = opts.minGap ?? 44;
  const maxShift = opts.maxShift ?? 48;
  const occupied: Array<{ x: number; y: number }> = anchors.map((a) => ({ x: a.x, y: a.y }));
  const candidates: Array<[number, number]> = [[0, 0]];
  for (const radius of [maxShift * 0.5, maxShift]) {
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 4;
      candidates.push([Math.round(Math.cos(a) * radius), Math.round(Math.sin(a) * radius)]);
    }
  }
  const out: AltPlacement[] = [];
  for (const alt of alts) {
    let best: [number, number] = [0, 0];
    let bestScore = -Infinity;
    for (const [ox, oy] of candidates) {
      const x = alt.x + ox;
      const y = alt.y + oy;
      const nearest = occupied.length ? Math.min(...occupied.map((o) => Math.hypot(o.x - x, o.y - y))) : Infinity;
      if (nearest >= minGap) {
        best = [ox, oy];
        bestScore = Infinity;
        break;
      }
      if (nearest > bestScore) {
        bestScore = nearest;
        best = [ox, oy];
      }
    }
    occupied.push({ x: alt.x + best[0], y: alt.y + best[1] });
    out.push({ id: alt.id, offsetX: best[0], offsetY: best[1] });
  }
  return out;
}

/* ---------- Bulle d'information ---------- */

export interface CalloutPlacement {
  left: number;
  top: number;
  /** Abscisse de la pointe dans la bulle. */
  arrowX: number;
  /** Pas de place au-dessus du point : la bulle se pose dessous. */
  below: boolean;
}

/** Place la bulle au-dessus du point (x, y), dans la zone, pointe vers le point ; dessous si le haut manque. */
export function placeCallout(opts: {
  x: number;
  y: number;
  boxW: number;
  boxH: number;
  areaW: number;
  areaH: number;
  margin?: number;
  gap?: number;
}): CalloutPlacement {
  const margin = opts.margin ?? 10;
  const gap = opts.gap ?? 24;
  const maxLeft = Math.max(margin, opts.areaW - opts.boxW - margin);
  const left = Math.min(maxLeft, Math.max(margin, opts.x - opts.boxW / 2));
  const above = opts.y - opts.boxH - gap;
  const below = above < margin;
  const top = below ? Math.min(opts.y + gap, Math.max(margin, opts.areaH - opts.boxH - margin)) : above;
  const arrowX = Math.min(opts.boxW - 18, Math.max(18, opts.x - left));
  return { left, top, arrowX, below };
}

/* ---------- Résumé pour les lecteurs d'écran ---------- */

export interface MapSummary {
  days: number;
  /** Longueur du tracé réel, arrondie ; null sans tracé réel. */
  km: number | null;
  nights: number;
  approximate: boolean;
}

export function mapSummary(g: TripGeometry, days: number, nights: number): MapSummary {
  return {
    days: Math.max(0, Math.floor(days)),
    km: g.trackKm != null && g.trackKm >= 1 ? Math.round(g.trackKm) : null,
    nights: Math.max(0, Math.floor(nights)),
    approximate: g.approximate,
  };
}
