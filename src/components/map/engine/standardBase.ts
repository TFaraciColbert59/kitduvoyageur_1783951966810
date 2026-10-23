import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';
import type { AtlasTileMode } from './createMapStyle';

/**
 * Fond STANDARD (« Clair ») sur OpenFreeMap — plan 1.6 (fonctions pures).
 *
 * Pourquoi : ArcGIS Location Platform est gratuit jusqu'à 2 M tuiles par mois puis COUPÉ. OpenFreeMap
 * (https://openfreemap.org, lu le 17 oct. 2026) : « no registration, no user database, no API keys »,
 * « Is commercial usage allowed? Yes », « no limits on the number of map views or requests »,
 * « Attribution is required » (texte : « OpenFreeMap © OpenMapTiles Data from OpenStreetMap »),
 * et « I don't offer SLA guarantees » : il peut s'arrêter sans préavis, d'où le repli.
 *
 * Conception retenue (la plus simple qui ne casse rien) :
 * - OpenFreeMap ne sert que du VECTEUR (pas de tuiles raster) ; les cartes du Compas et de l'Explorer
 *   sont déjà MapLibre (`UnifiedExplorerMap`), qui lit ce vecteur nativement : aucune dépendance
 *   ajoutée (pas de `@maplibre/maplibre-gl-leaflet`). Les cartes Leaflet (`leafletTiles`) restent ArcGIS.
 * - Style Positron (clair, sans relief ni bâtiments 3D : le plus léger, fidèle au fond « Clair ») lu
 *   tel que publié, puis posé SOUS les couches du site : sources et couches préfixées `ofm-`, fond
 *   (`background`) retiré pour garder le papier du site. Le style de départ de la carte ne change pas :
 *   si OpenFreeMap ne répond pas, la carte est exactement celle d'aujourd'hui.
 * - Interrupteur `NEXT_PUBLIC_MAP_STANDARD=openfreemap|arcgis`, ArcGIS par défaut (aucun changement
 *   tant que Tony ne l'a pas allumé après vérification en production).
 * - Repli automatique sur le fond ArcGIS standard : style illisible ou injoignable, ou 3 erreurs de
 *   tuiles OpenFreeMap ; une seule fois, retenu pour la session (pas de boucle, pas de nouvel essai
 *   quand la carte est remontée).
 * - Hors ligne (lot J) : rien n'est téléchargé à l'avance ni mis en cache par le service worker.
 */

export type StandardProvider = 'openfreemap' | 'arcgis';

/** Lit l'interrupteur ; toute valeur autre que « openfreemap » garde ArcGIS. */
export function standardProvider(raw: string | undefined = process.env.NEXT_PUBLIC_MAP_STANDARD): StandardProvider {
  return raw?.trim().toLowerCase() === 'openfreemap' ? 'openfreemap' : 'arcgis';
}

const OFM_ORIGIN = 'https://tiles.openfreemap.org/';
export const OPENFREEMAP_STYLE_URL = `${OFM_ORIGIN}styles/positron`;
export const OFM_PREFIX = 'ofm-';
/** Erreurs de tuiles OpenFreeMap tolérées avant le repli. */
export const OFM_ERROR_THRESHOLD = 3;

export const OPENFREEMAP_CREDIT = {
  attribution:
    '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  short: 'OpenFreeMap · © OpenStreetMap',
  credits: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
} as const;

/** off : interrupteur éteint ; pending : style en cours ; active : posé ; failed : repli ArcGIS. */
export type VectorBaseState = 'off' | 'pending' | 'active' | 'failed';

export interface VectorBasePlan {
  glyphs: string | null;
  sprite: string | null;
  sources: Record<string, SourceSpecification>;
  layers: LayerSpecification[];
}

const fromOfm = (url: unknown): url is string => typeof url === 'string' && url.startsWith(OFM_ORIGIN);

function sourceFromOfm(src: Record<string, unknown>): boolean {
  if (src.url !== undefined) return fromOfm(src.url);
  return Array.isArray(src.tiles) && src.tiles.length > 0 && src.tiles.every(fromOfm);
}

/**
 * Le style publié → ce que la carte ajoute. Null si le style est illisible, vide, ou s'il pointe hors
 * d'OpenFreeMap (le site ne charge pas un hôte qu'il n'a pas choisi et crédité).
 */
export function prepareVectorBase(style: unknown, visible: boolean): VectorBasePlan | null {
  if (!style || typeof style !== 'object') return null;
  const s = style as { sources?: unknown; layers?: unknown; glyphs?: unknown; sprite?: unknown };
  if (!s.sources || typeof s.sources !== 'object' || !Array.isArray(s.layers)) return null;

  const sources: Record<string, SourceSpecification> = {};
  for (const [id, raw] of Object.entries(s.sources as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object' || !sourceFromOfm(raw as Record<string, unknown>)) return null;
    sources[OFM_PREFIX + id] = structuredClone(raw) as SourceSpecification;
  }

  const visibility = visible ? 'visible' : 'none';
  const layers: LayerSpecification[] = [];
  for (const raw of s.layers as Array<Record<string, unknown>>) {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || raw.type === 'background') continue;
    const layer = structuredClone(raw) as Record<string, unknown>;
    if (typeof layer.source !== 'string' || !(OFM_PREFIX + layer.source in sources)) continue;
    layer.id = OFM_PREFIX + layer.id;
    layer.source = OFM_PREFIX + layer.source;
    layer.layout = { ...((layer.layout as object | undefined) ?? {}), visibility };
    layers.push(layer as unknown as LayerSpecification);
  }
  if (layers.length === 0) return null;

  return {
    glyphs: fromOfm(s.glyphs) ? s.glyphs : null,
    sprite: fromOfm(s.sprite) ? s.sprite : null,
    sources,
    layers,
  };
}

/** Couche ArcGIS standard ou OpenFreeMap : jamais les deux, jamais aucune sur « Clair ». */
export function tileVisibility(mode: AtlasTileMode, state: VectorBaseState): { arcgisOsm: boolean; openfreemap: boolean } {
  const ofm = mode === 'osm' && state === 'active';
  return { arcgisOsm: mode === 'osm' && !ofm, openfreemap: ofm };
}

/** Erreur MapLibre venue d'une source OpenFreeMap (les sources du site ne comptent pas). */
export function isOpenFreeMapError(event: unknown): boolean {
  const id = (event as { sourceId?: unknown } | null)?.sourceId;
  return typeof id === 'string' && id.startsWith(OFM_PREFIX);
}

/** Compteur d'erreurs : `report()` vaut true une seule fois, au franchissement du seuil. */
export function createFallbackCounter(threshold = OFM_ERROR_THRESHOLD) {
  let count = 0;
  return {
    report(): boolean {
      count += 1;
      return count === threshold;
    },
    tripped: () => count >= threshold,
  };
}

/** Repli retenu pour la session : une carte remontée (Compas : « recentrer ») ne retente pas. */
let failedThisSession = false;
export const openFreeMapFailed = () => failedThisSession;
export function markOpenFreeMapFailed(): void {
  failedThisSession = true;
}
/** Tests uniquement. */
export function resetOpenFreeMapFailure(): void {
  failedThisSession = false;
}

/** Le crédit de la pastille : celui du fond réellement affiché. */
export function baseCredits(
  mode: AtlasTileMode,
  state: VectorBaseState,
  arcgis: Record<AtlasTileMode, { short: string; credits: string }>
): { short: string; credits: string } {
  if (tileVisibility(mode, state).openfreemap) return OPENFREEMAP_CREDIT;
  return { short: arcgis[mode].short, credits: arcgis[mode].credits };
}
