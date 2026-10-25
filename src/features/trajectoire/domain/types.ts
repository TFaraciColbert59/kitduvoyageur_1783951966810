/**
 * Types du domaine Trajectoire Vivante.
 *
 * Regle d'or (ROADMAP_VOYAGE 4.2) : toute donnee structuree porte sa
 * provenance. Un type sans `source` est un bug de conception.
 */

import type { DangerLevel, StepGrain, TrajectoireSourceId, TrajectoireZone } from './scaleAxis';

export type { DangerLevel, StepGrain, TrajectoireSourceId, TrajectoireZone };

/** Contrainte explicite ou implicite detectee dans l'intention brute. */
export type ConstraintId =
  | 'sans_voiture'
  | 'refuges'
  | 'peu_expose'
  | 'itineraire_ulturel'
  | 'avec_enfants'
  | 'budget_maitrise'
  | 'public'
  | 'avance';

export interface ConstraintDef {
  id: ConstraintId;
  label: string;
  /** Effet multiplicatif applique a la dangerousite. */
  dangerBias: number;
}

export const CONSTRAINTS: Record<ConstraintId, ConstraintDef> = {
  sans_voiture: { id: 'sans_voiture', label: 'Sans voiture', dangerBias: 1.05 },
  refuges: { id: 'refuges', label: 'Refuges', dangerBias: -0.08 },
  peu_expose: { id: 'peu_expose', label: 'Passages peu exposes', dangerBias: -0.12 },
  itineraire_ulturel: { id: 'itineraire_ulturel', label: 'Itineraire culturel', dangerBias: -0.05 },
  avec_enfants: { id: 'avec_enfants', label: 'Avec enfants', dangerBias: 1.12 },
  budget_maitrise: { id: 'budget_maitrise', label: 'Budget maitrise', dangerBias: 1 },
  public: { id: 'public', label: 'Depart public', dangerBias: 1.08 },
  avance: { id: 'avance', label: 'Profile avance', dangerBias: 1.15 },
};

/** Destination resolue par extraction deterministe de l'intention. */
export interface Destination {
  id: string;
  /** Nom lisible, tel qu'affiche. */
  name: string;
  /** Sous-titre de la region. */
  region: string;
  /** ISO 3166-1 alpha-2, ou null si non resolu. */
  countryCode: string | null;
  /** Etapes-reperes du parcours, dans l'ordre. */
  anchors: readonly string[];
  /** Vitesse de marche de reference, en km/h. */
  paceKmh: number;
}

/** Sortie de l'analyse d'intention : 100 % deterministe, aucun LLM. */
export interface IntentionProfile {
  raw: string;
  destination: Destination;
  constraints: readonly ConstraintId[];
  /** budgetMaxEur si l'utilisateur en donne un dans la phrase. */
  budgetMaxEur: number | null;
}

export interface BudgetBreakdown {
  transportEur: number;
  hebergementEur: number;
  activitesEur: number;
  kitManquantEur: number;
  totalEur: number;
  /** Lignes d'affiliation actives sur ce budget. */
  affiliation: readonly { label: string; sourceId: TrajectoireSourceId; eur: number }[];
}

export interface DangerFactor {
  id: 'altitude' | 'exposition' | 'isolation' | 'meteo';
  label: string;
  /** Valeur affichee, deja formatee pour l'UI. */
  display: string;
  /** Score du facteur, 0-100, pour la barre. */
  score: number;
  sourceId: TrajectoireSourceId;
}

export interface DangerReport {
  score: number;
  level: DangerLevel;
  factors: readonly DangerFactor[];
}

export interface WindowReport {
  ideal: string;
  risk: string | null;
  /** Heures de jour utiles, format "13 h 40". */
  daylight: string;
  /** Amplitude thermique, format "4 C -> 19 C". */
  amplitude: string;
  /** Points d'eau, format "3 points - 8 km". */
  water: string;
  sourceId: TrajectoireSourceId;
}

export interface PlanStep {
  id: string;
  title: string;
  detail: string;
  distanceKm: number | null;
  sourceId: TrajectoireSourceId;
}

export interface KitItem {
  id: string;
  label: string;
  owned: boolean;
  priceEur: number | null;
  sourceId: TrajectoireSourceId;
}

export interface TraceMatch {
  id: string;
  author: string;
  initials: string;
  /** Ligne de contexte, ex: "Dolomites - 5 j - refuges". */
  context: string;
  hours: number;
  distanceM: number | null;
  source: 'trace_tribu' | 'randonnee_perso';
  /** Adequation d'echelle, 0-1. */
  scaleMatch: number;
  /** La trace est-elle dans la meme zone que le curseur ? */
  atYourScale: boolean;
}

export type VeilleKind = 'meteo' | 'prix' | 'creneaux' | 'dangerosite';

export interface VeilleRule {
  kind: VeilleKind;
  label: string;
  detail: string;
  active: boolean;
  sourceId: TrajectoireSourceId;
}

/**
 * L'instantane complet : tout ce que l'ecran affiche, calcule en domaine pur.
 * Une seule source de verite pour les 8 cartes.
 */
export interface TrajectoireSnapshot {
  /** Position du curseur, 0-1. */
  t: number;
  /** Duree derivee, en heures. */
  hours: number;
  /** Duree en jours, arrondie a 1 decimal. */
  days: number;
  zone: TrajectoireZone;
  zoneLabel: string;
  zoneSub: string;
  radiusKm: number;
  packLiters: number;
  grain: StepGrain;
  danger: DangerReport;
  budget: BudgetBreakdown;
  window: WindowReport;
  steps: readonly PlanStep[];
  kit: readonly KitItem[];
  kitLoadKg: number;
  traces: readonly TraceMatch[];
  veille: readonly VeilleRule[];
  provenance: readonly TrajectoireSourceId[];
  /** Cout de calcul du domaine, en millisecondes (budget : < 2 ms). */
  computeMs: number;
}

/** Regle d'autopilot persistee en base (migration 20260930080000). */
export interface TrajectoireVeilleRule {
  kind: VeilleKind;
  payload: Record<string, unknown>;
  channel: 'push' | 'email';
  active: boolean;
}
