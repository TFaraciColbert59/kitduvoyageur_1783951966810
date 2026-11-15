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

export function routingProfileForSport(sport: RouteSport): RouteSportProfile {
  return PROFILES[sport];
}

/**
 * Profil de départ proposé par l'activité du voyage. Ce n'est qu'une
 * proposition : l'éditeur affiche les cinq profils et la personne choisit.
 */
export function routeSportForActivity(activity: string | null | undefined): RouteSport {
  return activity === 'cycling' ? 'route' : 'marche';
}
