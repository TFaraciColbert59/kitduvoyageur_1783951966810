/** T27 — contributions éditoriales : révision utile, licence, langue, IA brute, copie. */
import { describe, it, expect } from 'vitest';
import { evaluateEditorialProof } from '@/features/progression/server/editorialProof';

const BASE = {
  kind: 'guide' as const,
  license: 'cc_by_sa',
  contentFingerprint: 'fp-guide-v2',
  accepted: true,
};

describe('preuve éditoriale', () => {
  it('révision acceptée, licence permise → claim unique par empreinte', () => {
    expect(evaluateEditorialProof(BASE)).toEqual({ ok: true, claimKey: 'editorial:fp-guide-v2' });
  });

  it('refus : non acceptée, licence incompatible, IA brute, copie', () => {
    expect(evaluateEditorialProof({ ...BASE, accepted: false })).toEqual({ ok: false, reason: 'revision_non_acceptee' });
    expect(evaluateEditorialProof({ ...BASE, license: 'tous_droits_reserves' })).toEqual({ ok: false, reason: 'licence_incompatible' });
    expect(evaluateEditorialProof({ ...BASE, aiGeneratedUnreviewed: true })).toEqual({ ok: false, reason: 'ia_brute_non_relue' });
    expect(evaluateEditorialProof({ ...BASE, sourceFingerprints: ['fp-guide-v2'] })).toEqual({ ok: false, reason: 'copie_non_inedite' });
  });

  it('traduction : langue cible exigée ; répétition refusée', () => {
    expect(
      evaluateEditorialProof({ ...BASE, kind: 'translation', targetLanguage: null })
    ).toEqual({ ok: false, reason: 'langue_cible_absente' });
    expect(
      evaluateEditorialProof({ ...BASE, kind: 'translation', targetLanguage: 'en' })
    ).toEqual({ ok: true, claimKey: 'editorial:fp-guide-v2' });
    expect(
      evaluateEditorialProof({ ...BASE, alreadyCreditedFingerprints: ['fp-guide-v2'] })
    ).toEqual({ ok: false, reason: 'deja_creditee' });
  });
});
