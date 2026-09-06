/**
 * LKDV — Moteur de Répartition & Planificateur de Voyage (Trip Engine)
 * Types déterministes purs
 */

export type PlannerPace = 'chill' | 'standard' | 'intense';

export interface CountryInput {
  country_code: string;
  country_name?: string;
  weight?: number;
}

export interface CandidateStep {
  id: string;
  country_code: string;
  title: string;
  location_name: string;
  latitude: number;
  longitude: number;
  description?: string;
  distance_km?: number;
  elevation_gain_m?: number;
  elevation_loss_m?: number;
  difficulty?: string;
  activity_type?: string;
  order_hint?: number;
  is_demanding?: boolean;
}

export interface CandidateItem {
  id: string;
  name: string;
  category?: string;
  weight_grams?: number;
  ref_type: 'custom' | 'kit_item' | 'gear';
  ref_id?: string;
  is_essential?: boolean;
}

export interface PlannerInput {
  countries: CountryInput[];
  duration_days: number;
  start_date?: string | null;
  end_date?: string | null;
  styles: string[];
  pace: PlannerPace;
  travelers_count: number;
  reference_date?: string;
}

export interface CountryAllocation {
  country_code: string;
  country_name?: string;
  allocated_days: number;
  start_day: number;
  end_day: number;
}

export interface PlannerWarning {
  code: string;
  severity: 'info' | 'warning' | 'alert';
  country_code?: string;
  message: string;
}

export interface GeneratedStep {
  day_number: number;
  order_index: number;
  country_code: string;
  title: string;
  description: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  transport_mode: string | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  accommodation_name: string | null;
  source: 'import' | 'ai' | 'user';
}

export interface GeneratedItem {
  item_name: string;
  category: string | null;
  quantity: number;
  weight_grams: number | null;
  status: 'needed' | 'packed' | 'optional' | 'missing';
  ref_type?: string;
  ref_id?: string;
  source: 'import' | 'ai' | 'user';
  day_number?: number;
}

export interface PlannerOutput {
  allocations: CountryAllocation[];
  steps: GeneratedStep[];
  items: GeneratedItem[];
  warnings: PlannerWarning[];
  total_days: number;
  total_distance_km: number;
  total_elevation_gain_m: number;
}

export interface EngineCandidateData {
  candidateSteps: CandidateStep[];
  candidateItems: CandidateItem[];
}
