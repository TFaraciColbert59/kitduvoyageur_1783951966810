/**
 * T23 — amélioration de kit éprouvée (contrôle pur) :
 *   (a) aucun problème terrain → refus ;
 *   (b) diff pertinent : problème signalé résolu dans une version postérieure ;
 *   (c) retrait d'un élément vital → refus ;
 *   (d) version inverse / historique insuffisant → refus ;
 *   (e) payloads illisibles → refus fail-closed ;
 *   (f) auto-fork → refus, avant toute autre règle.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateKitImprovement,
  extractVersionItems,
} from '@/features/progression/server/kitImprovementProof';

function payload(items: Array<{ item_key: string; is_vital?: boolean }>) {
  return { items };
}

const HISTORY_RESOLVED = [
  {
    id: 'v1',
    created_at: '2026-10-01T10:00:00.000Z',
    payload: payload([
      { item_key: 'tente', is_vital: true },
      { item_key: 'rechaud', is_vital: false },
    ]),
  },
  {
    id: 'v2',
    created_at: '2026-10-08T10:00:00.000Z',
    payload: payload([{ item_key: 'tente', is_vital: true }, { item_key: 'rechaud-neuf' }]),
  },
];

describe('évaluation d’une amélioration de kit', () => {
  it('(a) sans problème terrain signalé → refus', () => {
    expect(
      evaluateKitImprovement({ history: HISTORY_RESOLVED, problemKeys: [], autoFork: false })
    ).toEqual({ ok: false, reason: 'aucun_probleme_terrain' });
  });

  it('(b) problème résolu dans une version postérieure → preuve acceptée', () => {
    const result = evaluateKitImprovement({
      history: HISTORY_RESOLVED,
      problemKeys: ['rechaud', 'jamais-signale'],
      autoFork: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resolvedKeys).toEqual(['rechaud']);
      expect(result.newVersionId).toBe('v2');
    }
  });

  it('(c) retrait d’un élément vital → refus (sécurité conservée)', () => {
    const removedVital = [
      HISTORY_RESOLVED[0],
      {
        id: 'v2',
        created_at: '2026-10-08T10:00:00.000Z',
        payload: payload([{ item_key: 'rechaud-neuf' }]),
      },
    ];
    expect(
      evaluateKitImprovement({ history: removedVital, problemKeys: ['tente'], autoFork: false })
    ).toEqual({ ok: false, reason: 'essentiel_retire' });
  });

  it('(d) historique insuffisant et version inverse → refus', () => {
    expect(
      evaluateKitImprovement({
        history: [HISTORY_RESOLVED[0]],
        problemKeys: ['rechaud'],
        autoFork: false,
      })
    ).toEqual({ ok: false, reason: 'version_anterieure' });

    // Ordre stocké à l'envers : le tri par date rétablit v1 → v2 ; ici on
    // simule une vraie régression (l'item revient dans la version récente).
    const regression = [
      { id: 'v2', created_at: '2026-10-08T10:00:00.000Z', payload: payload([{ item_key: 'tente', is_vital: true }]) },
      {
        id: 'v3',
        created_at: '2026-10-09T10:00:00.000Z',
        payload: payload([{ item_key: 'tente', is_vital: true }, { item_key: 'rechaud' }]),
      },
    ];
    expect(
      evaluateKitImprovement({ history: regression, problemKeys: ['rechaud'], autoFork: false })
    ).toEqual({ ok: false, reason: 'aucune_amelioration' });
  });

  it('(e) payload illisible → refus fail-closed', () => {
    const broken = [
      { id: 'v1', created_at: '2026-10-01T10:00:00.000Z', payload: 'oops' },
      { id: 'v2', created_at: '2026-10-08T10:00:00.000Z', payload: payload([{ item_key: 'tente' }]) },
    ];
    expect(
      evaluateKitImprovement({ history: broken, problemKeys: ['tente'], autoFork: false })
    ).toEqual({ ok: false, reason: 'versions_illisibles' });
    expect(extractVersionItems('oops')).toBeNull();
    expect(extractVersionItems({ items: [] })).toBeNull();
  });

  it('(f) auto-fork → refus prioritaire', () => {
    expect(
      evaluateKitImprovement({ history: HISTORY_RESOLVED, problemKeys: [], autoFork: true })
    ).toEqual({ ok: false, reason: 'auto_fork' });
  });
});
