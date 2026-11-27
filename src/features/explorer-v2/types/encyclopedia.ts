/**
 * Pure domain types shared between Explorer V2's headless bridges,
 * state context, and Apple Liquid Glass lenses.
 */

export type TerritorialScale = 'world' | 'continent' | 'country' | 'region' | 'city' | 'sector';

export interface TerritorialBreadcrumbNode {
  readonly id: string;
  readonly scale: TerritorialScale;
  readonly label: string;
}

export interface TerritorialHazardItem {
  readonly id: string;
  readonly title: string;
  readonly severity: 'info' | 'warn' | 'critical';
  readonly updatedAtMs: number | null;
  readonly staleThresholdMin?: number;
}

export interface TerritorialTrailItem {
  readonly id: string;
  readonly name: string;
  readonly distanceKm?: number | null;
  readonly elevationGainM?: number | null;
  readonly difficulty?: string | null;
}

export interface TerritorialPokedexSpecies {
  readonly id: string;
  readonly commonName: string;
  readonly scientificName: string;
  readonly status: 'common' | 'uncommon' | 'rare' | 'threatened';
  readonly photoUrl?: string | null;
  readonly wikipediaUrl?: string | null;
}

export interface TerritorialCommunityItem {
  readonly id: string;
  readonly kind: 'carnet' | 'club' | 'story';
  readonly title: string;
  readonly subtitle?: string | null;
  readonly thumbnailUrl?: string | null;
}

export interface TerritorialEncyclopediaData {
  readonly id: string;
  readonly scale: TerritorialScale;
  readonly name: string;
  readonly subtitle?: string | null;
  readonly breadcrumb: readonly TerritorialBreadcrumbNode[];
  readonly geography: {
    readonly biome?: string | null;
    readonly elevationRangeM?: string | null;
    readonly areaSummary?: string | null;
    readonly summaryFr?: string | null;
  };
  readonly safety: {
    readonly emergencyNumbers: readonly { readonly label: string; readonly number: string }[];
    readonly bivouacPolicyFr?: string | null;
    readonly activeHazards: readonly TerritorialHazardItem[];
  };
  readonly weatherHydrology?: {
    readonly temperatureC?: number | null;
    readonly windKmh?: number | null;
    readonly summaryFr?: string | null;
    readonly hydrologyNoteFr?: string | null;
    readonly updatedAtMs?: number | null;
  } | null;
  readonly activities: {
    readonly tags: readonly string[];
    readonly routeCount: number;
    readonly featuredTrails: readonly TerritorialTrailItem[];
  };
  readonly pokedex: readonly TerritorialPokedexSpecies[];
  readonly community: readonly TerritorialCommunityItem[];
}

export type UnifiedLayerCategory =
  | 'outdoor'
  | 'safety_live'
  | 'pokedex'
  | 'community';

export interface UnifiedLayerItem {
  readonly id: string;
  readonly category: UnifiedLayerCategory;
  readonly label: string;
  readonly description?: string | null;
  readonly enabled: boolean;
  /** Calque raster analytique soumis au plafond de 2 calques simultanés. */
  readonly isAnalyticalRaster?: boolean;
  /** Calque temps réel affichant un badge explicite de fraîcheur/obsolescence. */
  readonly isLive?: boolean;
  readonly updatedAtMs?: number | null;
  readonly staleThresholdMin?: number;
}

export const MAX_SIMULTANEOUS_ANALYTICAL_RASTERS = 2;
