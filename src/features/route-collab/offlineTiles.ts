/**
 * Fond de carte hors ligne du corridor du tracé (2.10).
 *
 * Fournisseur : OpenFreeMap (tuiles vectorielles du style « Positron »), déjà utilisé par le site pour les zones hors
 * ligne de l'Explorer. Lu sur https://openfreemap.org le 17 oct. 2026 (voir `components/map/engine/standardBase.ts`) :
 * usage commercial permis, aucune clé, « no limits on the number of map views or requests » ; attribution exigée.
 * Les fonds du style courant de `createMapStyle` NE PEUVENT PAS être préchargés :
 *  - OSM France (sans clé) : la politique des tuiles OSM interdit le téléchargement en masse
 *    (`compas/offline/tilePlan.ts`) ;
 *  - ArcGIS (clé du déploiement) : forfait de 2 M de tuiles par mois, et le plan 1.6 n'autorise que l'affichage ;
 *  - Esri public (topo, satellite sans clé) : usage non commercial.
 * Hors ligne, la carte pose donc le fond OpenFreeMap (Plan) sous le tracé.
 *
 * Contenu : zooms 10 à 15 dans un tampon d'environ 1 km autour du tracé. La source vectorielle s'arrête au zoom 14 :
 * le zoom 15 est l'affichage agrandi des mêmes tuiles, sans téléchargement en plus. Plafond 60 Mo : si l'estimation
 * le dépasse, on retire les zooms les plus fins (message dit) ; si même le zoom 10 seul le dépasse, pas de fond.
 *
 * Mise à jour : le téléchargement se fait dans un cache NEUF (`lkdv-route-tiles:<espace>:v<n>:<horodatage>`) ; la
 * référence (`TilePackMeta`) ne change qu'après contrôle, puis seulement les anciens caches sont supprimés. Un échec,
 * un plafond atteint avant le zoom 12, une coupure : le cache neuf est jeté, l'ancienne copie reste intacte.
 * Le service worker (`public/sw-route-tiles.js`) sert ces caches hors ligne.
 */

export type LonLat = readonly [number, number];
export interface TileCoord {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

export const TILE_PACK_MIN_ZOOM = 10;
export const TILE_PACK_MAX_ZOOM = 15;
/** Zoom maximal de la source vectorielle : au-delà, la carte agrandit les tuiles du zoom 14. */
export const TILE_SOURCE_MAX_ZOOM = 14;
export const TILE_BUFFER_M = 1000;
export const TILE_PACK_CAP_BYTES = 60 * 1024 * 1024;
/** Sous ce zoom complet, la copie n'est pas lisible : on ne la promeut pas. */
export const TILE_PACK_MIN_COMPLETE_ZOOM = 12;
export const TILE_CACHE_PREFIX = 'lkdv-route-tiles:';
export const TILE_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
export const TILE_PROVIDER_CREDIT = 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap';

/** Octets moyens par tuile vectorielle, par zoom : ordre de grandeur mesuré le 23 nov. 2026 (campagne ≈ 10 à 30 Ko au zoom 14, centre de Paris ≈ 200 Ko) ; c'est une estimation, la taille réelle est lue après. */
const AVG_TILE_BYTES: Readonly<Record<number, number>> = { 10: 130_000, 11: 90_000, 12: 60_000, 13: 40_000, 14: 40_000 };
/** Style, TileJSON, pictogrammes (≈ 0,25 Mo) et glyphes (≈ 0,6 Mo), mesurés le 23 nov. 2026. */
const FIXED_BYTES = 1_000_000;

/* ---------- Tuiles ---------- */

const clampLat = (lat: number) => Math.max(-85.0511, Math.min(85.0511, lat));

export function lonToTileX(lon: number, z: number): number {
  const n = 2 ** z;
  return Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));
}
export function latToTileY(lat: number, z: number): number {
  const n = 2 ** z;
  const r = (clampLat(lat) * Math.PI) / 180;
  return Math.min(n - 1, Math.max(0, Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)));
}

