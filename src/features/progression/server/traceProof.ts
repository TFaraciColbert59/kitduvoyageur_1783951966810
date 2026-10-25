import 'server-only';

/**
 * T28 — Traces contributives : une trace nouvelle issue d'une RÉALISATION
 * contrôlée, apportant une donnée inédite, licence conservée et zones
 * sensibles expurgées. Un import GPX seul ne constitue pas une réalisation.
 * Claim trace partagé par empreinte : même trace ou révision déjà incluse
 * dans un guide → pas de second crédit.
 */

export type TraceRefusal =
  | 'import_seul_refuse'
  | 'realisation_non_controlee'
  | 'trace_inchangee'
  | 'deja_incluse'
  | 'geometrie_sensible'
  | 'licence_incompatible';

export interface TraceInput {
  /** Import GPX sans session traitée liée. */
  importOnly: boolean;
  hasControlledRealization: boolean;
  /** Empreinte géométrique normalisée de la trace. */
  traceFingerprint: string;
  /** Empreintes déjà créditées (guide, autre contribution). */
  existingFingerprints?: readonly string[];
  /** Bornes sensibles (zones protégées) non expurgées. */
  containsSensitiveZone?: boolean;
  license: string;
}

const ALLOWED_TRACE_LICENSES = ['cc_by', 'cc_by_sa', 'cc0', 'public_domain', 'lkdv_original'];

export function evaluateTraceContribution(
  input: TraceInput
): { ok: true; claimKey: string } | { ok: false; reason: TraceRefusal } {
  if (input.importOnly) return { ok: false, reason: 'import_seul_refuse' };
  if (!input.hasControlledRealization) return { ok: false, reason: 'realisation_non_controlee' };
  if (!ALLOWED_TRACE_LICENSES.includes(input.license)) {
    return { ok: false, reason: 'licence_incompatible' };
  }
  if (input.containsSensitiveZone === true) {
    return { ok: false, reason: 'geometrie_sensible' };
  }
  if ((input.existingFingerprints ?? []).includes(input.traceFingerprint)) {
    return { ok: false, reason: 'deja_incluse' };
  }
  if (input.traceFingerprint.trim().length < 8) {
    return { ok: false, reason: 'trace_inchangee' };
  }
  return { ok: true, claimKey: `trace:${input.traceFingerprint}` };
}
