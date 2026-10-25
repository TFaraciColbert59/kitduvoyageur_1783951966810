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

/**
 * Confirmation requise par type de décision — mapping exhaustif.
 * `other` est non structurante : elle ne requiert pas de confirmation.
 */
export const REQUIRES_CONFIRMATION_BY_TYPE: Record<DecisionType, boolean> = {
  payment: true,
  cancellation: true,
  safety_change: true,
  location_share: true,
  group_change: true,
  other: false,
};

export function requiresConfirmation(type: DecisionType): boolean {
  return REQUIRES_CONFIRMATION_BY_TYPE[type];
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
