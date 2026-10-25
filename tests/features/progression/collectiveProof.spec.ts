/** T34 — collectif encadré : accompagnement consenti (paire 1/mois), environnement, observation IA refusée seule. */
import { describe, it, expect } from 'vitest';
import { evaluateCollectiveAction } from '@/features/progression/server/collectiveProof';

const NOW = new Date('2026-10-11T12:00:00Z');

describe('accompagnement', () => {
  it('consentement + double confirmation → claim paire', () => {
    const result = evaluateCollectiveAction({
      kind: 'mentoring',
      mentorId: 'm1',
      menteeId: 'e1',
      bothConsented: true,
      mentorConfirmed: true,
      menteeConfirmed: true,
      pairFingerprint: 'pair-1',
      now: NOW,
    });
    expect(result).toEqual({ ok: true, claimKey: 'mentoring:pair-1' });
  });

  it('refus : consentement manquant, parties confondues, paire trop fréquente', () => {
    const base = {
      kind: 'mentoring' as const,
      mentorId: 'm1',
      menteeId: 'e1',
      bothConsented: true,
      mentorConfirmed: true,
      menteeConfirmed: true,
      pairFingerprint: 'pair-1',
      now: NOW,
    };
    expect(evaluateCollectiveAction({ ...base, bothConsented: false })).toEqual({ ok: false, reason: 'consentement_manquant' });
    expect(evaluateCollectiveAction({ ...base, menteeId: 'm1' })).toEqual({ ok: false, reason: 'parties_non_distinctes' });
    expect(evaluateCollectiveAction({ ...base, lastPairCreditAt: '2026-10-05T00:00:00Z' })).toEqual({ ok: false, reason: 'paire_trop_frequente' });
  });
});

describe('environnement et observation', () => {
  it('action encadrée sans lieu fragile → claim ; organisateur absent refusé', () => {
    expect(
      evaluateCollectiveAction({
        kind: 'environment',
        organizerId: 'org-1',
        externalOrganizerConfirmed: true,
        containsSensitiveLocation: false,
        actionFingerprint: 'env-1',
      })
    ).toEqual({ ok: true, claimKey: 'environment:env-1' });

    expect(
      evaluateCollectiveAction({
        kind: 'environment',
        organizerId: null,
        externalOrganizerConfirmed: false,
        containsSensitiveLocation: false,
        actionFingerprint: 'env-1',
      })
    ).toEqual({ ok: false, reason: 'organisateur_absent' });

    expect(
      evaluateCollectiveAction({
        kind: 'environment',
        organizerId: 'org-1',
        externalOrganizerConfirmed: true,
        containsSensitiveLocation: true,
        actionFingerprint: 'env-1',
      })
    ).toEqual({ ok: false, reason: 'lieu_fragile_expose' });
  });

  it('observation : IA seule refusée, validation éditoriale exigée', () => {
    expect(
      evaluateCollectiveAction({
        kind: 'observation',
        editoriallyValidated: true,
        aiOnly: true,
        observationFingerprint: 'obs-1',
      })
    ).toEqual({ ok: false, reason: 'ia_seule_non_validee' });

    expect(
      evaluateCollectiveAction({
        kind: 'observation',
        editoriallyValidated: false,
        aiOnly: false,
        observationFingerprint: 'obs-1',
      })
    ).toEqual({ ok: false, reason: 'aucune_validation_editoriale' });

    expect(
      evaluateCollectiveAction({
        kind: 'observation',
        editoriallyValidated: true,
        aiOnly: false,
        observationFingerprint: 'obs-1',
      })
    ).toEqual({ ok: true, claimKey: 'observation:obs-1' });
  });
});
