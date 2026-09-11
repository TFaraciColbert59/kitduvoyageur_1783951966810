/**
 * Décisions — toute action coûteuse, irréversible ou de sécurité exige une
 * confirmation explicite de l'utilisateur (cf. master plan §24).
 */
import type { PlanImpact } from './engine';

export const DECISION_TYPES = [
  'payment',
  'cancellation',
  'safety_change',
  'location_share',
  'group_change',
  'other',
] as const;

export type DecisionType = (typeof DECISION_TYPES)[number];

export const DECISION_STATUSES = ['proposed', 'confirmed', 'rejected', 'expired'] as const;

export type DecisionStatus = (typeof DECISION_STATUSES)[number];

/** Toutes les décisions exigent une confirmation, sauf `other` (non structurante). */
export function requiresConfirmation(type: DecisionType): boolean {
  return type !== 'other';
}

export interface AdventureDecision {
  id: string;
  planId: string;
  decisionType: DecisionType;
  proposal: string;
  impact: PlanImpact[];
  requiresConfirmation: boolean;
  status: DecisionStatus;
  decidedBy?: string;
  decidedAt?: string;
  createdAt: string;
}
