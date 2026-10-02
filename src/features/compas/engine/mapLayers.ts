/**
 * Calques de la carte du Compas (maquette finale : « Personnaliser la carte »).
 * Seulement des calques dont la donnée existe : étapes du voyage, points
 * OpenStreetMap du tracé par catégorie, profil d'altitude. Fonctions pures.
 */

export type MapLayer =
  'etapes' | 'water' | 'refuge' | 'camping' | 'viewpoint' | 'peak' | 'parking' | 'profil';

export const MAP_LAYERS: ReadonlyArray<{ id: MapLayer; label: string; icon: string }> = [
  { id: 'etapes', label: 'Étapes', icon: 'route' },
  { id: 'water', label: 'Eau', icon: 'droplet' },
  { id: 'refuge', label: 'Refuges', icon: 'home' },
  { id: 'camping', label: 'Camping', icon: 'tent' },
  { id: 'viewpoint', label: 'Vues', icon: 'eye' },
  { id: 'peak', label: 'Sommets', icon: 'mountain' },
  { id: 'parking', label: 'Parkings', icon: 'car' },
  { id: 'profil', label: 'Profil', icon: 'trending-up' },
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
