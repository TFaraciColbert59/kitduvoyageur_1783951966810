/**
 * AdventurePlan — source de vérité de l'aventure complète (ADR-AI-001).
 *
 * Chaque valeur significative porte provenance, date de calcul, validité,
 * confiance, hypothèses et impacts. Les sections sont typées `PlanValue<T> | null` :
 * une section non calculée est `null`, jamais implicite.
 */
import type { Assumption, EngineWarning, PlanImpact } from './engine';
import type { Confidence } from './confidence';
import type { DataProvenance } from './provenance';

export type AdventurePlanStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface AdventureIntent {
  rawInput: string;
  summary?: string;
  activities: string[];
  constraints: string[];
}

export const PARTICIPANT_ROLES = ['owner', 'member', 'guest'] as const;

export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export interface PlanParticipant {
  id: string;
  displayName: string;
  role: ParticipantRole;
  profileId?: string;
}

export interface AdventureDates {
  start?: string;
  end?: string;
  flexible: boolean;
}

export interface AdventureDestination {
  label: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
}

/** Valeur de plan complète : toute sortie de moteur intégrée au plan. */
export interface PlanValue<T> {
  value: T;
  confidence: Confidence;
  provenance: DataProvenance[];
  assumptions: Assumption[];
  warnings: EngineWarning[];
  impacts: PlanImpact[];
  computedAt: string;
  validUntil?: string;
}

/** Les 19 sections normatives d'un AdventurePlan. */
export const ADVENTURE_PLAN_SECTION_KEYS = [
  'transport',
  'localMobility',
  'accommodations',
  'dailyStages',
  'activityRoutes',
  'terrainAnalysis',
  'personalDifficulty',
  'groupDifficulty',
  'paceStrategies',
  'foodAndWater',
  'gearPlan',
  'budget',
  'bookings',
  'documents',
  'regulations',
  'safetyPlan',
  'offlinePackage',
  'liveConditions',
  'alternatives',
] as const;

export type AdventurePlanSectionKey = (typeof ADVENTURE_PLAN_SECTION_KEYS)[number];

export type AdventurePlanSections = {
  [K in AdventurePlanSectionKey]: PlanValue<unknown> | null;
};

export interface MonitoringRule {
  id: string;
  label: string;
  kind: string;
  enabled: boolean;
}

export interface AdventurePlan {
  id: string;
  ownerId: string;
  tripId?: string;
  title?: string;
  status: AdventurePlanStatus;
  currentVersion: number;
  intent: AdventureIntent;
  participants: PlanParticipant[];
  dates: AdventureDates;
  destinations: AdventureDestination[];
  sections: AdventurePlanSections;
  confidence: Confidence;
  monitoringRules: MonitoringRule[];
  createdAt: string;
  updatedAt: string;
}

/** Métadonnées d'une version immuable du plan (`adventure_plan_versions`). */
export interface PlanVersionMeta {
  planId: string;
  version: number;
  reason: string;
  generatedBy: string;
  confidence: Confidence;
  createdAt: string;
}
