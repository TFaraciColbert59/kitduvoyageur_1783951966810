/** T30 — sortie collective : inscription seule refusée, ≥3 participants vérifiés, pas de double. */
import { describe, it, expect } from 'vitest';
import {
  evaluateGroupParticipation,
  evaluateGroupPresence,
} from '@/features/progression/server/groupPresenceProof';

const BASE = {
  organizerId: 'org-1',
  eventHeld: true,
  cancelled: false,
  verifiedParticipantIds: ['p1', 'p2', 'p3'],
  signupOnly: false,
  alreadyPaidAsActivity: false,
};

describe('tenue d’une sortie collective', () => {
  it('organisateur + 3 participants vérifiés → ok', () => {
    expect(evaluateGroupPresence(BASE)).toEqual({ ok: true });
  });

  it('refus : annulée, inscription seule, moins de 3, double activité', () => {
    expect(evaluateGroupPresence({ ...BASE, cancelled: true })).toEqual({ ok: false, reason: 'organisateur_absent' });
    expect(evaluateGroupPresence({ ...BASE, signupOnly: true })).toEqual({ ok: false, reason: 'inscription_seule' });
    expect(evaluateGroupPresence({ ...BASE, verifiedParticipantIds: ['p1', 'p2'] })).toEqual({ ok: false, reason: 'participants_insuffisants' });
    expect(evaluateGroupPresence({ ...BASE, alreadyPaidAsActivity: true })).toEqual({ ok: false, reason: 'deja_payee' });
  });

  it('participant : présence vérifiée exigée, double activité exclue', () => {
    expect(evaluateGroupParticipation({ memberVerified: true, signupOnly: false, alreadyPaidAsActivity: false })).toEqual({ ok: true });
    expect(evaluateGroupParticipation({ memberVerified: false, signupOnly: true, alreadyPaidAsActivity: false })).toEqual({ ok: false, reason: 'presence_non_verifiee' });
    expect(evaluateGroupParticipation({ memberVerified: true, signupOnly: false, alreadyPaidAsActivity: true })).toEqual({ ok: false, reason: 'deja_payee' });
  });
});
