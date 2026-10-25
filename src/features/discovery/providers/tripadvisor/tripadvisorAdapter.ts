// src/features/discovery/providers/tripadvisor/tripadvisorAdapter.ts
import type { DiscoveryItem, DiscoverySearchParams } from '../../types/discovery.types';
import { taLocationDetails, taSearchLocations } from './tripadvisorClient';
import type { TaLocationDetails, TaSearchItem } from './tripadvisorSchemas';

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Une note/0 avis n'est jamais affiché : on normalise l'absence en `null`. */
function positiveOrNull(value: number | null): number | null {
  return value != null && value > 0 ? value : null;
}

function resolvePhotoUrl(details: TaLocationDetails | null): string | null {
  const images = details?.photo?.images;
  return images?.original?.url || images?.large?.url || images?.medium?.url || null;
}

function resolveCategoryLabel(details: TaLocationDetails | null): string | null {
  return (
    details?.cuisine?.[0]?.localized_name ||
    details?.cuisine?.[0]?.name ||
    details?.subcategory?.[0]?.localized_name ||
    details?.subcategory?.[0]?.name ||
    details?.category?.localized_name ||
    details?.category?.name ||
    null
  );
}

export function normalizeLocation(params: {
  countryCode: string;
  category: DiscoveryItem['type'];
  searchItem: TaSearchItem;
  details: TaLocationDetails | null;
}): DiscoveryItem {
  const { countryCode, category, searchItem, details } = params;
  const address = details?.address_obj ?? searchItem.address_obj ?? null;

  return {
    id: String(searchItem.location_id),
    provider: 'tripadvisor',
    type: category,
    name: details?.name || searchItem.name,
    description: details?.description || null,
    countryCode: countryCode.toUpperCase(),
    city: address?.city || null,
    address: address?.address_string || null,
    latitude: toNumber(details?.latitude),
    longitude: toNumber(details?.longitude),
    rating: positiveOrNull(toNumber(details?.rating)),
    reviewCount: positiveOrNull(toNumber(details?.num_reviews)),
    photoUrl: resolvePhotoUrl(details),
    ratingImageUrl: details?.rating_image_url || null,
    tripadvisorUrl: details?.web_url || null,
    category: resolveCategoryLabel(details),
    isBookable: false,
  };
}

/**
 * 1 appel Search (≤10 résultats) puis DÉTAILS uniquement pour les `limit`
 * premiers — jamais pour tout le jeu de résultats. Coût : 1 + limit appels.
 */
export async function legacySearchByCategory(
  params: DiscoverySearchParams
): Promise<DiscoveryItem[]> {
  const searchResults = await taSearchLocations({
    searchQuery: params.searchQuery,
    category: params.category,
    signal: params.signal,
  });

  const selected = searchResults.slice(0, params.limit);
  const details = await Promise.allSettled(
    selected.map((item) => taLocationDetails(String(item.location_id), { signal: params.signal }))
  );

  return selected.map((searchItem, index) => {
    const outcome = details[index];
    return normalizeLocation({
      countryCode: params.countryCode,
      category: params.category,
      searchItem,
      details: outcome?.status === 'fulfilled' ? outcome.value : null,
    });
  });
}
