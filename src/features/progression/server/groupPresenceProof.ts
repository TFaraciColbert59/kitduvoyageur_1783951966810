import 'server-only';

/**
 * T30 — Tenue d'une sortie collective : présence vérifiée consentie,
 * organisateur désigné, aucun gain pour une simple inscription ou un
 * auto-check-in ; l'activité déjà payée ne se double pas comme participation.
 */

export type GroupPresenceRefusal =
  | 'organisateur_absent'
  | 'inscription_seule'
  | 'participants_insuffisants'
  | 'presence_non_verifiee'
  | 'deja_payee';

export interface GroupPresenceInput {
  organizerId: string | null;
  eventHeld: boolean;
  cancelled: boolean;
  /** Participants (hors organisateur) avec présence VÉRIFIÉE et consentie. */
  verifiedParticipantIds: readonly string[];
  /** Seule une inscription/auto-check-in existe : aucune vérification. */
  signupOnly: boolean;
  /** Le demandeur a déjà été payé pour l'activité sous-jacente. */
  alreadyPaidAsActivity: boolean;
}

export function evaluateGroupPresence(
  input: GroupPresenceInput
): { ok: true } | { ok: false; reason: GroupPresenceRefusal } {
  if (input.cancelled || !input.eventHeld) return { ok: false, reason: 'organisateur_absent' };
  if (!input.organizerId) return { ok: false, reason: 'organisateur_absent' };
  if (input.signupOnly) return { ok: false, reason: 'inscription_seule' };

  const distinct = new Set(
    input.verifiedParticipantIds.filter((id) => id && id !== input.organizerId)
  );
  if (distinct.size < 3) return { ok: false, reason: 'participants_insuffisants' };
  if (input.alreadyPaidAsActivity) return { ok: false, reason: 'deja_payee' };
  return { ok: true };
}

/** Participation d'un membre : présence vérifiée, jamais un simple check-in. */
export function evaluateGroupParticipation(input: {
  memberVerified: boolean;
  signupOnly: boolean;
  alreadyPaidAsActivity: boolean;
}): { ok: true } | { ok: false; reason: GroupPresenceRefusal } {
  if (input.signupOnly || !input.memberVerified) return { ok: false, reason: 'presence_non_verifiee' };
  if (input.alreadyPaidAsActivity) return { ok: false, reason: 'deja_payee' };
  return { ok: true };
}
