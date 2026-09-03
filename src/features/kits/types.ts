// Types partagés du KitSheet (Lot 5) — l'objet qui circule, aucune page.

export interface KitSheetKit {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  total_weight_g: number;
  is_public: boolean;
  is_souche: boolean;
  origin: string;
  generation: number;
  forked_from: string | null;
  parent_name?: string | null;
  field_proven_count: number;
  cover_image_url: string | null;
  tags: string[] | null;
  created_at: string;
}

export interface KitJournalField {
  session_count?: number;
  total_km?: number;
  total_elevation_gain_m?: number;
  seasons?: Record<string, number> | null;
  regions?: { region: string; sessions: number }[] | null;
}

export interface KitJournal {
  birth?: { origin: string; created_at: string; generation: number };
  lineage?: { fork_count: number; max_generation: number };
  field?: KitJournalField;
  ecosystem?: { public_carnet_count: number; public_carnet_moment_count: number };
}

export interface KitTrustRow {
  propagation_score: number;
  endurance_score: number;
  fork_users_unique: number;
  sessions_count: number;
  season_count: number;
  region_count: number;
  essential_count: number;
  never_used_count: number;
  has_min_sessions: boolean;
}

export interface KitSurvivalRow {
  kit_id: string;
  item_key: string;
  product_id: string | null;
  kept_count: number;
  dropped_count: number;
  total_pairs: number;
}

export interface KitSheetData {
  kit: KitSheetKit;
  journal: KitJournal | null;
  trust: KitTrustRow | null;
  survival: KitSurvivalRow[];
}