import 'server-only';

/**
 * T29 — Avis matériel fondé sur l'utilisation : équipement porté/utilisé,
 * acheté OU emprunté (traitement égal), contenu utile ; ne recrédite pas le
 * même débrief transformé en avis. Reconnaissance locale : descriptive,
 * jamais un pouvoir ni une certification.
 */

export type GearReviewRefusal =
  | 'usage_non_prouve'
  | 'debrief_deja_credite'
  | 'contenu_insuffisant'
  | 'deja_credite';

export interface GearReviewInput {
  /** L'équipement apparaît dans un débrief terrain d'une session traitée. */
  usedOnField: boolean;
  /** Possédé ou emprunté : les deux sont acceptés à égalité. */
  ownership: 'owned' | 'borrowed';
  /** Empreinte du contenu de l'avis (normalisé). */
  contentFingerprint: string;
  /** Le même contenu a déjà été crédité comme débrief terrain. */
  sameContentAsCreditedDebrief: boolean;
  contentLength: number;
  existingFingerprints?: readonly string[];
}

export function evaluateGearReview(
  input: GearReviewInput
): { ok: true; claimKey: string } | { ok: false; reason: GearReviewRefusal } {
  if (!input.usedOnField) return { ok: false, reason: 'usage_non_prouve' };
  if (input.sameContentAsCreditedDebrief) return { ok: false, reason: 'debrief_deja_credite' };
  if (input.contentLength < 40) return { ok: false, reason: 'contenu_insuffisant' };
  if ((input.existingFingerprints ?? []).includes(input.contentFingerprint)) {
    return { ok: false, reason: 'deja_credite' };
  }
  // Possédé et emprunté sont traités à égalité : aucun chemin privilégié.
  void input.ownership;
  return { ok: true, claimKey: `gear_review:${input.contentFingerprint}` };
}
