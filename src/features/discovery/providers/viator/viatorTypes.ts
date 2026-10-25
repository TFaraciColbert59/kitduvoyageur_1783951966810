// src/features/discovery/providers/viator/viatorTypes.ts
import type { DiscoveryCategory } from '../../types/discovery.types';

export interface ViatorSearchParams {
  /** Identifiant de destination Viator (numérique, sous forme de chaîne). */
  destinationId: string;
  category: DiscoveryCategory;
  limit: number;
  countryCode: string;
  /** Tags Viator (numériques) — ex. filtre culinaire pour la Gastronomie. */
  tags?: number[];
  currency?: string;
  /** Date de recherche au format YYYY-MM-DD (filtre, pas une disponibilité confirmée). */
  date?: string;
  /** Nombre de voyageurs (filtre, pas une disponibilité confirmée). */
  travelers?: number;
  language?: string;
  signal?: AbortSignal;
}
