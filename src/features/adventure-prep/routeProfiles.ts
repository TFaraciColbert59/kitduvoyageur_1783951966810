import type { TravelMode } from './types';

/**
 * Profils de calcul du parcours (R01 · K2.03).
 *
 * Le service historique ne connaît que trois modes (`pieton`, `velo`,
 * `voiture`). Un parcours sportif a besoin de distinguer route, gravel, VTT et
 * enduro : ce sont les mêmes coordonnées, mais pas le même réseau ni les mêmes
 * préférences. Les profils ci-dessous sont volontairement séparés du
 * vocabulaire `TravelMode` persisté : aucune ligne existante ne change.
 *
 * Règle de provenance : un profil déclare ce que chaque fournisseur sait
 * réellement faire. Geoapify reçoit son mode ; Valhalla reçoit un `costing` et
 * ses options. Si un fournisseur refuse un profil spécialisé, le repli
 * Valhalla est autorisé : son refus n'est pas une mesure du sport.
 */
export type RouteSport = 'marche' | 'route' | 'gravel' | 'vtt' | 'enduro';

export const ROUTE_SPORTS = ['marche', 'route', 'gravel', 'vtt', 'enduro'] as const;

export const MAX_ROUTE_WAYPOINTS = 12;

export type SurfacePreference = 'balanced' | 'prefer_paved' | 'prefer_unpaved' | 'prefer_trails';

export const SURFACE_PREFERENCES: readonly SurfacePreference[] = [
  'balanced',
  'prefer_paved',
  'prefer_unpaved',
  'prefer_trails',
];

export interface RouteRoutingOptions {
  readonly ebike?: boolean;
  readonly surfacePref?: SurfacePreference;
  readonly avoidSteps?: boolean;
  readonly avoidFerries?: boolean;
}

export function isSurfacePreference(value: unknown): value is SurfacePreference {
  return typeof value === 'string' && (SURFACE_PREFERENCES as readonly string[]).includes(value);
}

export function ebikeSupportedForSport(sport: RouteSport): boolean {
  return sport === 'route' || sport === 'gravel' || sport === 'vtt';
}

export function normalizeRoutingOptions(
  sport: RouteSport,
  options?: RouteRoutingOptions | null
): RouteRoutingOptions {
  if (!options) return {};
  return {
    ...(options.ebike && ebikeSupportedForSport(sport) ? { ebike: true } : {}),
    ...(options.surfacePref && options.surfacePref !== 'balanced'
      ? { surfacePref: options.surfacePref }
      : {}),
    ...(options.avoidSteps ? { avoidSteps: true } : {}),
    ...(options.avoidFerries ? { avoidFerries: true } : {}),
  };
}

export interface RouteSportProfile {
  readonly id: RouteSport;
  /** Mode historique dont ce profil se rapproche (cache, repli, compatibilité). */
  readonly mode: TravelMode;
  /** `mode` Geoapify réellement demandé. */
  readonly geoapifyMode: string;
  /** `costing` Valhalla réellement demandé. */
  readonly valhallaCosting: string;
  /**
   * Options Valhalla du `costing`. `bicycle_type` distingue route, gravel et
   * VTT ; `use_trails` / `use_roads` restent des préférences souples, jamais
   * une promesse d'exclusion.
   */
  readonly valhallaOptions?: Readonly<Record<string, unknown>>;
  /**
   * Un refus Geoapify d'un profil spécialisé n'est pas une mesure du sport :
   * Valhalla est consulté avec le profil complet. Faux pour la marche, dont le
   * graphe Geoapify est le même que le mode piéton historique.
   */
  readonly fallbackOnRefusal: boolean;
}

