import type { LKDVIconName } from '@/components/ui/LKDVIcon';
/**
 * Calques de la carte du Compas (maquette finale : « Personnaliser la carte »).
 * Seulement des calques dont la donnée existe : étapes du voyage, points
 * OpenStreetMap du tracé par catégorie, profil d'altitude. Fonctions pures.
 */

export type MapLayer =
  | 'etapes'
  | 'resto'
  | 'commerce'
  | 'sante'
  | 'hebergement'
  | 'transport'
  | 'water'
  | 'refuge'
  | 'camping'
  | 'toilets'
  | 'viewpoint'
  | 'peak'
  | 'parking'
  | 'profil';

export const MAP_LAYERS: ReadonlyArray<{ id: MapLayer; label: string; icon: LKDVIconName }> = [
  { id: 'etapes', label: 'Étapes', icon: 'itineraire' },
  { id: 'resto', label: 'Restos', icon: 'feu' },
  { id: 'commerce', label: 'Commerces', icon: 'panier' },
  { id: 'sante', label: 'Santé', icon: 'trousse' },
  { id: 'hebergement', label: 'Hébergements', icon: 'hotel' },
  { id: 'transport', label: 'Transports', icon: 'bus' },
  { id: 'water', label: 'Eau', icon: 'eau_potable' },
  { id: 'refuge', label: 'Refuges', icon: 'accueil' },
  { id: 'camping', label: 'Camping', icon: 'tente' },
  { id: 'toilets', label: 'Toilettes', icon: 'eau_potable' },
  { id: 'viewpoint', label: 'Vues', icon: 'vue' },
  { id: 'peak', label: 'Sommets', icon: 'montagne' },
  { id: 'parking', label: 'Parkings', icon: 'voiture' },
  { id: 'profil', label: 'Profil', icon: 'denivele' },
];

export type LayerState = Record<MapLayer, boolean>;

export const ALL_LAYERS: LayerState = Object.fromEntries(
  MAP_LAYERS.map((l) => [l.id, true])
) as LayerState;

export const NO_LAYERS: LayerState = Object.fromEntries(
  MAP_LAYERS.map((l) => [l.id, false])
) as LayerState;

/** Le calque d'un point de la carte (étape du voyage ou point du tracé). */
export function layerOf(p: { kind: 'step' | 'poi'; category: string | null }): MapLayer | null {
  if (p.kind === 'step') return 'etapes';
  const c = p.category as MapLayer | null;
  return c && c in ALL_LAYERS && c !== 'etapes' && c !== 'profil' ? c : null;
}

export function visiblePoints<T extends { kind: 'step' | 'poi'; category: string | null }>(
  points: readonly T[],
  layers: LayerState
): T[] {
  return points.filter((p) => {
    const l = layerOf(p);
    return l == null || layers[l];
  });
}

/** Relit un réglage enregistré : toute valeur inconnue retombe sur « affiché ». */
export function parseLayers(raw: unknown): LayerState {
  const out = { ...ALL_LAYERS };
  if (raw && typeof raw === 'object')
    for (const l of MAP_LAYERS) {
      const v = (raw as Record<string, unknown>)[l.id];
      if (typeof v === 'boolean') out[l.id] = v;
    }
  return out;
}
