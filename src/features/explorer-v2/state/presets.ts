/**
 * Presets d'activité atomiques et registre unifié des calques Explorer (Track A).
 *
 * Chaque preset active un ensemble cohérent de couches et désactive toutes
 * les autres de manière atomique afin d'éviter toute accumulation résiduelle.
 */

import type { MapBaseStyle } from './types';
import type { XpIconName } from '../ui/XpIcon';

export type ExplorerPresetId =
  | 'clean'
  | 'hiking'
  | 'trail'
  | 'mtb'
  | 'bivouac'
  | 'nautical'
  | 'safety'
  | 'pokedex'
  | 'community'
  | 'custom';

export type AtomicExplorerPresetId = Exclude<ExplorerPresetId, 'custom'>;

/** Clés historiques de visibilité déjà présentes dans Explorer v2. */
export type LegacyLayerKey =
  | 'routes'
  | 'walkRoutes'
  | 'bikeRoutes'
  | 'water'
  | 'refuges'
  | 'summits'
  | 'access'
  | 'dangers'
  | 'snow'
  | 'slope'
  | 'surfaceLayer'
  | 'hillshade'
  | 'terrain3d'
  | 'bikePois'
  | 'savedPlaces'
  | 'fires'
  | 'highlights'
  | 'distanceMarkers'
  | 'fire';

/** Nouvelles couches thématiques unifiées (plein air, nautisme, risques, biodiversité, social). */
export type ExtendedLayerKey =
  | 'wmtHiking'
  | 'wmtMtb'
  | 'wmtCycling'
  | 'wmtSlopes'
  | 'openseamap'
  | 'waterwaysNav'
  | 'rescue'
  | 'hazardFires'
  | 'rainRadar'
  | 'airspaceAircraft'
  | 'lightPollution'
  | 'hazardFloods'
  | 'avalancheSlope'
  | 'hazardSeismic'
  | 'pokedexGbif'
  | 'pokedexSpecies'
  | 'socialCarnets'
  | 'socialClubs'
  | 'socialFriends'
  | 'socialStories'
  | 'socialBottles';

export type UnifiedLayerKey = LegacyLayerKey | ExtendedLayerKey;

/** Nouvelles couches toutes désactivées par défaut au démarrage à froid. */
export const NEW_UNIFIED_LAYERS_DEFAULT_FALSE: Record<ExtendedLayerKey, boolean> = {
  wmtHiking: false,
  wmtMtb: false,
  wmtCycling: false,
  wmtSlopes: false,
  openseamap: false,
  waterwaysNav: false,
  rescue: false,
  hazardFires: false,
  rainRadar: false,
  airspaceAircraft: false,
  lightPollution: false,
  hazardFloods: false,
  avalancheSlope: false,
  hazardSeismic: false,
  pokedexGbif: false,
  pokedexSpecies: false,
  socialCarnets: false,
  socialClubs: false,
  socialFriends: false,
  socialStories: false,
  socialBottles: false,
};

/** Carte complète où chaque couche unifiée est explicitement à `false`. */
export const ALL_UNIFIED_LAYERS_FALSE: Record<UnifiedLayerKey, boolean> = {
  routes: false,
  walkRoutes: false,
  bikeRoutes: false,
  water: false,
  refuges: false,
  summits: false,
  access: false,
  dangers: false,
  snow: false,
  slope: false,
  surfaceLayer: false,
  hillshade: false,
  terrain3d: false,
  bikePois: false,
  savedPlaces: false,
  fires: false,
  highlights: false,
  distanceMarkers: false,
  fire: false,
  ...NEW_UNIFIED_LAYERS_DEFAULT_FALSE,
};

export interface ExplorerPresetDefinition {
  id: AtomicExplorerPresetId;
  label: string;
  shortLabel: string;
  description: string;
  icon: XpIconName;
  recommendedBaseStyle: MapBaseStyle;
  layers: Partial<Record<UnifiedLayerKey, boolean>>;
}

