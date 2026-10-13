import 'server-only';

/**
 * T34 — Actions collectives encadrées : accompagnement et environnement.
 *
 *   • accompagnement : consentement des deux parties, confirmations par des
 *     parties DISTINCTES, fréquence par paire limitée (1/mois) ;
 *   • action environnementale : tenue et encadrée (organisateur indépendant),
 *     sans exposer un lieu fragile ;
 *   • observation naturaliste : validation éditoriale/partenaire exigée — une
 *     prédiction IA seule n'est JAMAIS une contribution validée.
 */

export type CollectiveRefusal =
  | 'consentement_manquant'
  | 'parties_non_distinctes'
  | 'paire_trop_frequente'
  | 'organisateur_absent'
  | 'lieu_fragile_expose'
  | 'ia_seule_non_validee'
  | 'aucune_validation_editoriale'
  | 'deja_credite';

export interface MentoringInput {
  kind: 'mentoring';
  mentorId: string;
  menteeId: string;
  bothConsented: boolean;
  mentorConfirmed: boolean;
  menteeConfirmed: boolean;
  lastPairCreditAt?: string | null;
  now?: Date;
  pairFingerprint: string;
  existingFingerprints?: readonly string[];
}

export interface EnvironmentInput {
  kind: 'environment';
  organizerId: string | null;
  externalOrganizerConfirmed: boolean;
  containsSensitiveLocation: boolean;
  actionFingerprint: string;
  existingFingerprints?: readonly string[];
}

export interface ObservationInput {
  kind: 'observation';
  editoriallyValidated: boolean;
  aiOnly: boolean;
  observationFingerprint: string;
  existingFingerprints?: readonly string[];
}

export type CollectiveInput = MentoringInput | EnvironmentInput | ObservationInput;

export const MENTORING_PAIR_COOLDOWN_DAYS = 30;

export function evaluateCollectiveAction(
  input: CollectiveInput
): { ok: true; claimKey: string } | { ok: false; reason: CollectiveRefusal } {
  if (input.kind === 'mentoring') {
    if (!input.bothConsented) return { ok: false, reason: 'consentement_manquant' };
    if (!input.mentorId || input.mentorId === input.menteeId) {
      return { ok: false, reason: 'parties_non_distinctes' };
    }
    if (!input.mentorConfirmed || !input.menteeConfirmed) {
      return { ok: false, reason: 'consentement_manquant' };
    }
    if ((input.existingFingerprints ?? []).includes(input.pairFingerprint)) {
      return { ok: false, reason: 'deja_credite' };
    }
    if (input.lastPairCreditAt) {
      const last = Date.parse(input.lastPairCreditAt);
      const now = (input.now ?? new Date()).getTime();
      if (Number.isFinite(last) && now - last < MENTORING_PAIR_COOLDOWN_DAYS * 86_400_000) {
        return { ok: false, reason: 'paire_trop_frequente' };
      }
    }
    return { ok: true, claimKey: `mentoring:${input.pairFingerprint}` };
  }

  if (input.kind === 'environment') {
    if (!input.organizerId) return { ok: false, reason: 'organisateur_absent' };
    if (!input.externalOrganizerConfirmed) return { ok: false, reason: 'organisateur_absent' };
    if (input.containsSensitiveLocation) return { ok: false, reason: 'lieu_fragile_expose' };
    if ((input.existingFingerprints ?? []).includes(input.actionFingerprint)) {
      return { ok: false, reason: 'deja_credite' };
    }
    return { ok: true, claimKey: `environment:${input.actionFingerprint}` };
  }

  // observation naturaliste
  if (input.aiOnly) return { ok: false, reason: 'ia_seule_non_validee' };
  if (!input.editoriallyValidated) return { ok: false, reason: 'aucune_validation_editoriale' };
  if ((input.existingFingerprints ?? []).includes(input.observationFingerprint)) {
    return { ok: false, reason: 'deja_credite' };
  }
  return { ok: true, claimKey: `observation:${input.observationFingerprint}` };
}
