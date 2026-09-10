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
  language?: string;
  signal?: AbortSignal;
}