/** 9 presets atomiques d'exploration. */
export const EXPLORER_PRESETS: readonly ExplorerPresetDefinition[] = [
  {
    id: 'clean',
    label: 'Épuré',
    shortLabel: 'Épuré',
    description: 'Fond topographique lisible sans surcharge de calques.',
    icon: 'map',
    recommendedBaseStyle: 'relief',
    layers: {
      hillshade: true,
      terrain3d: true,
    },
  },
  {
    id: 'hiking',
    label: 'Rando / Montagne',
    shortLabel: 'Rando',
    description: 'Sentiers balisés, points d’eau, refuges, sommets et dangers.',
    icon: 'hike',
    recommendedBaseStyle: 'relief',
    layers: {
      routes: true,
      walkRoutes: true,
      wmtHiking: true,
      water: true,
      refuges: true,
      summits: true,
      access: true,
      dangers: true,
      snow: true,
      hillshade: true,
      terrain3d: true,
      highlights: true,
      distanceMarkers: true,
    },
  },
  {
    id: 'trail',
    label: 'Trail / Run',
    shortLabel: 'Trail',
    description: 'Itinéraires pédestres, pentes, surfaces, eau et radar pluie.',
    icon: 'run',
    recommendedBaseStyle: 'relief',
    layers: {
      routes: true,
      walkRoutes: true,
      wmtHiking: true,
      water: true,
      summits: true,
      dangers: true,
      slope: true,
      surfaceLayer: true,
      hillshade: true,
      terrain3d: true,
      distanceMarkers: true,
      rainRadar: true,
    },
  },
  {
    id: 'mtb',
    label: 'VTT / Gravel',
    shortLabel: 'VTT',
    description: 'Boucles VTT/vélo, pistes cyclables, revêtements et ateliers.',
    icon: 'bike',
    recommendedBaseStyle: 'cycle',
    layers: {
      routes: true,
      bikeRoutes: true,
      wmtMtb: true,
      wmtCycling: true,
      bikePois: true,
      water: true,
      access: true,
      dangers: true,
      surfaceLayer: true,
      hillshade: true,
      terrain3d: true,
      distanceMarkers: true,
    },
  },
  {
    id: 'bivouac',
    label: 'Bivouac / Astro',
    shortLabel: 'Bivouac',
    description: 'Eau, abris, pollution lumineuse et réglementation feu.',
    icon: 'tent',
    recommendedBaseStyle: 'relief',
    layers: {
      water: true,
      refuges: true,
      summits: true,
      dangers: true,
      fire: true,
      fires: true,
      hazardFires: true,
      lightPollution: true,
      savedPlaces: true,
      hillshade: true,
      terrain3d: true,
    },
  },
  {
    id: 'nautical',
    label: 'Nautique',
    shortLabel: 'Nautique',
    description: 'Balisage OpenSeaMap, voies navigables, crues, pluie et secours.',
    icon: 'kayak',
    recommendedBaseStyle: 'plan',
    layers: {
      openseamap: true,
      waterwaysNav: true,
      water: true,
      access: true,
      dangers: true,
      rainRadar: true,
      hazardFloods: true,
      rescue: true,
    },
  },
  {
    id: 'safety',
    label: 'Sécurité / Risques',
    shortLabel: 'Sécurité',
    description: 'Feux actifs, avalanches, crues, séismes, radar pluie et secours.',
    icon: 'shield',
    recommendedBaseStyle: 'relief',
    layers: {
      dangers: true,
      rescue: true,
      fire: true,
      fires: true,
      hazardFires: true,
      rainRadar: true,
      hazardFloods: true,
      avalancheSlope: true,
      hazardSeismic: true,
      snow: true,
      slope: true,
      airspaceAircraft: true,
      water: true,
      refuges: true,
    },
  },
  {
    id: 'pokedex',
    label: 'Pokédex',
    shortLabel: 'Pokédex',
    description: 'Observations naturalistes GBIF, faune, flore et sites remarquables.',
    icon: 'spark',
    recommendedBaseStyle: 'satellite',
    layers: {
      pokedexGbif: true,
      pokedexSpecies: true,
      highlights: true,
      water: true,
      summits: true,
      hillshade: true,
      terrain3d: true,
    },
  },
  {
    id: 'community',
    label: 'Communauté',
    shortLabel: 'Communauté',
    description: 'Carnets de voyage, clubs, amis sur le terrain et récits.',
    icon: 'users',
    recommendedBaseStyle: 'relief',
    layers: {
      socialCarnets: true,
      socialClubs: true,
      socialFriends: true,
      socialStories: true,
      socialBottles: true,
      highlights: true,
      routes: true,
      savedPlaces: true,
      hillshade: true,
    },
  },
] as const;

export const EXPLORER_PRESET_BY_ID: Record<AtomicExplorerPresetId, ExplorerPresetDefinition> =
  EXPLORER_PRESETS.reduce(
    (acc, preset) => {
      acc[preset.id] = preset;
      return acc;
    },
    {} as Record<AtomicExplorerPresetId, ExplorerPresetDefinition>,
  );

/**
 * Calcule la carte de visibilité des couches pour un preset donné.
 *
 * - Pour les 9 presets atomiques : remet toutes les clés unifiées à `false`
 *   puis active uniquement celles du preset (zéro fuite d'un preset précédent).
 * - Pour `'custom'` : conserve l'état courant complété des clés unifiées manquantes.
 */
export function computeLayerVisibilityForPreset(
  presetId: ExplorerPresetId,
  currentLayers?: Record<string, boolean>,
): Record<string, boolean> {
  if (presetId === 'custom') {
    return {
      ...ALL_UNIFIED_LAYERS_FALSE,
      ...(currentLayers ?? {}),
    };
  }

  const preset = EXPLORER_PRESET_BY_ID[presetId];
  const next: Record<string, boolean> = {
    ...(currentLayers ?? {}),
    ...ALL_UNIFIED_LAYERS_FALSE,
  };

  for (const [key, enabled] of Object.entries(preset.layers)) {
    if (typeof enabled === 'boolean') {
      next[key] = enabled;
    }
  }

  return next;
}
