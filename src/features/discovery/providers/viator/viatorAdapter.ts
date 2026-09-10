// src/features/discovery/providers/viator/viatorAdapter.ts
import type { DiscoveryItem } from '../../types/discovery.types';
import { viatorSearchProducts } from './viatorClient';
import type { ViatorProductRaw } from './viatorSchemas';
import type { ViatorSearchParams } from './viatorTypes';

/** Domaines autorisés pour les liens Viator. */
export const VIATOR_ALLOWED_HOSTS = ['viator.com'] as const;

/** CDN autorisés pour les images produits (fournies par Viator/Tripadvisor). */
export const VIATOR_ALLOWED_IMAGE_HOSTS = ['tripadvisor.com', 'viator.com', 'vtrcdn.com'] as const;

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isAllowedImageHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return VIATOR_ALLOWED_IMAGE_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/**
 * Validation stricte d'une URL Viator. L'URL `productUrl` fournie par l'API
 * est utilisée **telle quelle** (les paramètres d'affiliation ne sont JAMAIS
 * reconstruits, sinon l'attribution échoue). On se contente de vérifier
 * https + domaine autorisé (+ absence d'identifiants embarqués).
 */
export function validateViatorUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript|file|blob):/i.test(trimmed)) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;

  const host = parsed.hostname.toLowerCase();
  const allowed = VIATOR_ALLOWED_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (!allowed) return null;

  return parsed.toString();
}

/**
 * Image de couverture : Viator renvoie souvent `imageSource = "SUPPLIER_PROVIDED"`
 * (un libellé, PAS une URL). Les vraies images sont dans `variants[]`. On prend
 * l'URL https valide sur un CDN autorisé : le plus petit variant ≥ 400px, sinon
 * le plus grand ; `imageSource` n'est utilisé que s'il s'agit d'une vraie URL.
 */
function pickCoverImage(product: ViatorProductRaw): string | null {
  const images = product.images ?? [];
  const cover = images.find((image) => image.isCover === true) ?? images[0];
  if (!cover) return null;

  const variants = (cover.variants ?? [])
    .filter((variant) => isHttpsUrl(variant.url))
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const preferredVariant = variants.find((variant) => (variant.width ?? 0) >= 400) ?? variants[variants.length - 1];

  const candidates = [cover.imageSource, preferredVariant?.url].filter(
    (value): value is string => isHttpsUrl(value)
  );
  return candidates.find(isAllowedImageHost) ?? null;
}

/** Normalise un produit Viator vers le modèle interne. `null` si non exploitable. */
export function normalizeViatorProduct(params: {
  countryCode: string;
  category: DiscoveryItem['type'];
  product: ViatorProductRaw;
}): DiscoveryItem | null {
  const { product } = params;
  const name = product.title?.trim();
  if (!name) return null; // jamais de nom inventé

  const rating = product.reviews?.combinedAverageRating;
  const reviewCount = product.reviews?.totalReviews;
  const price = product.pricing?.summary?.fromPrice;
  const currency = product.pricing?.currency;
  const flags = product.flags ?? [];
  const durationMinutes =
    product.duration?.fixedDurationInMinutes ?? product.duration?.variableDurationFromMinutes ?? null;

  return {
    id: product.productCode,
    provider: 'viator',
    type: params.category,
    name,
    description: product.description?.trim() || null,
    countryCode: params.countryCode.toUpperCase(),
    city: null,
    address: null,
    latitude: null,
    longitude: null,
    rating: rating != null && rating > 0 ? rating : null,
    reviewCount: reviewCount != null && reviewCount > 0 ? reviewCount : null,
    photoUrl: pickCoverImage(product),
    ratingImageUrl: null,
    tripadvisorUrl: null,
    affiliateUrl: validateViatorUrl(product.productUrl),
    category: null,
    isBookable: false,
    bookingMode: 'external',
    bookingProvider: 'viator',
    priceFrom: price != null && price >= 0 ? price : null,
    currency: currency || null,
    freeCancellation: flags.includes('FREE_CANCELLATION') ? true : null,
    productCode: product.productCode,
    durationMinutes: durationMinutes != null && durationMinutes > 0 ? durationMinutes : null,
  };
}

/**
 * Un seul appel `POST /products/search`, puis normalisation. Pas d'appel
 * Details, pas de pagination, plafond `limit` (≤ 6 v1).
 */
export async function viatorSearchByCategory(params: ViatorSearchParams): Promise<DiscoveryItem[]> {
  const products = await viatorSearchProducts(params);
  return products
    .map((product) =>
      normalizeViatorProduct({
        countryCode: params.countryCode,
        category: params.category,
        product,
      })
    )
    .filter((item): item is DiscoveryItem => item !== null)
    .slice(0, params.limit);
}
