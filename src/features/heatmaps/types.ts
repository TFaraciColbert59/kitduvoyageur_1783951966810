/**
 * Lot C02 — Heatmaps communautaires/personnelles et agrégats géographiques
 * soumis aux règles de confidentialité (K3.07, K3.08, K7.06, S3.16, S3.17,
 * S3.18, S3.19, S6.17).
 *
 * Contrat TypeScript pur et autonome : aucune dépendance vers ExplorerV2.tsx,
 * SheetContent.tsx, useGpsTracker.ts ni state/store.ts.
 */

import type { Sport } from '../explorer-v2/state/types';

export type { Sport };

/** Version du moteur d'agrégation spatiale des heatmaps (invalidation de cache). */
export const HEATMAP_PROCESSOR_VERSION = 'c02-heatmap-v1';

/**
 * Seuil normatif de k-anonymat pour toute cellule de heatmap publique (K3.07, S3.16).
 * Une cellule doit compter au moins 5 contributeurs distincts éligibles pour être publiée.
 */
export const MIN_HEATMAP_CONTRIBUTORS = 5;

/**
 * Plancher absolu de sécurité pour le k-anonymat public : même si un appelant
 * tente de baisser `minContributors`, le moteur public ne descend jamais sous 3.
 */
export const ABSOLUTE_MIN_PUBLIC_CONTRIBUTORS = 3;

/** Fenêtre glissante de la heatmap récente (S3.17 : 7 derniers jours). */
export const HEATMAP_RECENT_WINDOW_DAYS = 7;

/** Âge maximal par défaut des traces dans la heatmap globale (2 ans = 730 jours). */
export const HEATMAP_GLOBAL_MAX_AGE_DAYS = 730;

/** Résolution de grille par défaut en degrés (~110 m en latitude à l'équateur). */
export const DEFAULT_GRID_RESOLUTION_DEG = 0.001;

/** Résolution minimale autorisée pour une grille publique (~22 m) afin d'éviter toute reconstruction fine. */
export const MIN_PUBLIC_GRID_RESOLUTION_DEG = 0.0002;

/** Filtre de sport : un sport spécifique du catalogue LKDV ou `'all'` (tous sports confondus). */
export type HeatmapSportFilter = Sport | 'all';

/**
 * Fenêtre temporelle pour les heatmaps communautaires (S3.16, S3.17, S3.18) :
 * - `'global'` : toutes les traces éligibles (S3.16, K3.07)
 * - `'last_7_days'` : traces des 7 derniers jours (S3.17)
 * - `'nocturnal'` : passages effectués entre le coucher et le lever du soleil (S3.18)
 */
export type CommunityTimeWindow = 'global' | 'last_7_days' | 'nocturnal';

/**
 * Période de sélection pour la heatmap personnelle privée (K3.08, S3.19).
 */
export type PersonalTimePeriodKind =
  | 'all_time'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'year_to_date'
  | 'custom';

export interface PersonalTimeFilter {
  kind: PersonalTimePeriodKind;
  /** Borne inférieure ISO (requise si `kind === 'custom'`). */
  fromIso?: string;
  /** Borne supérieure ISO (requise si `kind === 'custom'`). */
  toIso?: string;
  /** Filtre optionnel nocturne uniquement sur la heatmap personnelle. */
  nocturnalOnly?: boolean;
}

/**
 * Finalités de contribution aux données agrégées distinguées par S6.17 et K7.06 :
 * - `'global_heatmap'` : heatmap mondiale / communautaire par sport (K7.06, K3.07, S3.16..S3.18)
 * - `'route_recommendations'` : suggestions de parcours et popularité d'itinéraires (S6.17)
 * - `'mobility_aggregates'` : agrégats de mobilité et de segments terrain (S6.17)
 */
export type AggregateContributionScope =
  | 'global_heatmap'
  | 'route_recommendations'
  | 'mobility_aggregates';

/**
 * Préférences granulaires de contribution d'un utilisateur (K7.06, S6.17).
 * Invariant fail-closed : toute préférence absente ou `globalHeatmapOptOut === true`
 * bloque la contribution.
 */
