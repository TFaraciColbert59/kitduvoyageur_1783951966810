/** Contrat de la fiche carnet. Une valeur absente est `null`, jamais inventée. */

export interface CarnetRow {
  id: string;
  author_id: string | null;
  title: string | null;
  destination: string | null;
  description: string | null;
  cover_image: string | null;
  cover_image_alt: string | null;
  start_date: string | null;
  end_date: string | null;
  visibility: string | null;
  verified: boolean | null;
  likes_count: number | null;
  comments_count: number | null;
  views_count: number | null;
  distance_km: number | string | null;
  denivele_m: number | string | null;
  groupe_id: string | null;
  lieu_depart: string | null;
  lieu_arrivee: string | null;
  /** Code ISO 3166-1 alpha-2 réel de la colonne `carnets.country_iso`. */
  country_iso?: string | null;
}

export interface HikeSessionRow {
  id: string;
  carnet_id: string | null;
  distance_km: number | string | null;
  elevation_gain_m: number | string | null;
  duration_seconds: number | null;
  started_at: string | null;
  positions_geojson: unknown;
}

export interface EtapeRow {
  id: string;
  jour_numero: number | null;
  ordre: number | null;
  date_etape: string | null;
  lieu_depart: string | null;
  lieu_arrivee: string | null;
  recit: string | null;
  distance_km: number | string | null;
  denivele_m: number | string | null;
  duree_texte: string | null;
  meteo: string | null;
  temperature_c: number | null;
}

export interface HebergementRow {
  id: string;
  apres_jour_numero: number | null;
  nom: string | null;
  prix_cents: number | null;
  prix_note: string | null;
  altitude_m: number | null;
  note: string | null;
  hote: string | null;
}

export interface MomentRow {
  id: string;
  jour_numero: number | null;
  heure: string | null;
  citation: string | null;
  auteur_nom: string | null;
  lieu: string | null;
  image_url: string | null;
}

export interface KitItemRow {
  id: string;
  nom: string | null;
  detail: string | null;
  poids_g: number | null;
  couleur_tag: string | null;
  sort_order: number | null;
}

export interface AuthorRow {
  id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  trust_score: number | null;
}

export interface CarnetAuthor {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  trustScore: number;
}

export interface CarnetStatItem {
  key: 'distance' | 'elevation' | 'days';
  label: string;
  value: string;
}

export interface CarnetMomentItem {
  id: string;
  dayNumber: number;
  time: string | null;
  caption: string | null;
  authorName: string | null;
  place: string | null;
  imageUrl: string | null;
}

export interface CarnetDay {
  id: string;
  dayNumber: number;
  label: string;
  from: string | null;
  to: string | null;
  note: string | null;
  distanceKm: number | null;
  elevationM: number | null;
  durationText: string | null;
  weather: string | null;
  /** Nom du refuge où l'on dort après cette journée. */
  overnight: string | null;
}

export interface CarnetKitItemRow {
  id: string;
  name: string;
  detail: string | null;
  weightG: number | null;
  color: string | null;
}

export interface CarnetKit {
  /** Somme des poids connus. `null` si aucun poids n'est renseigné. */
  totalWeightG: number | null;
  items: CarnetKitItemRow[];
}

export interface CarnetLiker {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  reaction: string;
}

export interface CarnetEngagement {
  likes: number;
  comments: number;
  views: number;
  liked: boolean;
  favorited: boolean;
}

/**
 * Lieu de la fiche, en trois segments affichables : « pays · région · lieu ».
 * Chaque valeur vient d'une colonne réelle (`country_iso`, `lieu_depart`) ou du
 * premier point réel de la trace. Un champ absent reste `null` : rien n'est
 * inventé, aucune coordonnée n'est estimée.
 */
export interface CarnetPlace {
  country: string | null;
  region: string | null;
  locality: string | null;
  lat: number | null;
  lng: number | null;
}

export interface CarnetDetail {
  id: string;
  title: string;
  destination: string | null;
  description: string | null;
  coverImage: string | null;
  coverImageAlt: string | null;
  startDate: string | null;
  endDate: string | null;
  dateRange: string | null;
  visibility: string;
  isPublic: boolean;
  verified: boolean;
  isOwner: boolean;
  author: CarnetAuthor | null;
  stats: CarnetStatItem[];
  engagement: CarnetEngagement;
  /** Réactions réelles, plafonnées à 50, profils joints. */
  likers: CarnetLiker[];
  moments: CarnetMomentItem[];
  /** Moments qui portent une image : seuls ceux-là peuplent la grille. */
  photoMoments: CarnetMomentItem[];
  days: CarnetDay[];
  kit: CarnetKit;
  trace: unknown | null;
  /** Lieu réel de la fiche : pays · région · lieu, plus la coordonnée de départ. */
  place: CarnetPlace;
  distanceKm: number | null;
  elevationM: number | null;
}

export interface BuildCarnetDetailInput {
  carnet: CarnetRow;
  author: AuthorRow | null;
  /** Sortie la plus récente : elle porte les statistiques affichées. */
  hikeSession: HikeSessionRow | null;
  /**
   * Trace réelle à dessiner, choisie parmi toutes les sorties du carnet
   * (`pickCarnetTrace`). Absente, on retombe sur la trace de `hikeSession`.
   */
  trace?: unknown | null;
  etapes: EtapeRow[];
  hebergements: HebergementRow[];
  moments: MomentRow[];
  kitItems: KitItemRow[];
  viewerId: string | null;
  liked: boolean;
  favorited: boolean;
  likers?: Array<{ user_id: string; reaction: string | null; profile: AuthorRow | null }>;
  /**
   * Compteurs agrégés depuis les tables d'engagement. `carnets.likes_count`
   * n'est pas maintenu par trigger : sans ces valeurs, la fiche afficherait un
   * nombre décoratif (constat de recette : 22 en colonne, 3 lignes réelles).
   */
  counts?: { likes: number; comments: number };
}
