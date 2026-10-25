/**
 * T21 — adaptateurs d'activité :
 *   (a) une activité multitag résout UN SEUL adaptateur (priorité du registre) ;
 *   (b) clé d'évidence et claim communs : un seul gain par session ;
 *   (c) adaptateurs fermés : critères publiés, aucun gain, refus explicite ;
 *   (d) preuve serveur de la randonnée : durée/paliers/mouvement identiques ;
 *   (e) objectif adapté : plancher sans durée, jamais un diagnostic.
 */
import { describe, it, expect } from 'vitest';
import {
  ACTIVITY_CLAIM_GROUP,
  activityEvidenceKey,
  evaluateActivityProof,
  getActivityAdapter,
  isAdapterAvailable,
  listActivityAdapters,
  resolveActivityAdapter,
} from '@/features/progression/domain/activityAdapters';

describe('adaptateurs d’activité', () => {
  it('(a) multitag → un seul adaptateur (priorité registre)', () => {
    const adapter = resolveActivityAdapter(['urban', 'bike', 'hike']);
    expect(adapter?.id).toBe('randonnee');
    expect(resolveActivityAdapter(['velo', 'VTTE '])?.id).toBe('velo');
    expect(resolveActivityAdapter(['inconnu'])).toBeNull();
    expect(resolveActivityAdapter([])).toBeNull();
  });

  it('(b) même clé/claim commune pour deux adaptateurs d’une même session', () => {
    const keyA = activityEvidenceKey('session-42');
    const keyB = activityEvidenceKey('session-42');
    expect(keyA).toBe(keyB);
    expect(keyA).toBe('activity:session-42');
    expect(ACTIVITY_CLAIM_GROUP).toBe('activity_completed');
  });

  it('(c) fermés : critères publiés, aucun gain, refus explicite', () => {
    for (const id of ['velo', 'urbain', 'accessible'] as const) {
      const adapter = getActivityAdapter(id);
      expect(adapter?.status).toBe('closed');
      expect((adapter?.criteria ?? '').length).toBeGreaterThan(30);
      expect((adapter?.closedReason ?? '').length).toBeGreaterThan(20);
      expect(isAdapterAvailable(id)).toBe(false);
      expect(evaluateActivityProof(id, { activeMinutes: 240, plausibleMovement: 1, adaptedObjective: false })).toEqual({
        ok: false,
        reason: 'adaptateur_ferme',
      });
    }
  });

  it('(d) randonnée : nominal, mouvement non plausible et durée insuffisante', () => {
    expect(
      evaluateActivityProof('randonnee', { activeMinutes: 25, plausibleMovement: 0.9, adaptedObjective: false })
    ).toEqual({ ok: true });
    expect(
      evaluateActivityProof('randonnee', { activeMinutes: 90, plausibleMovement: 0.2, adaptedObjective: false })
    ).toEqual({ ok: false, reason: 'mouvement_non_plausible' });
    expect(
      evaluateActivityProof('randonnee', { activeMinutes: 10, plausibleMovement: 0.9, adaptedObjective: false })
    ).toEqual({ ok: false, reason: 'duree_insuffisante' });
  });

  it('(e) objectif adapté : plancher accepté sans 20 minutes, refusé si non permis', () => {
    expect(
      evaluateActivityProof('randonnee', { activeMinutes: 5, plausibleMovement: 0.9, adaptedObjective: true })
    ).toEqual({ ok: true });
    expect(evaluateActivityProof('inconnu' as never, { activeMinutes: 30, plausibleMovement: 1, adaptedObjective: false })).toEqual({
      ok: false,
      reason: 'adaptateur_inconnu',
    });
  });

  it('(f) registre : la randonnée est le seul adaptateur actif', () => {
    const adapters = listActivityAdapters();
    expect(adapters.filter((adapter) => adapter.status === 'active').map((adapter) => adapter.id)).toEqual([
      'randonnee',
    ]);
  });
});