export interface AggregateContributionPreferences {
  userId: string;
  /**
   * Opt-out global strict de la heatmap mondiale (K7.06).
   * S'il est à `true`, `globalHeatmap` est forcé à `false` (priorité à l'opt-out).
   */
  globalHeatmapOptOut: boolean;
  /** Consentement explicite à la heatmap communautaire/mondiale (K7.06 / S6.17). */
  globalHeatmap: boolean;
  /** Consentement explicite aux agrégats de recommandation de parcours (S6.17). */
  routeRecommendations: boolean;
  /** Consentement explicite aux données agrégées de mobilité/segments (S6.17). */
  mobilityAggregates: boolean;
  /** Horodatage ISO de la dernière modification ou révocation. */
  updatedAt: string;
  /** Incrément de révision pour invalider les caches avals. */
  revision: number;
}

/**
 * Zone géographique masquée (K7.05 / S6.14).
 * Tout point tombant dans une zone active de l'utilisateur est exclu des agrégats publics.
 */
export type PrivacyZoneGeometry =
  | {
      kind: 'circle';
      centerLat: number;
      centerLng: number;
      /** Rayon d'exclusion en mètres (ex: 200m à 1600m autour du domicile). */
      radiusM: number;
    }
  | {
      kind: 'bbox';
      minLat: number;
      minLng: number;
      maxLat: number;
      maxLng: number;
    }
  | {
      kind: 'polygon';
      /** Anneau extérieur en coordonnées `[lat, lng]`. */
      ring: readonly [number, number][];
    };

export interface UserPrivacyZone {
  id: string;
  userId: string;
  label?: string;
  active: boolean;
  geometry: PrivacyZoneGeometry;
}

/**
 * Règle de masquage par activité ou par profil (S6.14 : masquer début, fin ou totalité du tracé).
 */
export interface TraceMaskingRule {
  /** Distance à masquer au départ de la trace (en mètres). */
  trimStartM?: number;
  /** Distance à masquer à l'arrivée de la trace (en mètres). */
  trimEndM?: number;
  /** Masquer l'intégralité du tracé sur les cartes partagées/publiques. */
  hideEntireTrace?: boolean;
}

/** Point GPS d'entrée d'une trace d'activité. */
export interface HeatmapTrackPoint {
  lat: number;
  lng: number;
  /** Horodatage ISO-8601 du point (requis pour S3.17 / S3.18 si l'activité n'a pas de `startedAt`). */
  timestamp?: string | null;
  elevationM?: number | null;
}

/** Visibilité d'une sortie dans LKDV (`private` ou `collective_anonymized` / `'public'`). */
export type HeatmapActivityVisibility = 'private' | 'followers_only' | 'collective_anonymized' | 'public';

/** Activité source soumise au moteur de heatmap. */
export interface HeatmapActivityRecord {
  activityId: string;
  userId: string;
  sport: Sport;
  /** Visibilité de la sortie (P01). `'private'` et `'followers_only'` sont exclus du public. */
  visibility: HeatmapActivityVisibility;
  /** Drapeau explicite de sortie privée (fail-closed). */
  isPrivate?: boolean;
  /** Exclusion unitaire de cette sortie des heatmaps publiques. */
  excludeFromHeatmap?: boolean;
  /** La séance doit être terminée (`true` par défaut si omis, `false` exclut du public). */
  sessionFinished?: boolean;
  /** Suppression logique (A02) : une activité soft-deleted est exclue partout. */
  deletedAt?: string | null;
  /** Horodatage ISO de début de la sortie. */
  startedAt: string;
  /** Horodatage ISO de fin de la sortie. */
  endedAt?: string | null;
  /** Règle de masquage S6.14 propre à la sortie. */
  maskingRule?: TraceMaskingRule;
  /** Échantillons GPS de la trace. */
  points: readonly HeatmapTrackPoint[];
}

/** Niveau visuel de chaleur normalisé d'une cellule. */
export type HeatmapIntensityBand = 'low' | 'medium' | 'high' | 'peak';

/** Bornes géographiques `[minLng, minLat, maxLng, maxLat]` d'une cellule de grille. */
export type CellBBox = readonly [number, number, number, number];

/**
 * Cellule agrégée publique (K3.07, S3.16, S3.17, S3.18).
 *
 * Invariant de confidentialité :
 * - Contient uniquement le centroïde quantifié de la cellule et ses bornes de grille.
 * - Ne contient JAMAIS d'identifiant utilisateur, d'identifiant d'activité,
 *   d'horodatage individuel ni de coordonnée GPS brute.
 */