const PROFILES: Readonly<Record<RouteSport, RouteSportProfile>> = {
  marche: {
    id: 'marche',
    mode: 'pieton',
    geoapifyMode: 'hike',
    valhallaCosting: 'pedestrian',
    fallbackOnRefusal: false,
  },
  route: {
    id: 'route',
    mode: 'velo',
    geoapifyMode: 'road_bike',
    valhallaCosting: 'bicycle',
    valhallaOptions: { bicycle_type: 'Road', use_trails: 0, use_roads: 0.9 },
    fallbackOnRefusal: true,
  },
  gravel: {
    id: 'gravel',
    mode: 'velo',
    geoapifyMode: 'bicycle',
    valhallaCosting: 'bicycle',
    valhallaOptions: { bicycle_type: 'Cross', use_trails: 0.55, use_roads: 0.45 },
    fallbackOnRefusal: true,
  },
  vtt: {
    id: 'vtt',
    mode: 'velo',
    geoapifyMode: 'mountain_bike',
    valhallaCosting: 'bicycle',
    valhallaOptions: { bicycle_type: 'Mountain', use_trails: 0.9, use_roads: 0.1 },
    fallbackOnRefusal: true,
  },
  enduro: {
    id: 'enduro',
    mode: 'voiture',
    geoapifyMode: 'motorcycle',
    valhallaCosting: 'motorcycle',
    valhallaOptions: { use_trails: 1, use_highways: 0, use_tolls: 0 },
    fallbackOnRefusal: true,
  },
};

/** Un sport inconnu est refusé, jamais remplacé par un défaut silencieux. */
export function isRouteSport(value: unknown): value is RouteSport {
  return typeof value === 'string' && (ROUTE_SPORTS as readonly string[]).includes(value);
}

export function routingCacheKeyForSport(
  sport: RouteSport,
  options?: RouteRoutingOptions | null
): string {
  const n = normalizeRoutingOptions(sport, options);
  const parts: string[] = [sport];
  if (n.ebike) parts.push('ebike');
  if (n.surfacePref) parts.push(`surf=${n.surfacePref}`);
  if (n.avoidSteps) parts.push('nosteps');
  if (n.avoidFerries) parts.push('noferry');
  return parts.join(':');
}

export function routingProfileForSport(
  sport: RouteSport,
  options?: RouteRoutingOptions | null
): RouteSportProfile {
  const base = PROFILES[sport];
  const normalized = normalizeRoutingOptions(sport, options);
  if (Object.keys(normalized).length === 0) return base;

  const valhallaOptions: Record<string, unknown> = { ...(base.valhallaOptions ?? {}) };
  if (normalized.ebike && base.valhallaCosting === 'bicycle') {
    valhallaOptions.use_ebike = true;
    valhallaOptions.cycling_speed = sport === 'vtt' ? 19 : sport === 'gravel' ? 23 : 27;
  }
  if (normalized.surfacePref === 'prefer_paved') {
    valhallaOptions.use_roads = 0.95;
    valhallaOptions.use_tracks = 0.1;
    valhallaOptions.use_trails = 0.05;
  } else if (normalized.surfacePref === 'prefer_unpaved') {
    valhallaOptions.use_roads = 0.25;
    valhallaOptions.use_tracks = 0.85;
    valhallaOptions.use_trails = 0.5;
  } else if (normalized.surfacePref === 'prefer_trails') {
    valhallaOptions.use_roads = 0.1;
    valhallaOptions.use_tracks = 0.7;
    valhallaOptions.use_trails = 0.95;
  }
  if (normalized.avoidSteps) {
    valhallaOptions.step_penalty = 900;
  }
  if (normalized.avoidFerries) {
    valhallaOptions.use_ferry = 0;
  }

  return {
    ...base,
    valhallaOptions,
  };
}

/**
 * Profil de départ proposé par l'activité du voyage. Ce n'est qu'une
 * proposition : l'éditeur affiche les cinq profils et la personne choisit.
 */
export function routeSportForActivity(activity: string | null | undefined): RouteSport {
  return activity === 'cycling' ? 'route' : 'marche';
}
