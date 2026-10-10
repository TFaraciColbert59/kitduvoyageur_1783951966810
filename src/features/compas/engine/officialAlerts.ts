/**
 * Compas — alertes officielles (flux Meteoalarm : Europe, services nationaux).
 *
 * Fonctions pures. Conditions d'usage lues le 2026-10-10 :
 * https://meteoalarm.org/en/live/page/terms-and-conditions (voir
 * `meteoalarmFeeds.ts`). Règles tirées des flux réels (France 2026-10-01, tous
 * les pays 2026-10-10) :
 * - tous les pays suivent le même profil CAP ; ce qui change d'un pays à
 *   l'autre, c'est la ZONE : un nom (département, région, district), un code,
 *   ou un contour. On ne devine jamais une zone : contour qui couvre le lieu,
 *   nom EXACT d'une unité administrative du lieu, sinon « non rapprochée » ;
 * - seuls les champs STRUCTURÉS font foi (`awareness_level`, `awareness_type`) :
 *   le libellé libre (« Vigilance jaune orages ») peut contredire le niveau ;
 * - le flux garde un historique : pour une zone, un phénomène et un jour, seule
 *   la dernière émission à fenêtre valide compte ;
 * - une mise à jour à fenêtre nulle (début ≥ fin, « verte », avec `references`)
 *   clôt le message précédent, souvent suivie d'une nouvelle alerte quelques
 *   secondes après ; sans cette nouvelle alerte, l'état actuel n'est pas connu :
 *   l'alerte reste affichée, marquée « mise à jour depuis » ;
 * - une alerte est publiée en plusieurs langues (un bloc `info` par langue) :
 *   les traductions d'un même événement sont fusionnées ;
 * - un flux ne contient que les zones concernées : l'absence d'un nom n'est une
 *   preuve de calme que si le flux nomme ses zones comme la carte (France) ou
 *   si TOUTES ses zones ont un contour testé.
 */

import type { OfficialAlert } from './danger';
import { covers, parseCircle, parsePolygon, type CapGeometry, type CapRing } from './capGeometry';
import { METEOALARM_FEEDS, meteoalarmSource, providerLabel, type MeteoalarmFeed } from './meteoalarmFeeds';

/** Ce que le Compas sait des alertes officielles pour ce voyage. */
export type AlertsStatus =
  /** Zone du lieu reconnue dans le flux (liste vide = aucune alerte active). */
  | 'lues'
  /** Alertes trouvées, mais la zone n'est reconnue qu'en partie : d'autres peuvent exister. */
  | 'partielles'
  /** Départ au-delà du lendemain : rien n'est encore publié. */
  | 'pas_encore_publiees'
  /** Pays sans flux Meteoalarm utilisable (hors Europe, ou non participant). */
  | 'non_couvert'
  /** Pays couvert, flux lu, mais la zone du lieu n'y est pas reconnaissable. */
  | 'zone_non_rapprochee'
  /** Flux, lieu ou dates indisponibles. */
  | 'indisponibles';

/** Source des alertes françaises (service national + Meteoalarm), conservée pour l'affichage par défaut. */
export const METEOALARM_SOURCE = 'Météo-France via Meteoalarm';

const LEVELS: Record<number, OfficialAlert['level']> = { 2: 'jaune', 3: 'orange', 4: 'rouge' };

/** Types de phénomène du standard Meteoalarm (`awareness_type`). */
const HAZARDS: Record<number, string> = {
  1: 'vent violent',
  2: 'neige-verglas',
  3: 'orages',
  4: 'brouillard',
  5: 'canicule',
  6: 'grand froid',
  7: 'vagues-submersion',
  8: 'feux de forêt',
  9: 'avalanches',
  10: 'pluie',
  11: 'crues',
  12: 'inondations',
  13: 'pluie-inondation',
};

