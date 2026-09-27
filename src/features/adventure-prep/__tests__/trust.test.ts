import { describe, expect, it } from 'vitest';
import { A_VERIFIER, formatMinutes, moneyLabel, stateLabel } from '../engine/trust';
import { BOOKING_STATE_LABELS, PRICE_TO_CHECK } from '../types';

describe('libelles de confiance', () => {
  it('traduit chaque etat de reservation', () => {
    expect(stateLabel('propose')).toBe('Proposé');
    expect(stateLabel('a_reserver')).toBe('À réserver');
    expect(stateLabel('confirme')).toBe('Confirmé');
    expect(stateLabel('propose')).toBe(BOOKING_STATE_LABELS.propose);
  });

  it('affiche un prix connu, sinon « a verifier »', () => {
    expect(moneyLabel({ amount: 24.5, currency: 'EUR', state: 'confirme' })).toBe('24,50 €');
    expect(moneyLabel({ amount: 0, currency: 'EUR', state: 'propose' })).toBe('0 €');
    expect(moneyLabel(PRICE_TO_CHECK)).toBe(A_VERIFIER);
  });

  it('formate une duree en minutes ou en heures', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(90)).toBe('1 h 30');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(null)).toBe(A_VERIFIER);
  });

  it('utilise toujours la meme formulation pour une donnee absente', () => {
    expect(A_VERIFIER).toBe('À vérifier');
    expect(moneyLabel(PRICE_TO_CHECK)).toBe(A_VERIFIER);
    expect(formatMinutes(null)).toBe(A_VERIFIER);
  });
});
