import { z } from 'zod';
import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';
import { ATLAS_TILES, type AtlasTileMode } from './createMapStyle';

/**
 * PLAN 1.6 — fond « standard » (« Plan ») de la carte MapLibre : OpenFreeMap.
 *
 * Fonds par mode (moteur MapLibre : Explorer, Compas, globe) :
 *   - `osm` (standard) : OpenFreeMap, tuiles vectorielles, sans clé ni limite, style « liberty » ;
 *   - `topo` (relief) et `satellite` : ArcGIS Location Platform, inchangés (`createMapStyle`) ;
 *   - repli : si OpenFreeMap ne répond pas, le fond ArcGIS « standard » (`atlas-osm`, déjà déclaré
 *     dans le style) prend la place, une seule fois par carte.
 * Les cartes Leaflet gardent l'ArcGIS « standard » (`leafletTiles`) : OpenFreeMap ne sert que des
 * tuiles vectorielles, et Leaflet ne sait pas les afficher avec les dépendances du site (le
 * greffon MapLibre pour Leaflet n'y est pas).
 *
 * Conditions : lues le 13 oct. 2026 sur https://openfreemap.org/ (« Is commercial usage allowed?
 * Yes. », « there are no limits on the number of map views or requests », « no API keys, and no
 * cookies », « Attribution is required » : « OpenFreeMap © OpenMapTiles Data from OpenStreetMap »)
 * et sur https://openfreemap.org/tos/ (version du 9 septembre 2026 : « may discontinue it at any
 * time without notice », d'où le repli ; « Attempt to collect data from the service in automated
 * ways without permission » interdit : aucun téléchargement en masse, voir `useOfflineDownload`).
 * Voir aussi `docs/compas/SERVICES-GRATUITS.md`.
 *
 * Pourquoi le style « liberty » (et non « bright » ou « positron ») : l'ancien fond standard,
 * `open/osm-style` d'ArcGIS, est un plan colorié à la manière d'OpenStreetMap. Lus le 13 oct. 2026
 * dans les trois styles : « liberty » a le sol beige, les parcs verts, l'eau bleue et les routes
 * chaudes de ce rendu, avec 111 couches ; « bright » a le même sol et les mêmes parcs pour 119
 * couches ; « positron » est entièrement gris (sol, parcs et eau), bien plus sobre que le plan
 * actuel. « liberty » est le plus proche et le plus léger des deux colorés.
 */

export const OPENFREEMAP_HOST = 'tiles.openfreemap.org';
export const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** Mention exigée par OpenFreeMap (partie « OpenFreeMap » facultative mais affichée). */
export const OPENFREEMAP_ATTRIBUTION = 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap';
/** Pastille repliée : les trois noms, le texte exact se déplie. */
export const OPENFREEMAP_ATTRIBUTION_SHORT = 'OpenFreeMap © OpenMapTiles · OpenStreetMap';

/**
 * Hôtes de fonds de carte autorisés : la clé ArcGIS du site (tuiles statiques et imagerie) et
 * OpenFreeMap. Le CSP (`connect-src`, `next.config.mjs`) doit les laisser passer ; le garde
 * `tests/map/leafletTiles.spec.ts` le vérifie.
 */
export const ALLOWED_TILE_HOSTS = [
  'static-map-tiles-api.arcgis.com',
  'ibasemaps-api.arcgis.com',
  OPENFREEMAP_HOST,
] as const;

/** Préfixe des sources et couches d'OpenFreeMap ajoutées à la carte (jamais de collision avec `atlas-*`). */
export const OPENFREEMAP_ID_PREFIX = 'ofm-';

export type BasemapProvider = 'openfreemap' | 'arcgis';

export type BasemapChoice =
  { provider: 'openfreemap'; styleUrl: string } | { provider: 'arcgis'; mode: AtlasTileMode };

/**
 * Le fond d'un mode : le standard vient d'OpenFreeMap tant qu'il répond ; le relief, le satellite
 * et le standard de repli viennent d'ArcGIS.
 */
export function selectBasemap(
  mode: AtlasTileMode,
  options: { openFreeMapFailed?: boolean } = {}
): BasemapChoice {
  if (mode === 'osm' && !options.openFreeMapFailed) {
    return { provider: 'openfreemap', styleUrl: OPENFREEMAP_STYLE_URL };
  }
  return { provider: 'arcgis', mode };
}

/** Mention de la pastille d'attribution (repliée, dépliée) selon le fond réellement affiché. */
export function basemapCredit(
  mode: AtlasTileMode,
  provider: BasemapProvider,
  tiles: Record<AtlasTileMode, { short: string; credits: string }> = ATLAS_TILES
): { short: string; credits: string } {
  if (mode === 'osm' && provider === 'openfreemap') {
    return { short: OPENFREEMAP_ATTRIBUTION_SHORT, credits: OPENFREEMAP_ATTRIBUTION };
  }
  return { short: tiles[mode].short, credits: tiles[mode].credits };
}

// ── Lecture du style OpenFreeMap (donnée externe : zod, hôte vérifié) ─────────────────────────────

function isOpenFreeMapUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === OPENFREEMAP_HOST;
  } catch {
    return false;
  }
}

const ofmUrl = z
  .string()
  .refine(isOpenFreeMapUrl, { message: `adresse hors de ${OPENFREEMAP_HOST}` });

const sourceSchema = z.object({
  type: z.enum(['vector', 'raster']),
  url: ofmUrl.optional(),
  tiles: z.array(ofmUrl).min(1).optional(),
  tileSize: z.number().int().positive().optional(),
  minzoom: z.number().min(0).max(24).optional(),
  maxzoom: z.number().min(0).max(24).optional(),
});

const layerSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  source: z.string().min(1).optional(),
  'source-layer': z.string().min(1).optional(),
  minzoom: z.number().min(0).max(24).optional(),
  maxzoom: z.number().min(0).max(24).optional(),
  filter: z.unknown().optional(),
  layout: z.record(z.string(), z.unknown()).optional(),
  paint: z.record(z.string(), z.unknown()).optional(),
});

const styleSchema = z.object({
  version: z.literal(8),
  sources: z.record(z.string(), sourceSchema),
  sprite: ofmUrl.optional(),
  glyphs: ofmUrl.optional(),
  layers: z.array(layerSchema).min(1).max(400),
});

export interface OpenFreeMapStyle {
  /** Sources préfixées `ofm-`. */
  sources: Record<string, SourceSpecification>;
  /** Couches préfixées `ofm-`, dans l'ordre du style. */
  layers: LayerSpecification[];
  glyphs: string | null;
  sprite: string | null;
}

/**
 * Lit le style d'OpenFreeMap pour l'ajouter à la carte du site : le JSON est validé (zod), chaque
 * adresse doit rester chez `tiles.openfreemap.org`, et tous les identifiants sont préfixés pour ne
 * jamais rencontrer ceux des couches du site (`atlas-*`). Lève une `Error` au message français.
 */
export function parseOpenFreeMapStyle(raw: unknown): OpenFreeMapStyle {
  const parsed = styleSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? first.path.join('.') : 'style';
    throw new Error(`style OpenFreeMap illisible (${where} : ${first?.message ?? 'invalide'})`);
  }
  const style = parsed.data;

  const sources: Record<string, SourceSpecification> = {};
  for (const [id, source] of Object.entries(style.sources)) {
    if (!source.url && !source.tiles)
      throw new Error(`style OpenFreeMap illisible (source « ${id} » sans adresse)`);
    sources[`${OPENFREEMAP_ID_PREFIX}${id}`] = source as SourceSpecification;
  }

  const layers: LayerSpecification[] = [];
  for (const layer of style.layers) {
    if (layer.type !== 'background' && !(layer.source && style.sources[layer.source])) continue;
    layers.push({
      ...layer,
      id: `${OPENFREEMAP_ID_PREFIX}${layer.id}`,
      ...(layer.source ? { source: `${OPENFREEMAP_ID_PREFIX}${layer.source}` } : {}),
    } as unknown as LayerSpecification);
  }
  if (layers.length === 0)
    throw new Error('style OpenFreeMap illisible (aucune couche utilisable)');

  return { sources, layers, glyphs: style.glyphs ?? null, sprite: style.sprite ?? null };
}

// ── Repli : une seule fois, sans boucle ───────────────────────────────────────────────────────────

export type BasemapFailure =
  /** Style absent, illisible, d'un autre hôte, ou délai dépassé. */
  | { kind: 'style'; message: string }
  /** La source elle-même (fichier TileJSON) ne répond pas. */
  | { kind: 'source'; message: string }
  /** Une tuile, un glyphe ou une image du sprite. */
  | { kind: 'tile'; message: string; status?: number };

export interface BasemapFallback {
  /** Vrai dès que le repli a eu lieu. */
  readonly triggered: boolean;
  /**
   * Note un échec. Rend vrai UNE seule fois : au premier échec de style ou de source, ou au
   * `tileErrorLimit`-ième échec de tuile (une tuile isolée perdue sur un réseau de montagne ne
   * doit pas faire quitter OpenFreeMap). Un 404 ne compte jamais : MapLibre le tient pour « pas de
   * tuile ici ». Après le repli, toujours faux : pas de second basculement.
   */
  report(failure: BasemapFailure): boolean;
}

export function createBasemapFallback(options: { tileErrorLimit?: number } = {}): BasemapFallback {
  const limit = Math.max(1, Math.floor(options.tileErrorLimit ?? 3));
  let tileErrors = 0;
  let triggered = false;
  return {
    get triggered() {
      return triggered;
    },
    report(failure) {
      if (triggered) return false;
      if (failure.kind === 'tile') {
        if (failure.status === 404) return false;
        tileErrors += 1;
        if (tileErrors < limit) return false;
      }
      triggered = true;
      return true;
    },
  };
}

/**
 * Lit un évènement `error` de MapLibre : un échec d'OpenFreeMap (source préfixée `ofm-`, ou erreur
 * dont l'adresse est chez OpenFreeMap : sprite, glyphes), sinon `null` (l'erreur ne le concerne pas).
 */
export function classifyMapError(event: unknown): BasemapFailure | null {
  const e = event as {
    sourceId?: unknown;
    tile?: unknown;
    error?: { message?: unknown; status?: unknown; url?: unknown } | null;
  } | null;
  if (!e || typeof e !== 'object') return null;
  const message = typeof e.error?.message === 'string' ? e.error.message : 'erreur inconnue';
  const status = typeof e.error?.status === 'number' ? e.error.status : undefined;
  const url = typeof e.error?.url === 'string' ? e.error.url : '';
  const sourceId = typeof e.sourceId === 'string' ? e.sourceId : '';

  if (sourceId.startsWith(OPENFREEMAP_ID_PREFIX)) {
    return e.tile ? { kind: 'tile', message, status } : { kind: 'source', message };
  }
  if (url.includes(OPENFREEMAP_HOST) || message.includes(OPENFREEMAP_HOST)) {
    return { kind: 'tile', message, status };
  }
  return null;
}
