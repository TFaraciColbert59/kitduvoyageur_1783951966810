export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  role_badge: string;
  member_since: string;
  bio: string;
  location: string;
  tenure: string;
  sorties_count: number;
  last_active: string;
  avatar_url: string;
  hero_image_url: string;
  trust_score?: number;
  level: {
    number: string;
    title: string;
    current_pts: number;
    max_pts: number;
    next_level_pts: number;
    next_level_title: string;
  };
  stats: {
    sorties: number;
    carnets: number;
    clubs: number;
    km_this_year: number;
    distance_2026: { value: string; diff: string };
    elevation_gain: { value: string; detail: string };
    refuge_nights: { value: string; detail: string };
    co2_saved: { value: string; detail: string };
  };
}
