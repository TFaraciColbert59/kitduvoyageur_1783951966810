import 'server-only';

/**
 * T27 — Contributions éditoriales (guides, traductions) : protocole commun de
 * révision et d'acceptation. Adaptateurs petits, même contrôle de provenance.
 *
 * Refus stables : licence non permise, langue cible absente (traduction),
 * texte IA brut non relu, copie exacte d'une source déjà créditée, révision
 * identique déjà acceptée (empreinte). Le gain est unique par révision
 * acceptée (claim `editorial:<empreinte>`).
 */

export type EditorialKind = 'guide' | 'translation';

export const ALLOWED_LICENSES = ['cc_by', 'cc_by_sa', 'cc0', 'public_domain', 'lkdv_original'] as const;

export type EditorialRefusal =
  | 'licence_incompatible'
  | 'langue_cible_absente'
  | 'ia_brute_non_relue'
  | 'copie_non_inedite'
  | 'revision_non_acceptee'
  | 'deja_creditee';

export interface EditorialInput {
  kind: EditorialKind;
  license: string;
  targetLanguage?: string | null;
  /** Empreinte de la révision acceptée (contenu normalisé). */
  contentFingerprint: string;
  /** Empreinte des sources éventuelles (carnet, texte d'origine). */
  sourceFingerprints?: readonly string[];
  aiGeneratedUnreviewed?: boolean;
  accepted: boolean;
  alreadyCreditedFingerprints?: readonly string[];
}

export function evaluateEditorialProof(
  input: EditorialInput
): { ok: true; claimKey: string } | { ok: false; reason: EditorialRefusal } {
  if (!input.accepted) return { ok: false, reason: 'revision_non_acceptee' };
  if (!(ALLOWED_LICENSES as readonly string[]).includes(input.license)) {
    return { ok: false, reason: 'licence_incompatible' };
  }
  if (input.kind === 'translation' && (!input.targetLanguage || input.targetLanguage.trim().length < 2)) {
    return { ok: false, reason: 'langue_cible_absente' };
  }
  if (input.aiGeneratedUnreviewed === true) {
    return { ok: false, reason: 'ia_brute_non_relue' };
  }
  if ((input.sourceFingerprints ?? []).includes(input.contentFingerprint)) {
    return { ok: false, reason: 'copie_non_inedite' };
  }
  if ((input.alreadyCreditedFingerprints ?? []).includes(input.contentFingerprint)) {
    return { ok: false, reason: 'deja_creditee' };
  }
  return { ok: true, claimKey: `editorial:${input.contentFingerprint}` };
}
