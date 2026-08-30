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

// ── Géographie (Phase 2 GEODATA) ─────────────────────────────
// Types alignés sur le schéma Phase 2 (migrations
// 20230801000200_create_geodata_tables.sql +
// 20260811000000_geodata_phase2_schema.sql).

export type GeoFeatureClass = 'A' | 'H' | 'L' | 'P' | 'R' | 'S' | 'T' | 'U' | 'V';

export type GeoFeatureCode =
  | 'PCLI' | 'PCL' | 'PCLD' | 'PCLF' | 'PCLIX' | 'PCLS' | 'TERR' | 'PCLX'
  | 'ADM1' | 'ADM2' | 'ADM3' | 'ADM4' | 'ADMD' | 'PRK' | 'H'
  | 'PPL' | 'PPLA' | 'PPLA2' | 'PPLA3' | 'PPLA4' | 'PPLC' | 'PPLCH' | 'PPLF'
  | 'PPLG' | 'PPLH' | 'PPLL' | 'PPLQ' | 'PPLR' | 'PPLS' | 'PPLW' | 'PPLX'
  | 'STLMT' | 'PSCL';

export type GeoCountryGeometrySource = 'natural_earth' | 'geonames' | 'osm' | 'manual';

export interface CountryGeo {
  id: string;
  iso_a2: string;
  name: string;
  continent: string | null;
  capital: string | null;
  currency: string | null;
  population: number | null;
  geometry: unknown;
  geoname_id: number | null;
  iso_a3: string | null;
  iso_numeric: string | null;
  fips_code: string | null;
  tld: string | null;
  phone_code: string | null;
  currency_code: string | null;
  currency_name: string | null;
  postal_code_format: string | null;
  postal_code_regex: string | null;
  languages: string[];
  neighbours: string[];
  area_km2: number | null;
  name_ascii: string | null;
  name_en: string | null;
  name_short: string | null;
  geometry_source: GeoCountryGeometrySource;
  is_sovereign: boolean;
  timezone: string | null;
  subregion: string | null;
  sources: string | null;
  created_at: string;
  updated_at: string;
}

export interface PratiqueVoyageContent {
  visa_requis_fr?: string | null;
  type_visa?: string | null;
  cout_visa?: string | null;
  assurance_recommandee?: string | null;
  permis_international_requis?: string | null;
  sources?: string | null;
}

export interface TransportContent {
  aeroport_principal?: string | null;
  code_iata?: string | null;
  compagnies_depuis_france?: string | null;
  transport_interieur?: string | null;
  location_vehicule_conditions?: string | null;
  sens_conduite?: string | null;
  sources?: string | null;
}

export interface ClimatContent {
  climat_general?: string | null;
  meilleure_periode_trek?: string | null;
  meilleure_periode_plage?: string | null;
  saison_pluies?: string | null;
  risques_meteo?: string | null;
  temp_moy_janv?: string | null;
  temp_moy_juil?: string | null;
  sources?: string | null;
}

export interface OutdoorContent {
  parcs_nationaux?: string | null;
  treks_phares?: string | null;
  activites_phares?: string | null;
  faune_flore_remarquable?: string | null;
  equipement_specifique_recommande?: string | null;
  sources?: string | null;
}

export interface ConnectiviteContent {
  type_prise_electrique?: string | null;
  voltage?: string | null;
  esim_disponible?: string | null;
  couverture_reseau?: string | null;
  sources?: string | null;
}

export interface CultureContent {
  coutumes_etiquette?: string | null;
  phrases_utiles?: string | null;
  dress_code?: string | null;
  religion_principale?: string | null;
  jours_feries_majeurs?: string | null;
  sources?: string | null;
}

export interface EditorialContent {
  plats_emblematiques?: string | null;
  sources?: string | null;
}

export interface BudgetContent {
  moyens_paiement?: string | null;
  budget_jour_petit?: string | null;
  budget_jour_moyen?: string | null;
  budget_jour_gros?: string | null;
  prix_repas_moyen?: string | null;
  prix_hebergement_moyen?: string | null;
  usage_pourboire?: string | null;
  marchandage_usage?: string | null;
  sources?: string | null;
}

export interface CountryContent {
  id?: string;
  country_iso_a2: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  pratique_voyage: PratiqueVoyageContent;
  climat: ClimatContent;
  budget: BudgetContent;
  sante_securite?: { assurance_recommandee?: string | null; risques_meteo?: string | null; sources?: string | null };
  transport: TransportContent;
  culture: CultureContent;
  outdoor: OutdoorContent;
  connectivite: ConnectiviteContent;
  editorial: EditorialContent;
  data_source: string;
  staleness_days?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AdminRegionGeo {
  id: string;
  country_id: string | null;
  country_iso_a2: string | null;
  admin_code: string | null;
  admin_code_full: string | null;
  name: string;
  level: number | null;
  name_ascii: string | null;
  name_en: string | null;
  admin_parent_id: string | null;
  geometry: unknown;
  population: number | null;
  geoname_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlaceGeo {
  id: string;
  admin_region_id: string | null;
  country_iso_a2: string | null;
  name: string;
  feature_class: GeoFeatureClass | null;
  feature_code: string | null;
  geometry: unknown;
  latitude: number | null;
  longitude: number | null;
  elevation: number | null;
  population: number | null;
  population_rank: number | null;
  timezone: string | null;
  geoname_id: number | null;
  is_capital: boolean;
  is_major_city: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaceNameGeo {
  id: string;
  place_id: string | null;
  geoname_id: number | null;
  name: string;
  lang: string | null;
  country_iso_a2: string | null;
  is_preferred: boolean | null;
  is_short_name: boolean;
  is_colloquial: boolean;
  is_historic: boolean;
  created_at: string;
  updated_at: string;
}
