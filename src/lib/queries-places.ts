import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  Place,
  PlaceWithDistance,
  PlaceReview,
  PlacePhoto,
} from '@/features/places/types/place.types';
import {
  createPlaceSchema,
  placeFilterSchema,
  type CreatePlaceInput,
  type PlaceFilterInput,
} from '@/features/places/schemas/place.schema';
import { blurCoordinatesForSensitivity } from '@/features/places/engine/placeScoring';

export interface GetPlacesResult {
  places: PlaceWithDistance[];
  total: number;
}

/**
 * Récupère les lieux communautaires avec filtres, recherche et floutage éthique serveur
 */
export async function getPlaces(
  filters?: PlaceFilterInput,
  options?: { isAdmin?: boolean }
): Promise<GetPlacesResult> {
  const supabase = await createClient();
  const parsedFilters = placeFilterSchema.parse(filters || {});

  let query = supabase
    .from('places')
    .select('*', { count: 'exact' });

  if (parsedFilters.country) {
    query = query.eq('country_code', parsedFilters.country.toUpperCase());
  }

  if (parsedFilters.category) {
    query = query.eq('category', parsedFilters.category);
  }

  if (parsedFilters.sensitivity) {
    query = query.eq('sensitivity', parsedFilters.sensitivity);
  }

  if (parsedFilters.query && parsedFilters.query.trim() !== '') {
    const term = parsedFilters.query.trim();
    query = query.or(
      `name.ilike.%${term}%,region.ilike.%${term}%,city.ilike.%${term}%,description.ilike.%${term}%`
    );
  }

  query = query
    .order('bayesian_rating', { ascending: false })
    .order('reviews_count', { ascending: false })
    .order('name', { ascending: true })
    .range(parsedFilters.offset, parsedFilters.offset + parsedFilters.limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('[getPlaces] Erreur Supabase :', error);
    return { places: [], total: 0 };
  }

  const places: PlaceWithDistance[] = (data || []).map((row) => {
    const blurring = blurCoordinatesForSensitivity(
      Number(row.latitude),
      Number(row.longitude),
      row.sensitivity,
      options?.isAdmin
    );

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      category: row.category,
      country_code: row.country_code,
      region: row.region,
      city: row.city,
      latitude: blurring.latitude,
      longitude: blurring.longitude,
      altitude_m: row.altitude_m,
      description: row.description,
      sensitivity: row.sensitivity,
      source: row.source,
      osm_id: row.osm_id,
      author_id: row.author_id,
      is_verified: row.is_verified,
      practical_info: row.practical_info || {},
      bayesian_rating: Number(row.bayesian_rating || 0),
      reviews_count: Number(row.reviews_count || 0),
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_blurred: blurring.isBlurred,
      blur_radius_m: blurring.blurRadiusMeters,
    };
  });

  return {
    places,
    total: count || 0,
  };
}

/**
 * Récupère un lieu complet par son slug avec avis et photos
 */
export async function getPlaceBySlug(
  slug: string,
  options?: { isAdmin?: boolean }
): Promise<{
  place: PlaceWithDistance | null;
  reviews: PlaceReview[];
  photos: PlacePhoto[];
}> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from('places')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !row) {
    return { place: null, reviews: [], photos: [] };
  }

  const blurring = blurCoordinatesForSensitivity(
    Number(row.latitude),
    Number(row.longitude),
    row.sensitivity,
    options?.isAdmin
  );

  const place: PlaceWithDistance = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    country_code: row.country_code,
    region: row.region,
    city: row.city,
    latitude: blurring.latitude,
    longitude: blurring.longitude,
    altitude_m: row.altitude_m,
    description: row.description,
    sensitivity: row.sensitivity,
    source: row.source,
    osm_id: row.osm_id,
    author_id: row.author_id,
    is_verified: row.is_verified,
    practical_info: row.practical_info || {},
    bayesian_rating: Number(row.bayesian_rating || 0),
    reviews_count: Number(row.reviews_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_blurred: blurring.isBlurred,
    blur_radius_m: blurring.blurRadiusMeters,
  };

  // Récupérer avis et photos en parallèle
  const [reviewsRes, photosRes] = await Promise.all([
    supabase
      .from('place_reviews')
      .select('*')
      .eq('place_id', row.id)
      .order('has_field_proof', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('place_photos')
      .select('*')
      .eq('place_id', row.id)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);

  const reviews: PlaceReview[] = (reviewsRes.data || []).map((rev) => ({
    id: rev.id,
    place_id: rev.place_id,
    author_id: rev.author_id,
    rating: rev.rating,
    comment: rev.comment,
    has_field_proof: rev.has_field_proof,
    visit_date: rev.visit_date,
    created_at: rev.created_at,
    updated_at: rev.updated_at,
  }));

  const photos: PlacePhoto[] = (photosRes.data || []).map((p) => ({
    id: p.id,
    place_id: p.place_id,
    author_id: p.author_id,
    url: p.url,
    caption: p.caption,
    has_exif_stripped: p.has_exif_stripped,
    is_featured: p.is_featured,
    created_at: p.created_at,
  }));

  return { place, reviews, photos };
}

/**
 * Récupère un lieu par son ID
 */
export async function getPlaceById(
  id: string,
  options?: { isAdmin?: boolean }
): Promise<PlaceWithDistance | null> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from('places')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !row) return null;

  const blurring = blurCoordinatesForSensitivity(
    Number(row.latitude),
    Number(row.longitude),
    row.sensitivity,
    options?.isAdmin
  );

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    country_code: row.country_code,
    region: row.region,
    city: row.city,
    latitude: blurring.latitude,
    longitude: blurring.longitude,
    altitude_m: row.altitude_m,
    description: row.description,
    sensitivity: row.sensitivity,
    source: row.source,
    osm_id: row.osm_id,
    author_id: row.author_id,
    is_verified: row.is_verified,
    practical_info: row.practical_info || {},
    bayesian_rating: Number(row.bayesian_rating || 0),
    reviews_count: Number(row.reviews_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_blurred: blurring.isBlurred,
    blur_radius_m: blurring.blurRadiusMeters,
  };
}

/**
 * Création d'un lieu par un utilisateur authentifié
 */
export async function createPlace(
  input: CreatePlaceInput,
  authorId: string
): Promise<Place> {
  const supabase = await createClient();
  const parsed = createPlaceSchema.parse(input);

  const { data, error } = await supabase
    .from('places')
    .insert({
      ...parsed,
      author_id: authorId,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Échec de création du lieu : ${error.message}`);
  }

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    category: data.category,
    country_code: data.country_code,
    region: data.region,
    city: data.city,
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    altitude_m: data.altitude_m,
    description: data.description,
    sensitivity: data.sensitivity,
    source: data.source,
    osm_id: data.osm_id,
    author_id: data.author_id,
    is_verified: data.is_verified,
    practical_info: data.practical_info || {},
    bayesian_rating: Number(data.bayesian_rating || 0),
    reviews_count: Number(data.reviews_count || 0),
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Récupère les voyages de l'utilisateur pour le sélecteur d'ajout rapide au voyage
 */
export async function getUserTripsForPicker(userId: string): Promise<Array<{ id: string; title: string; slug: string; duration_days: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('trips')
    .select('id, title, slug, duration_days')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[getUserTripsForPicker] Erreur :', error);
    return [];
  }

  return data || [];
}
