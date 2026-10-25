/** T33 — intervention matériel : alerte seule refusée, acte unique, délai objet. */
import { describe, it, expect } from 'vitest';
import { evaluateIntervention } from '@/features/progression/server/interventionProof';

const NOW = new Date('2026-10-11T12:00:00Z');
const BASE = {
  kind: 'maintenance' as const,
  actorId: 'u1',
  confirmerId: 'u2',
  interventionPerformed: true,
  actFingerprint: 'act-1',
  now: NOW,
};

describe('intervention matériel', () => {
  it('entretien confirmé par un tiers → claim unique', () => {
    expect(evaluateIntervention(BASE)).toEqual({ ok: true, claimKey: 'intervention:act-1' });
  });

  it('refus : alerte simplement résolue, auto-confirmation, acte dupliqué, objet sous 90 j', () => {
    expect(evaluateIntervention({ ...BASE, interventionPerformed: false })).toEqual({ ok: false, reason: 'alerte_seule' });
    expect(evaluateIntervention({ ...BASE, confirmerId: 'u1' })).toEqual({ ok: false, reason: 'auto_confirmation' });
    expect(evaluateIntervention({ ...BASE, existingActFingerprints: ['act-1'] })).toEqual({ ok: false, reason: 'acte_duplique' });
    expect(evaluateIntervention({ ...BASE, lastObjectCreditAt: '2026-09-15T00:00:00Z' })).toEqual({ ok: false, reason: 'objet_sous_delai' });
  });

  it('entretien et réparation du même acte partagent l’empreinte → pas de cumul', () => {
    expect(
      evaluateIntervention({ ...BASE, kind: 'repair', existingActFingerprints: ['act-1'] })
    ).toEqual({ ok: false, reason: 'acte_duplique' });
  });
});
