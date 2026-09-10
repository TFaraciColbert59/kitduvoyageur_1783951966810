// src/features/discovery/providers/tripadvisor-terra/terraAdapter.ts
import type { DiscoveryItem, DiscoverySearchParams } from '../../types/discovery.types';
import { terraSearchLocations } from './terraClient';
import type { TerraLocation } from './terraSchemas';

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveOrNull(value: number | null): number | null {
  return value != null && value > 0 ? value : null;
}

function pickName(names: TerraLocation['names']): string | null {
  if (!names || names.length === 0) return null;
  const localized = names.find((n) => n.language?.toLowerCase().startsWith('fr'));
  const primary = names.find((n) => n.primary === true);
  return (localized ?? primary ?? names[0])?.value ?? null;
}

function pickDescription(descriptions: TerraLocation['descriptions']): string | null {
  if (!descriptions || descriptions.length === 0) return null;
  const localized = descriptions.find((d) => d.language?.toLowerCase().startsWith('fr'));
  return (localized ?? descriptions[0])?.value ?? null;
}

/**
 * Normalise une Location Terra vers le modèle interne. Retourne `null` si le
 * nom est introuvable (jamais de nom inventé).
 */
export function normalizeTerraLocation(params: {
  countryCode: string;
  category: DiscoveryItem['type'];
  location: TerraLocation;
}): DiscoveryItem | null {
  const { countryCode, category, location } = params;
  const name = pickName(location.names);
  if (!name) return null;

  const address = location.addresses?.[0] ?? null;
  const overall = location.traveler_ratings?.overall ?? null;
  const categoryLabel =
    location.categories?.[0]?.display_name ?? location.categories?.[0]?.hierarchy ?? null;

  return {
    id: String(location.id),
    provider: 'tripadvisor',
    type: category,
    name,
    description: pickDescription(location.descriptions),
    countryCode: countryCode.toUpperCase(),
    city: address?.city ?? null,
    address: address?.formatted ?? null,
    latitude: location.coordinates?.latitude ?? null,
    longitude: location.coordinates?.longitude ?? null,
    rating: positiveOrNull(toNumber(overall?.rating)),
    reviewCount: positiveOrNull(toNumber(overall?.count)),
    // La recherche Terra ne fournit pas d'URL photo (photos.total_count seulement).
    photoUrl: null,
    ratingImageUrl: overall?.icon_url ?? null,
    tripadvisorUrl: location.urls?.tripadvisor?.main ?? null,
    category: categoryLabel,
    isBookable: false,
  };
}

/**
 * Catégories Terra de premier niveau acceptées par catégorie normalisée.
 * Enum OpenAPI : Accommodation | Experience | Attraction | Eat & Drink.
 * Les « Experiences » (activités) sont acceptées pour les attractions.
 */
const TOP_LEVEL_CATEGORIES: Record<DiscoveryItem['type'], string[]> = {
  attractions: ['Attraction', 'Experience'],
  restaurants: ['Eat & Drink'],
  hotels: ['Accommodation'],
};

/**
 * Filtrage défensif pays : n'écarte que si la réponse contient AU MOINS un
 * `addresses[].country_code` (champ OpenAPI) et qu'aucun ne correspond au pays
 * demandé. Donnée pays absente → conservé (impossible de valider).
 */
export function isCountryMatch(location: TerraLocation, countryCode: string): boolean {
  const addresses = location.addresses;
  if (!addresses || addresses.length === 0) return true;
  const codes = addresses
    .map((address) => address.country_code?.toUpperCase())
    .filter((code): code is string => Boolean(code));
  if (codes.length === 0) return true;
  return codes.includes(countryCode.toUpperCase());
}

/**
 * Filtrage défensif catégorie : n'écarte que si `categories[].top_level_category`
 * (champ OpenAPI) est présent et qu'aucune valeur n'est compatible. Absent → conservé.
 */
export function isCategoryMatch(location: TerraLocation, category: DiscoveryItem['type']): boolean {
  const categories = location.categories;
  if (!categories || categories.length === 0) return true;
  const values = categories
    .map((entry) => entry.top_level_category)
    .filter((value): value is string => Boolean(value));
  if (values.length === 0) return true;
  const allowed = TOP_LEVEL_CATEGORIES[category];
  return values.some((value) => allowed.includes(value));
}

/**
 * Stratégie A : `GET /locations/search` retourne déjà la Location complète.
 * Un seul appel par catégorie, aucun N+1, aucun appel Details.
 * Filtrage défensif pays/catégorie lorsque la donnée est disponible.
 */
export async function terraSearchByCategory(
  params: DiscoverySearchParams
): Promise<DiscoveryItem[]> {
  const results = await terraSearchLocations({
    searchQuery: params.searchQuery,
    countryCode: params.countryCode,
    category: params.category,
    limit: params.limit,
    signal: params.signal,
  });

  return results
    .filter(
      (item) =>
        isCountryMatch(item.location, params.countryCode) &&
        isCategoryMatch(item.location, params.category)
    )
    .slice(0, params.limit)
    .map((item) =>
      normalizeTerraLocation({
        countryCode: params.countryCode,
        category: params.category,
        location: item.location,
      })
    )
    .filter((item): item is DiscoveryItem => item !== null);
}
