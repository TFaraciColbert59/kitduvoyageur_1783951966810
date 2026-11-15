/**
 * Contrat du domaine « équipement sportif » (D04).
 *
 * Aucune valeur n'est inventée : une distance absente reste `null`, une sortie
 * non éligible est exclue avec sa raison, et un seuil inconnu n'est jamais
 * remplacé par une valeur par défaut implicite.
 */

export const GEAR_KINDS = ['bike', 'shoe', 'component', 'other'] as const;
export type GearKind = (typeof GEAR_KINDS)[number];

export const GEAR_SPORTS = [
  'rando',
  'trail',
  'course',
  'velo',
  'ski',
  'kayak',
  'escalade',
  'famille',
  'bivouac',
] as const;
export type GearSport = (typeof GEAR_SPORTS)[number];

export interface GearRef {
  id: string;
  name: string;
  kind: GearKind;
  sport?: string | null;
  weightG?: number | null;
  condition?: string | null;
  photoUrl?: string | null;
}

export interface GearUsageEvent {
  /** Identifiant de la séance : clé d'idempotence du kilométrage. */
  sessionId: string;
  gearItemId: string;
  /** Sport de la séance, `null` quand la source ne le porte pas. */
  sport: string | null;
  /** Distance en kilomètres, `null` quand elle n'est pas mesurée. */
  distanceKm: number | null;
  status: string | null;
  endedAt: string | null;
  /** Version de l'événement : une correction valide remplace la précédente. */
  revision?: number;
  correctedAt?: string | null;
  /** Un retrait explicite annule la contribution de cette séance. */
  removed?: boolean;
}

export interface GearUsageSummary {
  sessionId: string;
  distanceKm: number;
  sport: string | null;
}

export interface GearMileage {
  totalKm: number;
  sessionCount: number;
  /** Séances terminées dont la distance vaut exactement 0 km. */
  zeroDistanceSessions: number;
  /** Séances terminées sans distance mesurée : exclues, jamais comptées 0. */
  missingDistanceSessions: number;
  /** Séances non terminées, retirées ou hors sport. */
  ignoredSessions: number;
  /** Séances comptées dont le sport n'est pas connu. */
  sportUnknownSessions: number;
  usages: GearUsageSummary[];
}

export interface GearMileageAlert {
  due: boolean;
  shouldNotify: boolean;
  remainingKm: number | null;
  progressPercent: number | null;
}

export interface GearComponent {
  id: string;
  gearItemId: string;
  name: string;
  kind: string;
  installedAtKm: number | null;
  replacedAtKm: number | null;
  thresholdKm: number | null;
}

export interface GearComponentMileage {
  km: number | null;
  due: boolean;
  remainingKm: number | null;
  progressPercent: number | null;
}

export interface GearSportDefault {
  gearItemId: string;
  sport: string;
  kind: GearKind;
  priority: number;
}

export type GearDefaultSource = 'activity' | 'sport' | 'available';

export interface GearDefaultCandidate {
  item: GearRef;
  isDefault: boolean;
  source: GearDefaultSource;
}

export function isGearKind(value: unknown): value is GearKind {
  return typeof value === 'string' && (GEAR_KINDS as readonly string[]).includes(value);
}

export function isGearSport(value: unknown): value is GearSport {
  return typeof value === 'string' && (GEAR_SPORTS as readonly string[]).includes(value);
}
