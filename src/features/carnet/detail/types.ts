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
  /**
   * Échantillons horodatés `{lat, lng, timestamp, elevationM}` : seule source
   * de l'heure par point. Absente, les points ne portent pas d'heure et c'est
   * `started_at` qui date la sortie.
   */
  positions_timed?: unknown;
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
  place: string | null;
  imageUrl: string | null;
}

/** Un point GPS d'un jour : sa coordonnée réelle et son heure réelle. */
export interface CarnetDayPoint {
  lat: number;
  lng: number;
  /** Horodatage ISO du point (échantillon horodaté, sinon début de sortie). */
  at: string;
}

/**
 * Un jour de la fiche, dérivé côté serveur (`buildDays`).
 *
 * Un jour existe dès qu'il porte au moins un moment **ou** un point GPS.
 * Chaque valeur absente reste `null` : aucune distance, aucun dénivelé, aucune
 * durée et aucune date ne sont inventés ni répartis.
 */
export interface CarnetDay {
  /** Numéro du jour tel que le carnet le numérote, à partir de 1. */
  index: number;
  /** `YYYY-MM-DD`, ou `null` quand aucune date réelle ne peut être établie. */
  date: string | null;
  /** Longueur haversine des segments du jour, `null` sous deux points. */
  distanceKm: number | null;
  /** Somme des dénivelés positifs, si les altitudes existent. */
  elevationM: number | null;
  /** Somme des durées des sorties du jour (`duration_seconds`). */
  durationS: number | null;
  moments: CarnetMomentItem[];
  /** Points GPS des sorties du jour, fusionnés et triés chronologiquement. */
  points: CarnetDayPoint[];
}

/** Totaux réels du carnet : somme des jours, jamais une valeur inventée. */
export interface CarnetSummary {
  distanceKm: number | null;
  elevationM: number | null;
  days: number;
  moments: number;
}

export interface CarnetEtapeDay {
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

/** D'où vient le participant : la ligne du carnet, un collaborateur, ou une sortie. */
export type CarnetParticipantRole = 'author' | 'collaborator' | 'participant';

/**
 * Personne réellement rattachée au carnet : l'auteur (`carnets.author_id`), les
 * collaborateurs (`carnet_collaborators`) et les présents des sorties
 * (`hike_session_participants` via `hike_sessions.carnet_id`).
 * Un profil public absent laisse `name` à `null` : la ligne existe quand même,
 * l'affichage retombe sur l'initiale du handle. Aucun liker ici.
 */
export interface CarnetParticipant {
  userId: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  role: CarnetParticipantRole;
}

/** Ligne de participation telle que lue en base, avec son profil public éventuel. */
export interface ParticipantRow {
  user_id: string | null;
  /** Table d'origine : `carnet_collaborators` ou `hike_session_participants`. */
  source: 'collaborator' | 'participant';
  profile: AuthorRow | null;
}

export interface CarnetEngagement {
  likes: number;
  comments: number;
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
  /**
   * Participants réels, dédoublonnés par `userId`, l'auteur en premier.
   * Toujours au moins l'auteur quand le carnet en a un ; jamais un liker.
   */
  participants: CarnetParticipant[];
  stats: CarnetStatItem[];
  engagement: CarnetEngagement;
  /** Réactions réelles, plafonnées à 50, profils joints. */
  likers: CarnetLiker[];
  moments: CarnetMomentItem[];
  /** Moments qui portent une image : seuls ceux-là peuplent la grille. */
  photoMoments: CarnetMomentItem[];
  /**
   * Jours dérivés des moments et des points GPS (`buildDays`), indexés 1..n.
   * Un jour sans donnée n'est pas créé : la numérotation reste celle du carnet.
   */
  days: CarnetDay[];
  /** Étapes déclarées du carnet (`groupe_etapes`), lecture historique inchangée. */
  etapes: CarnetEtapeDay[];
  /** Totaux du carnet (`buildSummary`). */
  summary: CarnetSummary;
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
   * Toutes les sorties du carnet (les plus récentes d'abord), dans la limite
   * lue par `getCarnetDetail`. Sert exclusivement à `buildDays` : chaque sortie
   * date son bloc de points GPS. Absente, `hikeSession` en tient lieu.
   */
  sessions?: HikeSessionRow[];
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
   * Collaborateurs (`carnet_collaborators`) puis présents des sorties
   * (`hike_session_participants`), profils publics joints. Lus sous RLS : une
   * ligne que la policy cache est simplement absente, jamais remplacée.
   */
  participants?: ParticipantRow[];
  /**
   * Compteurs agrégés depuis les tables d'engagement. `carnets.likes_count`
   * n'est pas maintenu par trigger : sans ces valeurs, la fiche afficherait un
   * nombre décoratif (constat de recette : 22 en colonne, 3 lignes réelles).
   */
  counts?: { likes: number; comments: number };
}
