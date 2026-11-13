/**
 * Contrats HTTP du lot C02 — heatmaps communautaires, personnelles et
 * préférences granulaires de contribution (K3.07, K3.08, K7.06, S3.16..S3.19,
 * S6.17).
 *
 * Les types métier restent la propriété de `src/features/heatmaps/` : ce fichier
 * ne décrit que l'enveloppe transportée par les routes et consommée par l'UI.
 */

import type {
  AggregateContributionPreferences,
  PersonalHeatmapComparison,
  PersonalHeatmapLayer,
  PublicHeatmapLayer,
} from '@/features/heatmaps/types';

export interface CommunityHeatmapResponse {
  layer: PublicHeatmapLayer;
}

export interface PersonalHeatmapResponse {
  layer: PersonalHeatmapLayer;
  comparison: PersonalHeatmapComparison | null;
}

export interface HeatmapPreferencesResponse {
  preferences: AggregateContributionPreferences;
}

export interface HeatmapOptOutResponse extends HeatmapPreferencesResponse {
  revokedAt: string;
}

export interface HeatmapApiErrorBody {
  error: string;
  code?: string;
}
