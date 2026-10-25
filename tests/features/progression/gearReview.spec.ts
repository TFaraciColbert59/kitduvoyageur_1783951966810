/** T29 — avis matériel : usage terrain, possédé/emprunté à égalité, pas de recopie du débrief. */
import { describe, it, expect } from 'vitest';
import { evaluateGearReview } from '@/features/progression/server/gearReviewProof';

const BASE = {
  usedOnField: true,
  ownership: 'owned' as const,
  contentFingerprint: 'rev-1',
  sameContentAsCreditedDebrief: false,
  contentLength: 200,
};

describe('preuve d’avis matériel', () => {
  it('possédé et emprunté sont strictement équivalents', () => {
    expect(evaluateGearReview(BASE)).toEqual({ ok: true, claimKey: 'gear_review:rev-1' });
    expect(evaluateGearReview({ ...BASE, ownership: 'borrowed' })).toEqual({ ok: true, claimKey: 'gear_review:rev-1' });
  });

  it('refus : usage non prouvé, recopie du débrief, contenu insuffisant, doublon', () => {
    expect(evaluateGearReview({ ...BASE, usedOnField: false })).toEqual({ ok: false, reason: 'usage_non_prouve' });
    expect(evaluateGearReview({ ...BASE, sameContentAsCreditedDebrief: true })).toEqual({ ok: false, reason: 'debrief_deja_credite' });
    expect(evaluateGearReview({ ...BASE, contentLength: 10 })).toEqual({ ok: false, reason: 'contenu_insuffisant' });
    expect(evaluateGearReview({ ...BASE, existingFingerprints: ['rev-1'] })).toEqual({ ok: false, reason: 'deja_credite' });
  });
});
