/**
 * Diff avant/après pour l'audit forensique — pur, testable.
 * Ne traite que les clés propres énumérables (pas de prototype).
 */

export interface FieldDiff {
  field: string;
  before: unknown;
  after: unknown;
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.getPrototypeOf(v) === Object.prototype;
}

export function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): FieldDiff[] {
  if (!isPlainRecord(before) || !isPlainRecord(after)) return [];
  const out: FieldDiff[] = [];
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const field of fields) {
    const hasBefore = Object.prototype.hasOwnProperty.call(before, field);
    const hasAfter = Object.prototype.hasOwnProperty.call(after, field);
    if (hasBefore && !hasAfter) {
      // Suppression forensique : un retrait (rôle, MFA...) doit apparaître.
      out.push({ field, before: before[field], after: undefined });
    } else if (!hasBefore && hasAfter) {
      out.push({ field, before: undefined, after: after[field] });
    } else if (!Object.is(before[field], after[field])) {
      out.push({ field, before: before[field], after: after[field] });
    }
  }
  return out;
}