/** « Hautes Alpes », « Hautes-Alpes », « hautes-alpes » → même clé. */
export function normalizeArea(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-'’\s]+/g, ' ')
    .trim();
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function addDays(day: string, n: number): string {
  const t = Date.parse(`${day}T12:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Les dates du voyage touchent-elles aujourd'hui ou demain (horizon publié) ? */
export function withinPublishedHorizon(from: string, to: string, today: string): boolean {
  if (![from, to, today].every((d) => ISO_DAY.test(d))) return false;
  return from <= addDays(today, 1) && to >= today;
}

const leadingNumber = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : Number.NaN;
  return Number.isFinite(n) ? n : null;
};

/** Dernier jour couvert : une fin à minuit appartient au jour précédent. */
function lastDay(expires: string): string {
  const day = expires.slice(0, 10);
  return /T00:00(:00)?/.test(expires) ? addDays(day, -1) : day;
}

/* ------------------------------------------------------------------ */
/* Lecture d'un flux : réduction compacte (gardée en cache 5 minutes)  */
/* ------------------------------------------------------------------ */

interface DigestArea {
  name: string;
  /** Nom normalisé (`normalizeArea`). */
  key: string;
  /** Contours et cercles de la zone, quand le flux en donne. */
  geo: CapGeometry | null;
}

interface DigestBlock {
  lang: string;
  headline: string | null;
  web: string | null;
  sender: string | null;
  areas: DigestArea[];
}

/** Un événement (les traductions d'une même alerte sont fusionnées en blocs). */
interface DigestCandidate {
  id: string;
  sent: number;
  level: number;
  type: number | null;
  onset: string;
  expires: string;
  blocks: DigestBlock[];
}

export interface FeedDigest {
  candidates: DigestCandidate[];
  /** Nombre de messages du flux (avant tri). */
  rawCount: number;
  /** Le flux n'est pas vide mais rien n'y a été lu : format inattendu. */
  unreadable: boolean;
  /** Toutes les zones du flux ont un contour ou un cercle (au moins une zone). */
  geometryComplete: boolean;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Réduit le JSON d'un flux Meteoalarm (`{ warnings: [{ alert }] }`) : on garde
 * ce qui sert à reconnaître une zone et à dater l'alerte, pas les descriptions
 * multilingues qui font la plus grande partie du poids (3,4 Mo pour
 * l'Allemagne). Un corps qui n'est pas un flux : null.
 */
export function digestMeteoalarm(json: unknown): FeedDigest | null {
  const warnings = (json as { warnings?: unknown })?.warnings;
  if (!Array.isArray(warnings)) return null;

  const rings = new Map<string, CapRing | null>();
  const ringOf = (text: string) => {
    if (!rings.has(text)) rings.set(text, parsePolygon(text));
    return rings.get(text) ?? null;
  };

  const candidates: DigestCandidate[] = [];
  let areaCount = 0;
  let geoCount = 0;

  for (const w of warnings) {
    const alert = (w as { alert?: Record<string, unknown> })?.alert;
    if (!alert || alert.msgType === 'Cancel') continue;
    const sent = Date.parse(String(alert.sent ?? ''));
    const infos = Array.isArray(alert.info) ? (alert.info as Array<Record<string, unknown>>) : [];
    if (!Number.isFinite(sent)) continue;

    const groups = new Map<string, DigestCandidate>();
    for (const info of infos) {
      const onset = String(info.onset ?? info.effective ?? '');
      const expires = String(info.expires ?? '');
      if (!ISO_DAY.test(onset.slice(0, 10)) || !ISO_DAY.test(expires.slice(0, 10))) continue;
      const params = Array.isArray(info.parameter)
        ? (info.parameter as Array<{ valueName?: unknown; value?: unknown }>)
        : [];
      const level = leadingNumber(params.find((p) => p.valueName === 'awareness_level')?.value);
      const type = leadingNumber(params.find((p) => p.valueName === 'awareness_type')?.value);
      if (level == null) continue;

      const rawAreas = Array.isArray(info.area) ? (info.area as Array<Record<string, unknown>>) : [];
      const areas: DigestArea[] = [];
      for (const a of rawAreas) {
        const name = str(a.areaDesc);
        if (!name) continue;
        const polygons = Array.isArray(a.polygon) ? a.polygon.map(ringOf).filter((r): r is CapRing => r != null) : [];
        const circles = Array.isArray(a.circle)
          ? a.circle.map(parseCircle).filter((c): c is NonNullable<ReturnType<typeof parseCircle>> => c != null)
          : [];
        areaCount += 1;
        const geo = polygons.length || circles.length ? { rings: polygons, circles } : null;
        if (geo) geoCount += 1;
        areas.push({ name, key: normalizeArea(name), geo });
      }

      const key = `${level}|${type ?? '?'}|${onset}|${expires}`;
      let candidate = groups.get(key);
      if (!candidate) {
        candidate = {
          id: groups.size === 0 ? String(alert.identifier ?? key) : `${String(alert.identifier ?? key)}#${groups.size + 1}`,
          sent,
          level,
          type,
          onset,
          expires,
          blocks: [],
        };
        groups.set(key, candidate);
      }
      candidate.blocks.push({
        lang: String(info.language ?? ''),
        headline: str(info.headline),
        web: str(info.web),
        sender: str(info.senderName),
        areas,
      });
    }
    candidates.push(...groups.values());
  }

  return {
    candidates,
    rawCount: warnings.length,
    unreadable: warnings.length > 0 && candidates.length === 0,
    geometryComplete: areaCount > 0 && areaCount === geoCount,
  };
}

