import { UserProfile } from '@/lib/types/profile';
export type { UserProfile };

export interface ProchainVoyage {
  id: string;
  title: string;
  title_highlight: string;
  days_left: number;
  date_range: string;
  companions: string;
  refuges_count: number;
  preparation_percentage: number;
  preparation_detail: string;
  tasks_left: number;
  group_id: string;
}

export interface Aventure {
  id: string;
  title: string;
  date_detail: string;
  duration: string;
  companions: string[];
  distance: string;
  elevation: string;
  status: 'En cours' | 'Terminée' | 'Brouillon' | 'Planifiée';
  image_url: string;
}

export interface Carnet {
  id: string;
  title: string;
  status: 'Publié' | 'Brouillon';
  image_url: string;
  likes?: number;
  views?: number;
  comments?: number;
  draft_detail?: string;
  edit_status?: string;
}

export interface ClubItem {
  id: string;
  name: string;
  role: 'Admin' | 'Membre';
  members_count: number;
  detail: string;
  badge?: string;
  logo_url: string;
  slug: string;
}

export interface Commande {
  id: string;
  product_name: string;
  order_number: string;
  price: string;
  status: 'Expédiée' | 'Préparation' | 'Livrée';
  image_url: string;
}

export interface BadgeItem {
  id: string;
  title: string;
  icon_name: string;
  earned: boolean;
}

export interface ActiviteItem {
  id: string;
  text: string;
  highlight: string;
  time: string;
  icon_type: 'like' | 'badge' | 'order' | 'comment' | 'follow';
}
