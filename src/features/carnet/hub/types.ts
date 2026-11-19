/**
 * Carnets de bord — hub `/carnets` : contrat de données.
 *
 * Le chargeur serveur (`loadCarnetsHub.ts`) lit les tables sous RLS et ne
 * produit QUE ces modèles de vue : ni les tuiles ni l'écran ne reçoivent une
 * ligne Supabase brute (même règle que la Communauté v2). Types purs, aucune
 * dépendance React ni accès réseau.
 */

/** État du carnet, dérivé des dates (fuseau Europe/Paris) — jamais d'une étiquette. */
export type CarnetPhase = 'preparation' | 'en_route' | 'rentre';

/** Capsule de filtres de l'écran (maquette écran 1 : En route · Suivis · Monde · Les miens). */
export type CarnetsHubFilter = 'route' | 'followed' | 'world' | 'mine';

/** Personne (auteur ou voyageur) telle que l'écran l'affiche. */
export interface HubPerson {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

/** Un carnet du hub, prêt à peindre. */
export interface CarnetHubItem {
  id: string;
  title: string;
  destination: string;
  /** Photo de couverture réelle, `null` si le carnet n'en a pas. */
  coverImage: string | null;
  /** Photos de repli (3 dernières images de moments) : mosaïque sans couverture. */
  coverPhotos: string[];
  /** Tracé normalisé en points SVG 0-100 (`map_points.trace`), `null` si absent. */
  routeTrace: Array<[number, number]> | null;
  /** Code pays alpha-2 du tampon, `null` si absent ou invalide. */
  countryIso: string | null;
  startDate: string | null;
  endDate: string | null;
  phase: CarnetPhase;
  /** Durée prévue en jours civils (date de fin incluse), `null` sans dates. */
  daysTotal: number | null;
  /** Jour courant (J1…J n) quand le carnet est en route, `null` sinon. */
  dayCurrent: number | null;
  distanceKm: number;
  elevationGainM: number;
  nights: number;
  /** Voyageurs affichés (3 au plus), l'auteur en tête s'il est seul. */
  travelers: HubPerson[];
  /** Nombre réel de voyageurs (`nb_voyageurs`, repli sur la liste lue). */
  travelersTotal: number;
  author: HubPerson;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  /** Trace GPS vérifiée (`carnets.verified`). */
  verifiedGps: boolean;
  /** Partage en direct activé par l'auteur (colonne `live_sharing`). */
  liveSharing: boolean;
  isMine: boolean;
  /** L'auteur fait partie des personnes suivies par le lecteur. */
  isFollowed: boolean;
}

/** Chargeur du hub : tout ce que l'écran reçoit du serveur, en une lecture. */
export interface CarnetsHubData {
  viewerId: string | null;
  items: CarnetHubItem[];
  mineCount: number;
  followedCount: number;
  /** `true` seulement si la lecture principale des carnets a échoué (état erreur + Réessayer). */
  error: boolean;
}
