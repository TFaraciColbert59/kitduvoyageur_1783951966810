// src/features/discovery/constants.ts
import type { DiscoveryAttribution } from './types/discovery.types';

export const TRIPADVISOR_ATTRIBUTION_LABEL = 'Données fournies par Tripadvisor';

/**
 * Assets d'attribution. Les bulles de notation proviennent TOUJOURS de l'API
 * (`ratingImageUrl`).
 *
 * ⚠️ LOGO DE PRODUCTION À VALIDER : aucune URL de logo n'est codée en dur ni
 * inventée. Tant qu'un asset officiel n'a pas été fourni/autorisé par
 * Tripadvisor, `TRIPADVISOR_LOGO_URL` reste vide et l'attribution est
 * **textuelle**. Renseigner `TRIPADVISOR_LOGO_URL` (env serveur) avec l'asset
 * officiel activera le logo.
 */
export const TRIPADVISOR_LOGO_URL = '';

export const TRIPADVISOR_SOURCE_URL = 'https://www.tripadvisor.com/';

export const VIATOR_ATTRIBUTION_LABEL = 'Offres et liens fournis par Viator';
export const VIATOR_SOURCE_URL = 'https://www.viator.com/';

export function getViatorAttribution(): DiscoveryAttribution {
  return {
    provider: 'viator',
    label: VIATOR_ATTRIBUTION_LABEL,
    logoUrl: '',
    sourceUrl: VIATOR_SOURCE_URL,
  };
}

export function getTripadvisorAttribution(): DiscoveryAttribution {
  const envLogo =
    typeof process !== 'undefined' && process.env ? process.env.TRIPADVISOR_LOGO_URL : undefined;
  return {
    provider: 'tripadvisor',
    label: TRIPADVISOR_ATTRIBUTION_LABEL,
    logoUrl: envLogo || TRIPADVISOR_LOGO_URL,
    sourceUrl: TRIPADVISOR_SOURCE_URL,
  };
}