export interface PublicHeatmapCell {
  /** Identifiant déterministe de la cellule (`z:row:col`). */
  cellId: string;
  /** Latitude du centre géométrique de la cellule de grille (jamais un point brut). */
  cellCenterLat: number;
  /** Longitude du centre géométrique de la cellule de grille (jamais un point brut). */
  cellCenterLng: number;
  /** Emprise `[minLng, minLat, maxLng, maxLat]` de la cellule. */
  cellBounds: CellBBox;
  /** Nombre d'utilisateurs distincts ayant contribué à cette cellule (>= MIN_HEATMAP_CONTRIBUTORS). */
  distinctContributorCount: number;
  /** Nombre de passages d'activités distinctes dans cette cellule. */
  passageCount: number;
  /** Intensité normalisée dans `[0, 1]`. */
  intensity: number;
  /** Bande d'intensité pour le style de couche carte. */
  band: HeatmapIntensityBand;
}

/**
 * Cellule de heatmap personnelle privée (K3.08, S3.19).
 * Accessible uniquement au propriétaire (`ownerUserId === viewerUserId`).
 */
export interface PersonalHeatmapCell {
  cellId: string;
  cellCenterLat: number;
  cellCenterLng: number;
  cellBounds: CellBBox;
  /** Nombre de sorties du propriétaire passant par cette cellule. */
  activityCount: number;
  /** Nombre total d'échantillons ou traversées du propriétaire dans la cellule. */
  pointCount: number;
  /** Intensité relative personnelle dans `[0, 1]`. */
  intensity: number;
  band: HeatmapIntensityBand;
  /** Sports pratiqués par le propriétaire dans cette cellule. */
  sports: Sport[];
  /** Date ISO du dernier passage personnel dans la cellule. */
  lastVisitedAt: string | null;
}

/** Feature GeoJSON d'une cellule de heatmap (centroïde Point avec bbox de cellule). */
export interface HeatmapGeoJsonFeature<P> {
  type: 'Feature';
  id: string;
  bbox: CellBBox;
  geometry: {
    type: 'Point';
    coordinates: readonly [number, number];
  };
  properties: P;
}

export interface HeatmapGeoJsonCollection<P> {
  type: 'FeatureCollection';
  features: HeatmapGeoJsonFeature<P>[];
}

/** Résultat complet du calcul d'une couche de heatmap communautaire/publique. */
export interface PublicHeatmapLayer {
  kind: 'community';
  processorVersion: string;
  sport: HeatmapSportFilter;
  timeWindow: CommunityTimeWindow;
  gridResolutionDeg: number;
  minContributors: number;
  computedAt: string;
  /** Cellules publiables (ayant toutes `distinctContributorCount >= minContributors`). */
  cells: PublicHeatmapCell[];
  /** Nombre de cellules supprimées par le filtre de k-anonymat. */
  suppressedCellCount: number;
  /** Nombre d'activités éligibles retenues après filtrage consentement/visibilité/fenêtre. */
  eligibleActivityCount: number;
  /** Nombre d'activités rejetées (opt-out, privées, hors fenêtre, supprimées). */
  excludedActivityCount: number;
  /** Nombre de points individuels retirés par les zones de confidentialité (K7.05/S6.14). */
  maskedPointCount: number;
  /** Export GeoJSON directement consommable par MapLibre. */
  geojson: HeatmapGeoJsonCollection<Omit<PublicHeatmapCell, 'cellBounds'>>;
}

/** Résultat complet du calcul d'une couche de heatmap personnelle privée. */
export interface PersonalHeatmapLayer {
  kind: 'personal';
  ownerUserId: string;
  sports: readonly Sport[] | 'all';
  period: PersonalTimeFilter;
  includePrivateActivities: boolean;
  gridResolutionDeg: number;
  computedAt: string;
  cells: PersonalHeatmapCell[];
  activityCount: number;
  geojson: HeatmapGeoJsonCollection<Omit<PersonalHeatmapCell, 'cellBounds'>>;
}

export type { PersonalHeatmapComparison } from './personalHeatmap';
