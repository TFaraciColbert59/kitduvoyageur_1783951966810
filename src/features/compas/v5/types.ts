/**
 * Compas v5 : contrats partagés entre le serveur (extras), le modèle de vue (fonctions pures) et l'interface.
 *
 * Règle commune : aucune valeur inventée. Un prix, une photo, une distance ou un horaire porte sa source ;
 * absent, il est `null` et l'écran dit « non renseigné ». Les prix d'hébergement sans partenaire sont des
 * repères de barème (`basis: 'bareme'`), jamais présentés comme le tarif de l'établissement.
 */

/** Photo d'un lieu : géolocalisée, avec son auteur et sa licence (Wikimedia Commons). Sans photo : illustration. */
export interface V5Photo {
  /** Vignette (largeur ≈ 480 px) servie par `thumb.wikimedia.org` ou `upload.wikimedia.org`. */
  url: string;
  /** Auteur tel que publié, texte brut. */
  credit: string;
  /** Licence (« CC BY-SA 4.0 », « Domaine public »…). */
  license: string;
  /** Page du fichier sur Commons (lien de crédit). */
  pageUrl: string;
}

export type V5StayKind = 'hebergement' | 'refuge' | 'camping' | 'bivouac';

/** Repère de prix d'une nuit, par personne. `basis` dit d'où il vient. */
export interface V5PriceHint {
  perPerson: number;
  currency: string;
  basis: 'bareme' | 'partenaire';
  /** Date de relevé ou du barème (ISO). */
  asOf: string;
}

/** Une nuit possible près de l'arrivée d'un jour : un lieu réel de la carte (OpenStreetMap), classé. */
export interface V5StayOption {
  /** Identifiant stable : `osm:<id>`, ou `noted:<nom>` pour la nuit déjà notée par la personne. */
  id: string;
  name: string;
  kind: V5StayKind;
  lat: number;
  lon: number;
  /** Distance à l'arrivée du jour, en mètres. */
  distanceM: number;
  elevationM: number | null;
  price: V5PriceHint | null;
  photo: V5Photo | null;
  /** Source de la ligne (« OpenStreetMap », « barème du Compas »…). */
  source: string;
  /** Lien officiel ou partenaire, ouvert par la personne ; jamais ouvert seul. */
  url: string | null;
  /** Lien partenaire (affiliation) : l'écran affiche la mention et `rel="sponsored nofollow"`. */
  partner: string | null;
}

export interface V5TransportOption {
  id: 'car' | 'train' | 'carpool' | 'bus' | 'flight' | 'foot';
  label: string;
  /** Description courte (« 1 h 45 depuis Lyon »). */
  detail: string | null;
  /** Coût total (voiture) ou par personne, en euros ; null si non chiffrable. */
  amountEur: number | null;
  perPerson: boolean;
  source: string;
  url: string | null;
  partner: string | null;
}

/** Ce que le serveur ajoute aux données du voyage : lu après l'affichage, jamais bloquant. */
export interface V5Extras {
  /** Par numéro de jour : nuits possibles, la mieux placée d'abord. */
  nights: Record<number, V5StayOption[]>;
  /** Par numéro de jour : photo géolocalisée du lieu d'arrivée, ou null. */
  dayPhotos: Record<number, V5Photo | null>;
  transport: V5TransportOption[];
  /** Instant de la lecture (ISO). */
  fetchedAt: string;
  /** Sources qui n'ont pas répondu : l'écran le dit, jamais de valeur comblée. */
  unavailable: Array<'lodging' | 'photos' | 'transport'>;
}

export const EMPTY_EXTRAS: V5Extras = {
  nights: {},
  dayPhotos: {},
  transport: [],
  fetchedAt: '',
  unavailable: [],
};

/* ---------- Modèle de vue (calculé, pur) ---------- */

export interface V5WeatherDay {
  date: string;
  tMinC: number;
  tMaxC: number;
  precipPct: number | null;
  /** Code météo WMO. */
  code: number;
  label: string;
}

export interface V5Day {
  /** 0-based. */
  index: number;
  /** Numéro de jour du voyage (1-based). */
  day: number;
  date: string | null;
  title: string;
  from: string | null;
  to: string | null;
  distanceKm: number | null;
  gainM: number | null;
  lossM: number | null;
  /** Temps de marche du plus lent, en minutes. */
  walkMin: number | null;
  /** Point d'arrivée du jour. */
  lat: number | null;
  lon: number | null;
  /** Nuit retenue pour ce soir (nom noté), ou null. */
  stay: string | null;
  isLast: boolean;
  weather: V5WeatherDay | null;
}

export type V5Space = 'day' | 'nous' | 'budget' | 'sac' | 'prevoir' | 'verifs' | 'meteo' | 'voyage' | 'menu';

export interface V5Point {
  /** Fait vérifiable à régler, jamais une note. */
  id: string;
  kind: 'toi' | 'terrain' | 'conditions';
  text: string;
  severity: 'info' | 'warn' | 'block';
  /** Ce que fait le bouton : ouvrir un tiroir sur un onglet. */
  action: { space: V5Space; tab?: number; day?: number } | null;
  /** Source et date de la donnée qui déclenche le point. */
  source: string;
}
