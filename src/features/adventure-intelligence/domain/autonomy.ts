/**
 * A6 — Niveaux d'autonomie.
 *
 * L'autonomie ne contourne jamais une confirmation requise (A1) : paiement,
 * annulation, changement sécurité, partage de position et changement de
 * groupe restent toujours confirmés par l'utilisateur.
 */
import { requiresConfirmation, type DecisionType } from './decisions';

export const AUTONOMY_LEVELS = ['advisor', 'copilot', 'guided_autopilot'] as const;

export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

/** Actions qui exigent une confirmation quel que soit le niveau d'autonomie. */
export const AUTONOMY_CONFIRMATION_ACTIONS: readonly DecisionType[] = [
  'payment',
  'cancellation',
  'safety_change',
  'location_share',
  'group_change',
];

/** Réutilise le mapping A1 `requiresConfirmation` — aucune duplication. */
export function requiredConfirmations(action: DecisionType): boolean {
  return requiresConfirmation(action);
}

/**
 * `advisor` propose uniquement ; `copilot` et `guided_autopilot` exécutent
 * automatiquement les actions non structurantes (`other`). Les actions à
 * confirmation ne sont jamais auto-exécutées.
 */
export function canAutoExecute(level: AutonomyLevel, action: DecisionType): boolean {
  if (requiredConfirmations(action)) return false;
  return level !== 'advisor';
}
