/**
 * A6 — Verrous de contraintes.
 *
 * Un verrou n'est jamais remplacé silencieusement : toute violation est
 * détectée, l'appelant restaure la valeur verrouillée et journalise une
 * décision `requiresConfirmation`.
 */
import type { AdventureConstraint } from './constraints';
import type { AdventureDecision } from './decisions';
import type { PlanImpact } from './engine';

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => deepEqual(aRecord[key], bRecord[key]));
}

/**
 * Retourne les identifiants des verrous violés : valeur modifiée, verrou
 * retiré ou contrainte disparue. Les contraintes non verrouillées restent
 * librement ajustables.
 */
export function detectLockViolations(
  before: readonly AdventureConstraint[],
  after: readonly AdventureConstraint[],
  locks: readonly AdventureConstraint[] = before.filter((constraint) => constraint.locked)
): string[] {
  const afterById = new Map(after.map((constraint) => [constraint.id, constraint]));
  const violations: string[] = [];

  for (const lock of locks) {
    const next = afterById.get(lock.id);
    if (!next || !next.locked || !deepEqual(lock.value, next.value)) {
      violations.push(lock.id);
    }
  }

  return violations;
}

/**
 * Restaure les verrous violés dans `after` (valeur et drapeau `locked`), sans
 * toucher aux contraintes non verrouillées ni aux ajouts légitimes.
 */
export function restoreLockedConstraints(
  before: readonly AdventureConstraint[],
  after: readonly AdventureConstraint[],
  violations?: readonly string[]
): AdventureConstraint[] {
  const violationIds = new Set(violations ?? detectLockViolations(before, after));
  const lockById = new Map(before.filter((constraint) => constraint.locked).map((lock) => [lock.id, lock]));
  const restored: AdventureConstraint[] = [];

  for (const constraint of after) {
    const lock = violationIds.has(constraint.id) ? lockById.get(constraint.id) : undefined;
    restored.push(lock ? { ...lock } : constraint);
  }

  const restoredIds = new Set(restored.map((constraint) => constraint.id));
  for (const [id, lock] of lockById) {
    if (violationIds.has(id) && !restoredIds.has(id)) restored.push({ ...lock });
  }

  return restored;
}

/**
 * Journalise une décision `proposed` à confirmer pour chaque verrou violé.
 * ID déterministe (testable) ; la persistance génère l'UUID final.
 */
export function buildLockConfirmationDecisions(
  planId: string,
  before: readonly AdventureConstraint[],
  violations: readonly string[],
  now: string
): AdventureDecision[] {
  const lockById = new Map(before.map((constraint) => [constraint.id, constraint]));

  return violations.map((constraintId) => {
    const lock = lockById.get(constraintId);
    const label = lock?.label ?? constraintId;
    const impact: PlanImpact[] = [
      {
        id: `lock-${constraintId}`,
        section: 'coherence',
        label: `Verrou « ${label} » non respecté`,
        severity: 'warning',
      },
    ];

    return {
      id: `lock-decision-${constraintId}`,
      planId,
      decisionType: 'other',
      proposal: `Le verrou « ${label} » a été modifié par le solveur — confirmation requise pour appliquer la nouvelle valeur.`,
      impact,
      requiresConfirmation: true,
      status: 'proposed',
      createdAt: now,
    };
  });
}