/* ------------------------------------------------------------------ */
/* Choix de la zone d'un lieu, puis alertes en vigueur                 */
/* ------------------------------------------------------------------ */

export interface ReadOptions {
  from: string;
  to: string;
  now: Date;
  fetchedAt: string;
  /**
   * Noms d'unités administratives du lieu, du plus fin au plus large
   * (département, district, région…), tels que la carte les donne. Le premier
   * qui nomme une zone du flux gagne.
   */
  names?: string[];
  /** Un seul nom (département français) : équivaut à `names: [area]`. */
  area?: string;
  /** Position du lieu : sert aux flux qui décrivent leurs zones par des contours. */
  point?: { lat: number; lon: number } | null;
  /** Le flux du pays (nom du service, nommage des zones). France par défaut. */
  feed?: MeteoalarmFeed;
}

/**
 * - `complete` : la zone du lieu est reconnue, une liste vide veut dire « aucune alerte active » ;
 * - `partielle` : des alertes couvrent le lieu, mais d'autres ont pu nous échapper ;
 * - `aucune` : rien n'a pu être rapproché du lieu, on n'affirme rien.
 */
export type ZoneKnowledge = 'complete' | 'partielle' | 'aucune';

export interface MeteoalarmReading {
  alerts: OfficialAlert[];
  knowledge: ZoneKnowledge;
}

const langRank = (lang: string) => {
  const l = lang.toLowerCase().split('-')[0];
  return l === 'fr' ? 0 : l === 'en' ? 1 : 2;
};

interface Hit {
  candidate: DigestCandidate;
  /** Blocs où le lieu est dans une zone, dans l'ordre d'affichage (français, anglais, puis langue locale). */
  blocks: Array<{ block: DigestBlock; area: DigestArea }>;
}

function hitOf(c: DigestCandidate, rank: Map<string, number>, point: { lat: number; lon: number } | null): Hit | null {
  const found: Array<{ block: DigestBlock; area: DigestArea }> = [];
  for (const block of [...c.blocks].sort((a, b) => langRank(a.lang) - langRank(b.lang))) {
    let best: { area: DigestArea; score: number } | null = null;
    for (const area of block.areas) {
      const byGeo = point != null && area.geo != null && covers(area.geo, point.lat, point.lon);
      const r = rank.get(area.key);
      const score = byGeo ? -1 : r ?? Infinity;
      if (Number.isFinite(score) && (!best || score < best.score)) best = { area, score };
    }
    if (best) found.push({ block, area: best.area });
  }
  return found.length ? { candidate: c, blocks: found } : null;
}