const EARTH_M = 40_075_016;
function tileWidthM(z: number, lat: number): number {
  return (EARTH_M * Math.cos((clampLat(lat) * Math.PI) / 180)) / 2 ** z;
}

function validLine(line: readonly LonLat[]): LonLat[] {
  return line.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
}

/** Tuiles d'un zoom qui touchent le tampon autour du tracé. */
export function corridorTilesAt(line: readonly LonLat[], z: number, bufferM = TILE_BUFFER_M): TileCoord[] {
  const pts = validLine(line);
  const seen = new Set<string>();
  const out: TileCoord[] = [];
  const add = (lon: number, lat: number) => {
    const dLat = bufferM / 111_320;
    const dLon = bufferM / (111_320 * Math.max(0.05, Math.cos((clampLat(lat) * Math.PI) / 180)));
    const x0 = lonToTileX(lon - dLon, z);
    const x1 = lonToTileX(lon + dLon, z);
    const y0 = latToTileY(lat + dLat, z);
    const y1 = latToTileY(lat - dLat, z);
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        const k = `${x}/${y}`;
        if (!seen.has(k)) {
          seen.add(k);
          out.push({ z, x, y });
        }
      }
    }
  };
  for (let i = 0; i < pts.length; i += 1) {
    const [lon, lat] = pts[i];
    add(lon, lat);
    const next = pts[i + 1];
    if (!next) continue;
    // Un point tous les tiers de tuile le long du segment : aucune tuile traversée n'est oubliée.
    const stepM = Math.max(50, tileWidthM(z, lat) / 3);
    const dxM = (next[0] - lon) * 111_320 * Math.cos((clampLat(lat) * Math.PI) / 180);
    const dyM = (next[1] - lat) * 111_320;
    const n = Math.min(5000, Math.floor(Math.hypot(dxM, dyM) / stepM));
    for (let k = 1; k <= n; k += 1) add(lon + ((next[0] - lon) * k) / (n + 1), lat + ((next[1] - lat) * k) / (n + 1));
  }
  return out;
}

export interface TilePlan {
  readonly tiles: readonly TileCoord[];
  readonly perZoom: ReadonlyArray<{ z: number; count: number }>;
  readonly minZoom: number;
  /** Plus fin zoom réellement téléchargé (≤ 14). */
  readonly fetchMaxZoom: number;
  readonly estimatedBytes: number;
  readonly capBytes: number;
  /** Faux : même le zoom 10 seul dépasse le plafond, ou pas de tracé. */
  readonly fits: boolean;
  /** Des zooms ont été retirés pour tenir sous le plafond. */
  readonly reduced: boolean;
  /** Phrase à montrer avant le téléchargement. */
  readonly announcement: string;
  /** Message quand le plafond limite la copie (sinon null). */
  readonly capMessage: string | null;
}

