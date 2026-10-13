import 'server-only';

/**
 * T33 — Intervention sur le matériel : entretien ou réparation réellement
 * effectué et confirmé proportionnellement. Une simple alerte résolue ne
 * rapporte rien ; entretien et réparation du MÊME acte ne se cumulent pas ;
 * aucun justificatif d'achat exigé, aucune certification de sécurité
 * automatique.
 */

export type InterventionRefusal =
  | 'alerte_seule'
  | 'auto_confirmation'
  | 'acte_duplique'
  | 'objet_sous_delai';

export interface InterventionInput {
  kind: 'maintenance' | 'repair';
  actorId: string;
  confirmerId: string | null;
  /** L'acte a-t-il réellement eu lieu (hors simple acquittement d'alerte) ? */
  interventionPerformed: boolean;
  /** Empreinte de l'ACTE (objet + nature + date) — pas du texte. */
  actFingerprint: string;
  /** Actes déjà crédités (même objet, entretien/réparation confondus). */
  existingActFingerprints?: readonly string[];
  lastObjectCreditAt?: string | null;
  now?: Date;
}

export const INTERVENTION_OBJECT_COOLDOWN_DAYS = 90;

export function evaluateIntervention(
  input: InterventionInput
): { ok: true; claimKey: string } | { ok: false; reason: InterventionRefusal } {
  if (!input.interventionPerformed) return { ok: false, reason: 'alerte_seule' };
  if (!input.confirmerId || input.confirmerId === input.actorId) {
    return { ok: false, reason: 'auto_confirmation' };
  }
  if ((input.existingActFingerprints ?? []).includes(input.actFingerprint)) {
    return { ok: false, reason: 'acte_duplique' };
  }
  if (input.lastObjectCreditAt) {
    const last = Date.parse(input.lastObjectCreditAt);
    const now = (input.now ?? new Date()).getTime();
    if (Number.isFinite(last) && now - last < INTERVENTION_OBJECT_COOLDOWN_DAYS * 86_400_000) {
      return { ok: false, reason: 'objet_sous_delai' };
    }
  }
  return { ok: true, claimKey: `intervention:${input.actFingerprint}` };
}