/** Alertes en vigueur pour un lieu et des dates de voyage, d'après un flux déjà réduit. */
export function readDigest(digest: FeedDigest, opts: ReadOptions): MeteoalarmReading {
  const feed = opts.feed ?? METEOALARM_FEEDS.fr;
  const names = (opts.names ?? (opts.area ? [opts.area] : [])).map(normalizeArea).filter(Boolean);
  const rank = new Map<string, number>();
  names.forEach((n, i) => {
    if (!rank.has(n)) rank.set(n, i);
  });
  const point = opts.point && Number.isFinite(opts.point.lat) && Number.isFinite(opts.point.lon) ? opts.point : null;

  // Dernière émission par (phénomène, jour de début) pour ce lieu, et dernière
  // mise à jour à fenêtre nulle par phénomène.
  const latest = new Map<string, Hit>();
  const closedAt = new Map<string, number>();
  for (const c of digest.candidates) {
    const hit = hitOf(c, rank, point);
    if (!hit) continue;
    const start = Date.parse(c.onset);
    const stop = Date.parse(c.expires);
    if (!(stop > start)) {
      const k = String(c.type ?? '?');
      closedAt.set(k, Math.max(closedAt.get(k) ?? 0, c.sent));
      continue;
    }
    const key = `${c.type ?? '?'}|${c.onset.slice(0, 10)}`;
    const prev = latest.get(key);
    if (prev && prev.candidate.sent >= c.sent) continue;
    latest.set(key, hit);
  }

  const now = opts.now.getTime();
  const out: OfficialAlert[] = [];
  for (const { candidate: c, blocks } of latest.values()) {
    const level = LEVELS[c.level];
    if (!level) continue; // 1 = vert : pas de vigilance
    const end = Date.parse(c.expires);
    if (Number.isFinite(end) && end <= now) continue;
    if (c.onset.slice(0, 10) > opts.to || lastDay(c.expires) < opts.from) continue;
    const closed = closedAt.get(String(c.type ?? '?'));
    const senders = c.blocks.map((b) => b.sender).filter((s): s is string => s != null);
    const headline = blocks.map((b) => b.block.headline).find((h) => h != null);
    const web = blocks.map((b) => b.block.web).find((w) => w != null);
    out.push({
      id: c.id,
      source: meteoalarmSource(providerLabel(feed, senders)),
      sent: new Date(c.sent).toISOString(),
      updatedSince: closed != null && closed > c.sent ? new Date(closed).toISOString() : null,
      hazard: (c.type != null && HAZARDS[c.type]) || 'phénomène non précisé',
      level,
      area: blocks[0].area.name,
      onset: c.onset,
      expires: c.expires,
      fetchedAt: opts.fetchedAt,
      ...(headline ? { headline } : {}),
      ...(web ? { web } : {}),
    });
  }
  const order = { rouge: 0, orange: 1, jaune: 2 } as const;
  out.sort((a, b) => order[a.level] - order[b.level] || (a.onset ?? '').localeCompare(b.onset ?? ''));

  let knowledge: ZoneKnowledge;
  if (digest.unreadable) knowledge = 'aucune';
  else if (digest.rawCount === 0) knowledge = 'complete'; // rien d'actif dans tout le pays
  else if (digest.geometryComplete && point) knowledge = 'complete'; // chaque zone a été testée
  else if (feed.namesAreComplete && names.length > 0) knowledge = 'complete';
  else knowledge = out.length > 0 ? 'partielle' : 'aucune';
  return { alerts: out, knowledge };
}

/** Comme `readDigest`, depuis le JSON brut d'un flux. Corps illisible : rien d'affirmé. */
export function readMeteoalarm(json: unknown, opts: ReadOptions): MeteoalarmReading {
  const digest = digestMeteoalarm(json);
  return digest ? readDigest(digest, opts) : { alerts: [], knowledge: 'aucune' };
}

/**
 * Alertes en vigueur pour une zone (département) et des dates de voyage.
 * Un corps illisible rend une liste vide : l'appelant décide du statut.
 */
export function parseMeteoalarm(json: unknown, opts: ReadOptions): OfficialAlert[] {
  return readMeteoalarm(json, opts).alerts;
}