export function formatMo(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'taille inconnue';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',')} Mo`;
}

/** Plan de téléchargement : tuiles par zoom, taille estimée, réduction sous le plafond. */
export function planCorridorTiles(line: readonly LonLat[], capBytes = TILE_PACK_CAP_BYTES): TilePlan {
  const pts = validLine(line);
  const empty = (announcement: string): TilePlan => ({
    tiles: [], perZoom: [], minZoom: TILE_PACK_MIN_ZOOM, fetchMaxZoom: TILE_PACK_MIN_ZOOM, estimatedBytes: 0, capBytes, fits: false, reduced: false, announcement, capMessage: null,
  });
  if (pts.length === 0) return empty('Pas de tracé : aucun fond de carte à préparer.');

  const levels: Array<{ z: number; tiles: TileCoord[] }> = [];
  for (let z = TILE_PACK_MIN_ZOOM; z <= TILE_SOURCE_MAX_ZOOM; z += 1) levels.push({ z, tiles: corridorTilesAt(pts, z) });

  let total = FIXED_BYTES;
  const kept: typeof levels = [];
  for (const lv of levels) {
    const next = total + lv.tiles.length * AVG_TILE_BYTES[lv.z];
    if (next > capBytes) break;
    total = next;
    kept.push(lv);
  }
  const fullBytes = FIXED_BYTES + levels.reduce((a, l) => a + l.tiles.length * AVG_TILE_BYTES[l.z], 0);
  if (kept.length === 0) {
    return {
      ...empty(`Fond de carte non préparé : le tracé est trop long pour tenir sous ${formatMo(capBytes)} (environ ${formatMo(fullBytes)}). Le tracé et les étapes restent disponibles hors ligne.`),
      estimatedBytes: fullBytes,
      capMessage: `Le fond de carte dépasserait ${formatMo(capBytes)} dès le zoom ${TILE_PACK_MIN_ZOOM}.`,
    };
  }
  const reduced = kept.length < levels.length;
  const fetchMaxZoom = kept[kept.length - 1].z;
  const capMessage = reduced
    ? `Le fond de carte complet (zooms ${TILE_PACK_MIN_ZOOM} à ${TILE_PACK_MAX_ZOOM}, environ ${formatMo(fullBytes)}) dépasserait ${formatMo(capBytes)} : il est limité aux zooms ${TILE_PACK_MIN_ZOOM} à ${fetchMaxZoom}.`
    : null;
  const tiles = kept.flatMap((l) => l.tiles);
  const zoomText = reduced ? `zooms ${TILE_PACK_MIN_ZOOM} à ${fetchMaxZoom}` : `zooms ${TILE_PACK_MIN_ZOOM} à ${TILE_PACK_MAX_ZOOM}`;
  return {
    tiles,
    perZoom: kept.map((l) => ({ z: l.z, count: l.tiles.length })),
    minZoom: TILE_PACK_MIN_ZOOM,
    fetchMaxZoom,
    estimatedBytes: total,
    capBytes,
    fits: true,
    reduced,
    announcement: `Fond de carte du corridor (environ 1 km de part et d'autre) : ${tiles.length} tuiles, ${zoomText}, environ ${formatMo(total)} (estimation ; la taille réelle s'affiche après le téléchargement).`,
    capMessage,
  };
}

/* ---------- Référence de la copie ---------- */

export interface TilePackMeta {
  readonly workspaceId: string;
  readonly revisionNo: number;
  readonly cacheName: string;
  readonly tiles: number;
  readonly bytes: number;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly savedAt: string;
  /** Le plafond a limité la copie (zooms retirés ou arrêt en cours de route). */
  readonly capped: boolean;
}

const META_KEY = 'lkdv:route-collab:tiles:v1';
const memory = new Map<string, string>();

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStore(): KeyValueStore {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    /* stockage refusé */
  }
  return { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v), removeItem: (k) => void memory.delete(k) };
}

export function readTilePack(workspaceId: string, store: KeyValueStore = defaultStore()): TilePackMeta | null {
  try {
    const raw = store.getItem(`${META_KEY}:${workspaceId}`);
    if (!raw) return null;
    const m = JSON.parse(raw) as Partial<TilePackMeta>;
    if (typeof m.cacheName !== 'string' || !m.cacheName.startsWith(TILE_CACHE_PREFIX) || typeof m.bytes !== 'number') return null;
    return m as TilePackMeta;
  } catch {
    return null;
  }
}

/* ---------- Téléchargement ---------- */

export interface TileProgress {
  readonly done: number;
  readonly total: number;
  readonly bytes: number;
}

export interface TileDownloadDeps {
  fetchFn?: typeof fetch;
  caches?: CacheStorage;
  store?: KeyValueStore;
  now?: () => Date;
}

export type TileDownloadResult =
  | { ok: true; meta: TilePackMeta; message: string }
  | { ok: false; reason: string; previous: TilePackMeta | null };

interface StyleJson {
  sprite?: string;
  glyphs?: string;
  sources?: Record<string, { url?: string; type?: string }>;
  layers?: Array<{ layout?: { 'text-font'?: unknown } }>;
}

const GLYPH_RANGES = ['0-255', '256-511'];

function fontStacks(style: StyleJson): string[] {
  const set = new Set<string>();
  for (const l of style.layers ?? []) {
    const f = l.layout?.['text-font'];
    if (Array.isArray(f) && f.every((x) => typeof x === 'string')) set.add((f as string[]).join(','));
  }
  if (set.size === 0) set.add('Noto Sans Regular');
  return [...set];
}

/**
 * Télécharge le corridor dans un cache neuf, le contrôle, puis seulement le promeut. Ne lève jamais : l'échec est
 * rendu avec sa raison, l'ancienne copie reste intacte.
 */
export async function downloadTilePack(
  input: { workspaceId: string; revisionNo: number; line: readonly LonLat[]; signal?: AbortSignal; onProgress?: (p: TileProgress) => void },
  deps: TileDownloadDeps = {}
): Promise<TileDownloadResult> {
  const store = deps.store ?? defaultStore();
  const previous = readTilePack(input.workspaceId, store);
  const fetchFn = deps.fetchFn ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
  const cacheStorage = deps.caches ?? (typeof caches !== 'undefined' ? caches : undefined);
  const fail = (reason: string): TileDownloadResult => ({ ok: false, reason, previous });
  if (!fetchFn || !cacheStorage) return fail('Ce navigateur ne permet pas de garder le fond de carte hors ligne.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return fail('Hors ligne : le fond de carte se télécharge avec du réseau.');

  const plan = planCorridorTiles(input.line);
  if (!plan.fits) return fail(plan.announcement);

  const stamp = (deps.now?.() ?? new Date()).getTime().toString(36);
  const cacheName = `${TILE_CACHE_PREFIX}${input.workspaceId}:v${input.revisionNo}:${stamp}`;
  const cache = await cacheStorage.open(cacheName);
  const discard = async () => {
    try {
      await cacheStorage.delete(cacheName);
    } catch {
      /* rien à jeter */
    }
  };
  let bytes = 0;
  let done = 0;
  let failed = 0;
  let capped = false;
  const total = plan.tiles.length;

  const putUrl = async (url: string, required: boolean): Promise<Response | null> => {
    try {
      const res = await fetchFn(url, { mode: 'cors', signal: input.signal });
      if (!res.ok) {
        if (required) throw new Error(`HTTP ${res.status} ${url}`);
        return null;
      }
      const size = (await res.clone().arrayBuffer()).byteLength;
      bytes += size;
      await cache.put(url, res.clone());
      return res;
    } catch (e) {
      if (required) throw e;
      return null;
    }
  };

  try {
    // 1. Le style, ses TileJSON, ses pictogrammes et ses glyphes : sans eux la carte reste blanche hors ligne.
    const styleRes = await putUrl(TILE_STYLE_URL, true);
    const style = (await styleRes!.clone().json()) as StyleJson;
    let template: string | null = null;
    for (const [id, src] of Object.entries(style.sources ?? {})) {
      if (!src.url) continue;
      const tj = await putUrl(src.url, id === 'openmaptiles');
      if (id === 'openmaptiles' && tj) template = ((await tj.clone().json()) as { tiles?: string[] }).tiles?.[0] ?? null;
    }
    if (!template) throw new Error('modèle de tuiles introuvable');
    if (style.sprite) for (const s of ['.json', '.png', '@2x.json', '@2x.png']) await putUrl(`${style.sprite}${s}`, false);
    if (style.glyphs) {
      for (const stack of fontStacks(style)) {
        for (const range of GLYPH_RANGES) await putUrl(style.glyphs.replace('{fontstack}', stack).replace('{range}', range), false);
      }
    }

    // 2. Les tuiles, des zooms larges aux zooms fins : un arrêt au plafond laisse des zooms entiers.
    const queue = plan.tiles.slice();
    let completeZoom = plan.minZoom - 1;
    const doneByZoom = new Map<number, number>();
    const totalByZoom = new Map(plan.perZoom.map((p) => [p.z, p.count] as const));
    const worker = async () => {
      while (queue.length && !capped) {
        if (input.signal?.aborted) return;
        const t = queue.shift()!;
        const url = template!.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y));
        try {
          const res = await fetchFn(url, { mode: 'cors', signal: input.signal });
          if (res.ok && res.status !== 204) {
            bytes += (await res.clone().arrayBuffer()).byteLength;
            await cache.put(url, res.clone());
          } else if (res.status !== 404 && res.status !== 204) failed += 1;
        } catch {
          if (input.signal?.aborted) return;
          failed += 1;
        }
        done += 1;
        doneByZoom.set(t.z, (doneByZoom.get(t.z) ?? 0) + 1);
        if (bytes > plan.capBytes) capped = true;
        if (done % 8 === 0 || done === total) input.onProgress?.({ done, total, bytes });
      }
    };
    await Promise.all(Array.from({ length: 6 }, () => worker()));
    if (input.signal?.aborted) {
      await discard();
      return fail('Téléchargement du fond de carte interrompu : la copie précédente reste utilisable.');
    }
    for (let z = plan.minZoom; z <= plan.fetchMaxZoom; z += 1) {
      if ((doneByZoom.get(z) ?? 0) >= (totalByZoom.get(z) ?? 0)) completeZoom = z;
      else break;
    }
    if (failed > Math.max(2, Math.floor(done * 0.02))) {
      await discard();
      return fail(`Fond de carte incomplet (${failed} tuiles manquantes sur ${done}) : la copie précédente reste utilisable.`);
    }
    if (completeZoom < TILE_PACK_MIN_COMPLETE_ZOOM) {
      await discard();
      return fail(`Plafond de ${formatMo(plan.capBytes)} atteint avant le zoom ${TILE_PACK_MIN_COMPLETE_ZOOM} : fond de carte non gardé.`);
    }

    // 3. Promotion : la référence change en une écriture, puis seulement les anciens caches partent.
    const meta: TilePackMeta = {
      workspaceId: input.workspaceId,
      revisionNo: input.revisionNo,
      cacheName,
      tiles: done,
      bytes,
      minZoom: plan.minZoom,
      maxZoom: completeZoom,
      savedAt: (deps.now?.() ?? new Date()).toISOString(),
      capped: capped || plan.reduced,
    };
    store.setItem(`${META_KEY}:${input.workspaceId}`, JSON.stringify(meta));
    try {
      for (const k of await cacheStorage.keys()) {
        if (k !== cacheName && k.startsWith(`${TILE_CACHE_PREFIX}${input.workspaceId}:`)) await cacheStorage.delete(k);
      }
    } catch {
      /* un ancien cache qui reste ne gêne pas */
    }
    const message = capped
      ? `Fond de carte gardé jusqu'au zoom ${completeZoom} (plafond de ${formatMo(plan.capBytes)} atteint), ${formatMo(bytes)}.`
      : plan.capMessage
        ? `${plan.capMessage} ${formatMo(bytes)} gardés.`
        : `Fond de carte du corridor gardé hors ligne : ${done} tuiles, ${formatMo(bytes)}.`;
    return { ok: true, meta, message };
  } catch (e) {
    await discard();
    const why = e instanceof Error ? e.message : 'erreur inconnue';
    return fail(`Fond de carte non téléchargé (${why}) : la copie précédente reste utilisable.`);
  }
}

/** Supprime la copie (et sa référence). */
export async function removeTilePack(workspaceId: string, deps: TileDownloadDeps = {}): Promise<void> {
  const store = deps.store ?? defaultStore();
  store.removeItem(`${META_KEY}:${workspaceId}`);
  const cs = deps.caches ?? (typeof caches !== 'undefined' ? caches : undefined);
  if (!cs) return;
  for (const k of await cs.keys()) if (k.startsWith(`${TILE_CACHE_PREFIX}${workspaceId}:`)) await cs.delete(k);
}
