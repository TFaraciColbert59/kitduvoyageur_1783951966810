/**
 * Calques de la carte selon le sport (2.7). Seules des données réelles déjà servies par le dépôt sont
 * proposées : eau et abris (base LKDV + OpenStreetMap + Explorer) en randonnée ; ateliers (OSM, services vélo)
 * et eau à vélo. Chaque point dit sa source ; la date est celle du relevé (les sources ne datent pas chaque
 * point). Un calque sans donnée est dit tel quel (« aucun point relevé »), jamais comblé.
 */
import type { RouteSport } from '@/features/adventure-prep/routeProfiles';
import type { RouteCorridorPoi } from './routeAnalysis';

export type SportLayerId = 'water' | 'shelter' | 'bike_workshop';

export interface SportLayerDef {
  readonly id: SportLayerId;
  readonly label: string;
  readonly match: (poi: RouteCorridorPoi) => boolean;
}

const WATER: SportLayerDef = { id: 'water', label: 'Eau', match: (p) => p.category === 'water' };
const SHELTER: SportLayerDef = { id: 'shelter', label: 'Abris', match: (p) => p.category === 'shelter' };
const BIKE: SportLayerDef = {
  id: 'bike_workshop',
  label: 'Ateliers vélo',
  match: (p) => p.rawCategory === 'bike_shop' || p.rawCategory === 'bike_repair' || p.rawCategory === 'ebike_charging',
};

export function isCyclingSport(sport: RouteSport): boolean {
  return sport === 'route' || sport === 'gravel' || sport === 'vtt' || sport === 'enduro';
}

export function layersForSport(sport: RouteSport): SportLayerDef[] {
  return isCyclingSport(sport) ? [BIKE, WATER] : [WATER, SHELTER];
}

export function poisForLayer(pois: readonly RouteCorridorPoi[], layer: SportLayerDef): RouteCorridorPoi[] {
  return pois.filter(layer.match);
}

export type LayerAvailability = 'loading' | 'ready' | 'empty' | 'unavailable';

export function layerAvailability(args: {
  loading: boolean;
  loadedAt: string | null;
  sources: readonly string[];
  count: number;
}): LayerAvailability {
  if (args.loading) return 'loading';
  if (!args.loadedAt) return 'unavailable';
  if (args.count > 0) return 'ready';
  return args.sources.length > 0 ? 'empty' : 'unavailable';
}

export interface PoiProvenance {
  readonly source: string;
  /** Date du relevé (ISO) ; `null` si la couche n'a pas été chargée. */
  readonly retrievedAt: string | null;
  readonly text: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** « Source : OpenStreetMap · relevé le 22 novembre 2026 » ; `inconnue` si la source n'est pas nommée. */
export function describePoiProvenance(poi: Pick<RouteCorridorPoi, 'source'>, loadedAt: string | null): PoiProvenance {
  const source = poi.source?.trim() || 'inconnue';
  return {
    source,
    retrievedAt: loadedAt,
    text: `Source : ${source} · ${loadedAt ? `relevé le ${fmtDate(loadedAt)}` : 'date de relevé inconnue'}`,
  };
}
