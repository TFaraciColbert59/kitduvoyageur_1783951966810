/**
 * Contraintes d'aventure — niveaux `hard` / `soft`, verrous non modifiables
 * silencieusement (le solveur ne modifie jamais un verrou sans trace).
 */

export type AdventureConstraintKind = 'hard' | 'soft';

export type AdventureConstraintSource = 'user' | 'system' | 'safety';

export interface AdventureConstraint<T = unknown> {
  id: string;
  kind: AdventureConstraintKind;
  label: string;
  value: T;
  locked: boolean;
  source: AdventureConstraintSource;
}

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
 * Vrai si aucun verrou présent dans `before` n'a été remplacé silencieusement
 * dans `after` : il doit encore exister, rester verrouillé et porter la même
 * valeur. Les contraintes non verrouillées restent librement ajustables.
 */
export function assertNoSilentLockOverride(
  before: readonly AdventureConstraint[],
  after: readonly AdventureConstraint[]
): boolean {
  const afterById = new Map(after.map((constraint) => [constraint.id, constraint]));

  for (const previous of before) {
    if (!previous.locked) continue;
    const next = afterById.get(previous.id);
    if (!next) return false;
    if (!next.locked) return false;
    if (!deepEqual(previous.value, next.value)) return false;
  }

  return true;
}
