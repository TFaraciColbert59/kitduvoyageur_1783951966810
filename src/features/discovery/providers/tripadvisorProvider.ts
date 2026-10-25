// src/features/discovery/providers/tripadvisorProvider.ts
// Sélection serveur du transport Tripadvisor : Terra (défaut) ou legacy.
// Cette configuration n'est JAMAIS exposée au navigateur.
import 'server-only';
import type { DiscoveryItem, DiscoverySearchParams } from '../types/discovery.types';
import { configError } from './tripadvisor/tripadvisorErrors';
import { legacySearchByCategory } from './tripadvisor/tripadvisorAdapter';
import { isLegacyTripadvisorConfigured } from './tripadvisor/tripadvisorClient';
import { terraSearchByCategory } from './tripadvisor-terra/terraAdapter';
import { isTerraConfigured } from './tripadvisor-terra/terraClient';

export type TripadvisorTransport = 'terra' | 'legacy' | 'none';

/**
 * `TRIPADVISOR_PROVIDER` = `terra` | `legacy` (optionnel).
 * Sans valeur : Terra si sa clé est présente, sinon legacy, sinon `none`.
 * Ne considère jamais qu'une clé legacy fonctionne avec Terra (et inversement).
 */
export function selectTripadvisorTransport(): TripadvisorTransport {
  const requested = (process.env.TRIPADVISOR_PROVIDER || '').trim().toLowerCase();
  if (requested === 'terra') return isTerraConfigured() ? 'terra' : 'none';
  if (requested === 'legacy') return isLegacyTripadvisorConfigured() ? 'legacy' : 'none';
  if (isTerraConfigured()) return 'terra';
  if (isLegacyTripadvisorConfigured()) return 'legacy';
  return 'none';
}

export function isTripadvisorConfigured(forced?: TripadvisorTransport): boolean {
  if (forced === 'terra') return isTerraConfigured();
  if (forced === 'legacy') return isLegacyTripadvisorConfigured();
  return selectTripadvisorTransport() !== 'none';
}

export async function tripadvisorSearchByCategory(
  params: DiscoverySearchParams,
  forced?: TripadvisorTransport
): Promise<DiscoveryItem[]> {
  const transport = forced && forced !== 'none' ? forced : selectTripadvisorTransport();
  if (transport === 'terra') return terraSearchByCategory(params);
  if (transport === 'legacy') return legacySearchByCategory(params);
  throw configError();
}
