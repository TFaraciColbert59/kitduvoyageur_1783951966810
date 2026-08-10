// src/lib/mock/inventaire-marceline.ts
// NOTE: Ce fichier ne contient PLUS aucune donnée de démonstration.
// Il ne conserve que les types partagés du module inventaire (source de vérité : Supabase).

export interface GearItemData {
  id: string;
  user_id?: string;
  name: string;
  brand: string;
  model: string;
  category: 'couchage' | 'portage' | 'cuisine' | 'vêtement' | 'navigation' | 'sécurité' | 'autre';
  condition: 'neuf' | 'excellent' | 'bon' | 'usé' | 'à_remplacer' | 'à_réparer';
  weight_g: number;
  purchase_price: number;
  purchase_date?: string;
  image: string;
  alt: string;
  quantity: number;
  is_favorite: boolean;
  notes?: string;
  loan_status?: string | null;
  loan_to_name?: string | null;
  is_listed_for_sale?: boolean;

  // Premium detail page fields
  rating?: number;
  ref_code?: string;
  description?: string;
  km_parcourus?: number;
  sorties_count?: number;
  reste_km?: number;
  wear_percentage?: number;
  wear_part_name?: string;
  wear_notes?: string;
  size_label?: string;
  materials?: string;
  sole_type?: string;
  waterproof_rating?: string;
  warranty_info?: string;
  purchase_vendor?: string;
  purchase_invoice_no?: string;
  location_city?: string;
  attached_backpack?: string;
  images?: string[];
  history_events?: Array<{
    id: string;
    date: string;
    title: string;
    type: 'Contrôle' | 'Sortie' | 'Entretien' | 'Achat' | 'Prêt' | 'Réparation';
    details: string;
    mileage_added?: string;
    total_mileage?: string;
    cost?: string;
  }>;
}

export interface UserKitData {
  id: string;
  code: string;
  name: string;
  articles_count: number;
  weight_kg: number;
  status?: string;
}

export interface LoanItemData {
  id: string;
  item_name: string;
  borrower_name: string;
  category: string;
  date_lent: string;
}

export interface RepairItemData {
  id: string;
  item_name: string;
  brand: string;
  issue: string;
  status: 'à_réparer' | 'à_remplacer';
  urgency: 'high' | 'medium';
}