export interface DatabaseGroupe {
  id: string;
  carnet_id: string | null;
  created_by: string | null;
  nom: string;
  sous_titre: string | null;
  destination: string | null;
  massif: string | null;
  description: string | null;
  date_debut: string | null;
  date_fin: string | null;
  lieu_rdv: string | null;
  statut: 'preparation' | 'en_cours' | 'termine';
  etape_courante: 'idee' | 'dates' | 'itineraire' | 'equipement' | 'reservations' | 'pret';
  progression_pct: number;
  difficulte: string;
  budget_prevu_cents: number;
  confidentialite: 'prive' | 'public';
  distance_km: number;
  denivele_m: number;
  nb_nuits: number;
  places_max: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseGroupeMembre {
  id: string;
  groupe_id: string;
  user_id: string | null;
  invited_email: string | null;
  nom_affichage: string;
  role: 'admin' | 'guide' | 'photographe' | 'membre';
  role_note: string | null;
  statut_preparation: 'pret' | 'en_cours' | 'hors_ligne';
  pourcentage_pret: number;
  note_statut: string | null;
  confirme: boolean;
  created_at?: string;
}

export interface DatabaseGroupeEtape {
  id: string;
  groupe_id: string;
  ordre: number;
  lieu_depart: string | null;
  lieu_arrivee: string | null;
  distance_km: number;
  denivele_m: number;
  duree_texte: string | null;
  meteo: string | null;
  temperature_c: number | null;
  jour_numero: number;
  date_etape: string | null;
  recit: string | null;
  gpx_url: string | null;
  difficulte: string | null;
  points_geojson: any;
}

export interface DatabaseGroupeHebergement {
  id: string;
  groupe_id: string;
  apres_jour_numero: number;
  nom: string;
  altitude_m: number | null;
  type_hebergement: string | null;
  hote: string | null;
  prix_cents: number | null;
  prix_note: string | null;
  note: string | null;
}

export interface DatabaseGroupeTache {
  id: string;
  groupe_id: string;
  titre: string;
  categorie: 'refuge' | 'materiel' | 'repas' | 'general';
  assigne_a: string | null;
  statut: 'a_faire' | 'fait';
  echeance: string | null;
  note: string | null;
  completed_at: string | null;
  created_at?: string;
}

export interface DatabaseGroupeEquipement {
  id: string;
  groupe_id: string;
  nom: string;
  categorie: string | null;
  apporte_par: string | null;
  poids_g: number;
  statut: 'confirme' | 'a_verifier' | 'a_affecter';
  note: string | null;
}

export interface DatabaseGroupeDepense {
  id: string;
  groupe_id: string;
  titre: string;
  montant_cents: number;
  payeur_id: string | null;
  statut: 'verse' | 'a_venir';
  date_depense: string | null;
  nb_parts: number;
  note: string | null;
  created_at?: string;
}

export interface DatabaseGroupeDepensePart {
  id: string;
  depense_id: string;
  membre_id: string;
  montant_cents: number;
  regle: boolean;
}

export interface DatabaseGroupeVote {
  id: string;
  groupe_id: string;
  question: string;
  contexte: string | null;
  lance_par: string | null;
  statut: 'actif' | 'cloture';
  date_cloture: string | null;
  created_at?: string;
}

export interface DatabaseGroupeVoteOption {
  id: string;
  vote_id: string;
  libelle: string;
  detail: string | null;
  ordre: number;
}

export interface DatabaseGroupeVoteChoix {
  id: string;
  vote_id: string;
  option_id: string;
  membre_id: string;
  created_at?: string;
}

export interface DatabaseGroupeMessage {
  id: string;
  groupe_id: string;
  auteur_id: string | null;
  contenu: string;
  lieu_nom: string | null;
  gpx_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

export interface DatabaseGroupeActivite {
  id: string;
  groupe_id: string;
  membre_id: string | null;
  type: string | null;
  description: string;
  created_at: string;
}

export interface DatabaseCarnet {
  id: string;
  groupe_id: string | null;
  author_id: string | null;
  title: string;
  destination: string | null;
  description: string | null;
  cover_image: string | null;
  cover_image_alt: string | null;
  start_date: string | null;
  end_date: string | null;
  weather: string | null;
  route_rating: number;
  visibility: 'public' | 'private' | 'friends';
  tags: string[];
  map_points: any;
  is_collaborative: boolean;
  likes_count: number;
  comments_count: number;
  favorites_count: number;
  views_count: number;
  distance_km: number;
  denivele_m: number;
  nb_nuits: number;
  nb_voyageurs: number;
  lieu_depart: string | null;
  lieu_arrivee: string | null;
  created_at?: string;
}

export interface DatabaseCarnetMoment {
  id: string;
  carnet_id: string;
  jour_numero: number;
  heure: string | null;
  citation: string;
  auteur_nom: string | null;
  auteur_id: string | null;
  lieu: string | null;
  image_url: string | null;
  created_at?: string;
}

export interface DatabaseCarnetKitItem {
  id: string;
  carnet_id: string;
  nom: string;
  detail: string | null;
  poids_g: number;
  couleur_tag: string | null;
  sort_order: number;
}
