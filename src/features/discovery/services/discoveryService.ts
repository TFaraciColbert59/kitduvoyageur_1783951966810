// src/features/discovery/services/discoveryService.ts
import 'server-only';
import { fetchCountryByIso } from '@/lib/geodata';
import { getTripadvisorAttribution, getViatorAttribution } from '../constants';
import { getDiscoveryProvider } from '../config';
import { DiscoveryError } from '../providers/tripadvisor/tripadvisorErrors';
import {
  isTripadvisorConfigured,
  tripadvisorSearchByCategory,
  type TripadvisorTransport,
} from '../providers/tripadvisorProvider';
import { viatorSearchByCategory } from '../providers/viator/viatorAdapter';
import { isViatorConfigured } from '../providers/viator/viatorClient';
import { resolveViatorDestinationId, resolveViatorSectionTags } from '../providers/viator/viatorData';
import { resolveLimit } from '../schemas/discovery.schema';
import type {
  DiscoveryCategory,
  DiscoveryResponse,
  DiscoverySectionName,
} from '../types/discovery.types';

export interface GetDiscoveryParams {
  countryCode: string;
  category: DiscoveryCategory;
  /** Section Pays (permet un gating par provider, ex. Viator réservé à Activités). */
  section?: DiscoverySectionName;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Point d'entrée unique de la couche découverte POI. Ne lève jamais.
 *
 * Sélection serveur, SANS fallback automatique :
 * - `viator` → `POST /products/search` (1 appel/section, ≤ 6 produits) ;
 * - `klook` / `editorial` → aucun appel externe (blocs Klook éditoriaux à part) ;
 * - `terra` / `legacy` → uniquement si explicitement sélectionnés.
 */
export async function getDiscovery(params: GetDiscoveryParams): Promise<DiscoveryResponse> {
  const code = params.countryCode.toUpperCase();
  const limit = resolveLimit(params.category, params.limit);
  const base = {
    category: params.category,
    countryCode: code,
    items: [] as DiscoveryResponse['items'],
  };

  const provider = getDiscoveryProvider();

  // ── Viator ────────────────────────────────────────────────────────────────
  if (provider === 'viator') {
    const viatorBase = {
      ...base,
      provider: 'viator' as const,
      attribution: getViatorAttribution(),
    };

    if (!isViatorConfigured()) {
      return { ...viatorBase, status: 'unconfigured', reason: 'missing_config' };
    }
    // Hébergements : Viator ne distribue pas de logements → section éditoriale.
    if (params.section === 'hebergements') {
      return { ...viatorBase, status: 'unconfigured', reason: 'missing_config' };
    }
    const destinationId = resolveViatorDestinationId(code);
    if (!destinationId) {
      return {
        ...viatorBase,
        status: 'unconfigured',
        reason: 'missing_config',
        message: 'Destination Viator non configurée.',
      };
    }

    // Filtres par tags OFFICIELS selon la section (aucun tag inventé).
    const tags = resolveViatorSectionTags(params.section);

    try {
      const items = await viatorSearchByCategory({
        destinationId,
        category: params.category,
        limit,
        countryCode: code,
        tags,
        signal: params.signal,
      });
      if (items.length === 0) return { ...viatorBase, status: 'empty', reason: 'empty' };
      return { ...viatorBase, status: 'ok', items };
    } catch (error) {
      if (error instanceof DiscoveryError) {
        return {
          ...viatorBase,
          status: error.code === 'quota' ? 'quota' : 'error',
          reason: error.reason,
          message: error.message,
        };
      }
      return { ...viatorBase, status: 'error', reason: 'upstream' };
    }
  }

  // ── Klook / editorial : aucun appel externe ───────────────────────────────
  const tripadvisorBase = {
    ...base,
    provider: 'tripadvisor' as const,
    attribution: getTripadvisorAttribution(),
  };
  if (provider === 'klook' || provider === 'editorial') {
    return { ...tripadvisorBase, status: 'unconfigured', reason: 'missing_config' };
  }

  // ── Terra / Legacy (explicite uniquement, jamais par défaut) ─────────────
  const transport: TripadvisorTransport = provider; // 'terra' | 'legacy'
  if (!isTripadvisorConfigured(transport)) {
    return {
      ...tripadvisorBase,
      status: 'unconfigured',
      reason: 'missing_config',
      message: 'Fournisseur de découverte non configuré.',
    };
  }

  let searchQuery: string;
  try {
    const geo = await fetchCountryByIso(code);
    if (!geo) {
      return { ...tripadvisorBase, status: 'error', reason: 'unknown_country', message: 'Pays inconnu.' };
    }
    searchQuery = geo.capital || geo.name_en || geo.name;
  } catch {
    return {
      ...tripadvisorBase,
      status: 'error',
      reason: 'referential_error',
      message: 'Référentiel géographique indisponible.',
    };
  }

  try {
    const items = await tripadvisorSearchByCategory(
      { countryCode: code, searchQuery, category: params.category, limit, signal: params.signal },
      transport
    );
    if (items.length === 0) return { ...tripadvisorBase, status: 'empty', reason: 'empty' };
    return { ...tripadvisorBase, status: 'ok', items };
  } catch (error) {
    if (error instanceof DiscoveryError) {
      return {
        ...tripadvisorBase,
        status: error.code === 'quota' ? 'quota' : 'error',
        reason: error.reason,
        message: error.message,
      };
    }
    return { ...tripadvisorBase, status: 'error', reason: 'upstream' };
  }
}
