/**
 * LKDV — Types canoniques de l'entité Trip et de ses tables filles
 * Chantier 1 : Fondations du Module Voyage
 */

export type TripStatus = 'draft' | 'planned' | 'active' | 'completed' | 'cancelled';
export type TripVisibility = 'private' | 'unlisted' | 'public';
export type TripCollaboratorRole = 'owner' | 'editor' | 'viewer';
export type TripActivityType =
  | 'hiking'
  | 'trekking'
  | 'bivouac'
  | 'roadtrip'
  | 'cultural'
  | 'bushcraft'
  | 'mixed';
export type TripDifficulty = 'easy' | 'moderate' | 'hard' | 'expert';
export type TripItemStatus = 'packed' | 'needed' | 'optional' | 'missing';
export type TripBudgetCurrency = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'CAD' | 'JPY';
export type TripDocumentCategory =
  | 'passport'
  | 'insurance'
  | 'booking'
  | 'ticket'
  | 'medical'
  | 'other';
export type TripStepTransport =
  | 'foot'
  | 'car'
  | 'bus'
  | 'train'
  | 'plane'
  | 'boat'
  | 'bike'
  | 'other';

export type TripRole = TripCollaboratorRole;

export interface TripPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canInvite: boolean;
  canManageBudget: boolean;
  canViewDocuments: boolean;
}

export interface Trip {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  destination_country_code: string | null;
  destination_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: TripStatus;
  visibility: TripVisibility;
  difficulty: TripDifficulty;
  primary_activity: TripActivityType;
  estimated_budget: number | null;
  budget_currency: TripBudgetCurrency;
  cover_image_url: string | null;
  user_id: string;
  group_id: string | null;
  share_token: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface TripCollaborator {
  id: string;
  trip_id: string;
  user_id: string;
  role: TripCollaboratorRole;
  joined_at: string;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  // Données de profil enrichies
  profile?: {
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  };
}

export interface TripStep {
  id: string;
  trip_id: string;
  day_number: number;
  order_index: number;
  title: string;
  description: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  accommodation_name: string | null;
  transport_mode: TripStepTransport | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  created_at: string;
  updated_at: string;
}

export interface TripItem {
  id: string;
  trip_id: string;
  item_name: string;
  category: string | null;
  quantity: number;
  weight_grams: number | null;
  is_packed: boolean;
  status: TripItemStatus;
  packed_by: string | null;
  inventory_item_id: string | null;
  affiliate_link_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripExpense {
  id: string;
  trip_id: string;
  payer_id: string;
  title: string;
  amount: number;
  currency: TripBudgetCurrency;
  category: string | null;
  expense_date: string;
  split_type: 'equal' | 'custom' | 'individual';
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  payer?: {
    full_name?: string | null;
    avatar_url?: string | null;
  };
}

export interface TripDocument {
  id: string;
  trip_id: string;
  user_id: string;
  title: string;
  category: TripDocumentCategory;
  file_url: string;
  file_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripPoi {
  id: string;
  trip_id: string;
  step_id: string | null;
  name: string;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  visited: boolean;
  osm_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripSafetyCheckpoint {
  id: string;
  trip_id: string;
  label: string;
  scheduled_at: string;
  checked_at: string | null;
  contact_phone: string | null;
  contact_name: string | null;
  status: 'pending' | 'checked' | 'missed' | 'alert_sent';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripNote {
  id: string;
  trip_id: string;
  author_id: string;
  title: string | null;
  content: string;
  day_number: number | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    full_name?: string | null;
    avatar_url?: string | null;
  };
}

export interface TripSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  destination_country_code: string | null;
  destination_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: TripStatus;
  visibility: TripVisibility;
  difficulty: TripDifficulty;
  primary_activity: TripActivityType;
  cover_image_url: string | null;
  collaborators_count?: number;
  steps_count?: number;
  total_spent?: number;
  user_role?: TripRole | null;
}

export interface TripWithDetails extends Trip {
  collaborators_count?: number;
  steps_count?: number;
  items_count?: number;
  total_spent?: number;
  user_role?: TripRole | null;
  owner_name?: string | null;
  owner_avatar?: string | null;
}

export interface TripFull extends Trip {
  collaborators: TripCollaborator[];
  steps: TripStep[];
  items: TripItem[];
  expenses: TripExpense[];
  documents: TripDocument[];
  pois: TripPoi[];
  safety_checkpoints: TripSafetyCheckpoint[];
  notes: TripNote[];
  user_role?: TripRole | null;
  permissions: TripPermissions;
}

export interface TripStats {
  trip_id: string;
  total_days: number;
  total_distance_km: number;
  total_elevation_gain_m: number;
  total_elevation_loss_m: number;
  items_packed: number;
  items_total: number;
  estimated_budget: number;
  total_spent: number;
  participants_count: number;
}

export interface TripFilters {
  search?: string;
  status?: TripStatus | 'all';
  difficulty?: TripDifficulty | 'all';
  activity?: TripActivityType | 'all';
  destination?: string;
  page?: number;
  limit?: number;
  sort_by?: 'start_date' | 'created_at' | 'title';
  sort_order?: 'asc' | 'desc';
}
