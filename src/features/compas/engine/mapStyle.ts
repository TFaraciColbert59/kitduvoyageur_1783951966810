/**
 * Carte du Compas : fond de carte, pastilles d'étape et encart du point touché (fonctions pures).
 *
 * Fonds : ArcGIS Location Platform, déjà branchés sur `/explorer` (`components/map/engine/createMapStyle`,
 * clé publique restreinte aux domaines du site, « Powered by Esri » et mention des données visibles sur
 * la carte). Le Compas réutilise ce branchement : aucun autre fournisseur, aucune autre clé.
 * Pastilles et encart : la maquette (D = départ en sage, A = arrivée en vert forêt, numéros en blanc cerclé).
 */
import { formatKm } from './format';
import { ROUTE_POI_LABEL, type RoutePoiCategory } from './routePois';

/** Les trois fonds de l'Explorer : Relief (outdoor), Clair (plan), Satellite. */
export type MapBase = 'topo' | 'osm' | 'satellite';

export const MAP_BASES: ReadonlyArray<{ id: MapBase; label: string; icon: string }> = [
  { id: 'topo', label: 'Relief', icon: 'mountain' },
  { id: 'osm', label: 'Clair', icon: 'map' },
  { id: 'satellite', label: 'Satellite', icon: 'layers' },
];

export const DEFAULT_BASE: MapBase = 'topo';

/** Relit un réglage enregistré : toute valeur inconnue retombe sur Relief. */
export function parseBase(raw: unknown): MapBase {
  return MAP_BASES.find((b) => b.id === raw)?.id ?? DEFAULT_BASE;
}

export interface StepPin {
  id: string;
  lat: number;
  lng: number;
  /** « D », « A » ou le numéro de l'étape. */
  text: string;
  variant: 'start' | 'end' | 'mid';
  /** Nom accessible : « Départ : Gavarnie ». */
  label: string;
}

/**
 * Une pastille par étape géolocalisée, dans l'ordre du voyage. Départ et arrivée n'existent qu'à partir
 * de deux étapes ; une étape seule est « 1 », pas un départ qui serait aussi une arrivée.
 */
export function stepPins(
  points: ReadonlyArray<{ id: string; lat: number; lon: number; label: string; kind: 'step' | 'poi' }>
): StepPin[] {
  const steps = points.filter((p) => p.kind === 'step');
  const n = steps.length;
  return steps.map((p, i) => {
    const variant: StepPin['variant'] = n >= 2 && i === 0 ? 'start' : n >= 2 && i === n - 1 ? 'end' : 'mid';
    const number = n >= 2 ? i : i + 1;
    const text = variant === 'start' ? 'D' : variant === 'end' ? 'A' : String(number);
    const what = variant === 'start' ? 'Départ' : variant === 'end' ? 'Arrivée' : `Étape ${number}`;
    return { id: p.id, lat: p.lat, lng: p.lon, text, variant, label: `${what} : ${p.label}` };
  });
}

export interface CalloutText {
  title: string;
  /** Une ligne, faite des seules parties connues ; null s'il n'y en a aucune. */
  subtitle: string | null;
}

/**
 * L'encart du point touché : l'étape (jour, distance, dénivelé, nuit) ou le type du point. Une partie
 * absente est omise, jamais remplacée par un zéro.
 */
export function calloutOf(
  point: { label: string; kind: 'step' | 'poi'; category: string | null },
  step?: {
    day: number;
    distanceKm: number | null;
    elevationGainM: number | null;
    accommodation: string | null;
  } | null
): CalloutText {
  if (point.kind === 'step') {
    const parts = [
      step ? `Jour ${step.day}` : null,
      step && step.distanceKm != null && step.distanceKm > 0 ? formatKm(step.distanceKm) : null,
      step && step.elevationGainM != null && step.elevationGainM > 0 ? `+${Math.round(step.elevationGainM)} m` : null,
      step?.accommodation ? `nuit : ${step.accommodation}` : null,
    ].filter(Boolean);
    return { title: point.label, subtitle: parts.length ? parts.join(' · ') : null };
  }
  const kind = point.category ? (ROUTE_POI_LABEL[point.category as RoutePoiCategory] ?? point.category) : null;
  return { title: point.label, subtitle: kind };
}
