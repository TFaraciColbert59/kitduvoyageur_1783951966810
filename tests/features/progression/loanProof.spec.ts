/** T32 — prêt réel : ≥24 h, deux confirmations, un gain par rôle, délai objet/paire 90 j. */
import { describe, it, expect } from 'vitest';
import { evaluateLoan } from '@/features/progression/server/loanProof';

const NOW = new Date('2026-10-11T12:00:00Z');
const BASE = {
  lenderId: 'l1',
  borrowerId: 'b1',
  startedAt: '2026-10-05T08:00:00Z',
  returnedAt: '2026-10-07T08:00:00Z',
  lenderConfirmedReturn: true,
  borrowerConfirmedReturn: true,
  role: 'borrower' as const,
  roleAlreadyCreditedForLoan: false,
  now: NOW,
};

describe('cycle de prêt', () => {
  it('prêt de 48 h, deux confirmations → ok pour chaque rôle', () => {
    expect(evaluateLoan(BASE)).toEqual({ ok: true });
    expect(evaluateLoan({ ...BASE, role: 'lender' })).toEqual({ ok: true });
  });

  it('refus : prêt à soi, < 24 h, retour unilatéral, double retry par rôle', () => {
    expect(evaluateLoan({ ...BASE, borrowerId: 'l1' })).toEqual({ ok: false, reason: 'pret_a_soi' });
    expect(evaluateLoan({ ...BASE, returnedAt: '2026-10-05T20:00:00Z' })).toEqual({ ok: false, reason: 'duree_insuffisante' });
    expect(evaluateLoan({ ...BASE, borrowerConfirmedReturn: false })).toEqual({ ok: false, reason: 'retour_non_confirme' });
    expect(evaluateLoan({ ...BASE, roleAlreadyCreditedForLoan: true })).toEqual({ ok: false, reason: 'role_deja_credite' });
  });

  it('boucle de prêts : paire/objet sous 90 jours → refus', () => {
    expect(
      evaluateLoan({ ...BASE, lastObjectOrPairCreditAt: '2026-09-01T00:00:00Z' })
    ).toEqual({ ok: false, reason: 'objet_ou_paire_sous_delai' });
    expect(
      evaluateLoan({ ...BASE, lastObjectOrPairCreditAt: '2026-06-01T00:00:00Z' })
    ).toEqual({ ok: true });
  });
});
