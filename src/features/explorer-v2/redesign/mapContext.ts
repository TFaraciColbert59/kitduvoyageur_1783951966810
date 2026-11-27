/**
 * Explorer 20/20 — Contextual Map Overlay Selector.
 *
 * Pure function that layers ephemeral category/lens overlays on top of the
 * user's saved `layerVisibility` without mutating store state or presets.
 *
 * Cold-boot invariant: when `detent === 'peek' && !hasInteracted`, returns
 * `userLayerVisibility` unchanged so zero unnecessary `/api/explorer/v2/*`
 * requests are triggered at mount.
 */

export type ExplorerCategory = 'explorer' | 'layers' | 'pokedex' | 'safety' | 'community';

export type ExplorerDetent = 'peek' | 'mid' | 'full';

export const EXPLORER_CATEGORY_ORDER: readonly ExplorerCategory[] = [
  'explorer',
  'layers',
  'pokedex',
  'safety',
  'community',
] as const;

export interface ExplorerMapContextParams {
  detent: ExplorerDetent;
  category: ExplorerCategory;
  lensId: string;
  userLayerVisibility: Record<string, boolean>;
  hasInteracted: boolean;
  hazardKindFilter?: 'all' | 'fire' | 'flood' | 'quake' | 'airspace';
}

export function selectExplorerMapContext({
  detent,
  category,
  lensId,
  userLayerVisibility,
  hasInteracted,
  hazardKindFilter = 'all',
}: ExplorerMapContextParams): Record<string, boolean> {
  if (detent === 'peek' && !hasInteracted) {
    return userLayerVisibility;
  }

  if (category === 'explorer' || category === 'layers') {
    return userLayerVisibility;
  }

  if (category === 'pokedex') {
    return {
      ...userLayerVisibility,
      pokedexSpecies: true,
    };
  }

  if (category === 'safety') {
    if (lensId === 'hazards') {
      return {
        ...userLayerVisibility,
        hazardFires: hazardKindFilter === 'all' || hazardKindFilter === 'fire',
        hazardFloods: hazardKindFilter === 'all' || hazardKindFilter === 'flood',
        hazardSeismic: hazardKindFilter === 'all' || hazardKindFilter === 'quake',
        airspaceAircraft:
          hazardKindFilter === 'airspace' || Boolean(userLayerVisibility.airspaceAircraft),
        dangers: true,
      };
    }
    if (lensId === 'weather') {
      return {
        ...userLayerVisibility,
        rainRadar: true,
      };
    }
    if (lensId === 'survival') {
      return {
        ...userLayerVisibility,
        water: true,
        refuges: true,
        rescue: true,
      };
    }
    return userLayerVisibility;
  }

  if (category === 'community') {
    if (lensId === 'bottles') {
      return {
        ...userLayerVisibility,
        socialBottles: true,
      };
    }
    if (lensId === 'carnets') {
      return {
        ...userLayerVisibility,
        socialCarnets: true,
      };
    }
    if (lensId === 'clubs') {
      return {
        ...userLayerVisibility,
        socialClubs: true,
      };
    }
    if (lensId === 'stories') {
      return {
        ...userLayerVisibility,
        socialStories: true,
        socialFriends: true,
      };
    }
    return userLayerVisibility;
  }

  return userLayerVisibility;
}
