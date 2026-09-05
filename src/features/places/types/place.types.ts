export type PlaceCategory =
  | 'refuge'
  | 'bivouac'
  | 'water_source'
  | 'viewpoint'
  | 'pass'
  | 'campground'
  | 'poi'
  | 'summit'
  | 'lake'
  | 'cave'
  | 'historical';

export type PlaceSensitivity = 'standard' | 'sensitive' | 'protected';

export type PlaceSource = 'curated' | 'community' | 'osm';

export interface PlacePracticalInfo {
  waterAvailable?: boolean;
  feesRequired?: boolean;
  bookingRequired?: boolean;
  openingSeason?: string;
  phone?: string;
  website?: string;
  capacity?: number;
  fireAllowed?: boolean;
  electricity?: boolean;
  wasteManagement?: boolean;
}

export interface Place {
  id: string;
  slug: string;
  name: string;
  category: PlaceCategory;
  country_code: string;
  region: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  altitude_m: number | null;
  description: string | null;
  sensitivity: PlaceSensitivity;
  source: PlaceSource;
  osm_id: string | null;
  author_id: string | null;
  is_verified: boolean;
  practical_info: PlacePracticalInfo;
  bayesian_rating: number;
  reviews_count: number;
  created_at: string;
  updated_at: string;
}

export interface PlaceWithDistance extends Place {
  distance_km?: number;
  is_blurred?: boolean;
  blur_radius_m?: number;
}

export interface PlaceReview {
  id: string;
  place_id: string;
  author_id: string;
  rating: number; // 1 to 5
  comment: string;
  has_field_proof: boolean;
  visit_date: string | null;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_avatar?: string;
}

export interface PlacePhoto {
  id: string;
  place_id: string;
  author_id: string;
  url: string;
  caption: string | null;
  has_exif_stripped: boolean;
  is_featured: boolean;
  created_at: string;
}

export type PlaceReportReason =
  | 'overcrowding'
  | 'environmental_damage'
  | 'safety_hazard'
  | 'inaccurate_info'
  | 'private_property'
  | 'other';

export interface PlaceReport {
  id: string;
  place_id: string;
  reporter_id: string | null;
  reason: PlaceReportReason;
  details: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: string;
}
