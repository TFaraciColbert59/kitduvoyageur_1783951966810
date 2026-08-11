// src/lib/mock/mon-materiel-marceline.ts
export interface GearItemData {
  id: string;
  name: string;
  category: string;
  weight: number;
  weight_g?: number;
  count: number;
  quantity?: number;
  is_rented: boolean;
  condition?: 'excellent' | 'bon' | 'moyen' | 'à réparer' | 'neuf' | 'usé' | 'à_réparer' | 'à_remplacer';
  model?: string;
  brand?: string;
  purchase_date?: string;
  purchase_price?: number;
  image?: string;
  alt?: string;
  notes?: string;
  is_favorite?: boolean;
  loan_status?: 'prêté' | 'disponible';
  loan_to_name?: string;
  is_listed_for_sale?: boolean;
  wear_percentage?: number;
  size_label?: string;
  materials?: string;
  sole_type?: string;
  waterproof_rating?: string;
  ref_code?: string;
  purchase_vendor?: string;
  purchase_invoice_no?: string;
  warranty_info?: string;
  description?: string;
  rating?: number;
  km_parcourus?: number;
  sorties_count?: number;
  reste_km?: number;
  wear_part_name?: string;
  wear_notes?: string;
}

export interface UserKitData {
  id: string;
  code: string;
  name: string;
  description?: string;
  gear_ids: string[];
  articles_count?: number;
  weight_kg?: number;
  status?: 'draft' | 'validated' | 'archived';
  is_default?: boolean;
  created_at?: string;
  image?: string;
}

export interface LoanItemData {
  id: string;
  item_id: string;
  item_name: string;
  lender_id: string;
  borrower_id: string;
  borrower_name: string;
  loan_date: string;
  expected_return_date?: string;
  return_date?: string;
  status: 'en cours' | 'retourné' | 'égaré';
  notes?: string;
}

export interface RepairItemData {
  id: string;
  item_id: string;
  item_name: string;
  issue: string;
  repair_date: string;
  repair_type: 'réparation' | 'remplacement' | 'entretien';
  repair_description: string;
  cost?: number;
  repairer?: string;
  parts_replaced?: string[];
  status?: 'à faire' | 'en cours' | 'terminé';
  notes?: string;
}

export const INITIAL_GEAR_DATA: GearItemData[] = [
  { id: '1', name: 'Sac de couchage', category: 'Hébergement', weight: 1.2, count: 1, is_rented: false, condition: 'excellent', weight_g: 1200 },
  { id: '2', name: 'Tente 2 personnes', category: 'Hébergement', weight: 2.5, count: 1, is_rented: false, condition: 'bon', weight_g: 2500 },
  { id: '3', name: 'Réchaud', category: 'Cuisine', weight: 0.3, count: 1, is_rented: false, condition: 'excellent', weight_g: 300 },
];

export const INITIAL_KITS: UserKitData[] = [];
export const INITIAL_LOANS: LoanItemData[] = [];
export const INITIAL_REPAIRS: RepairItemData[] = [];
