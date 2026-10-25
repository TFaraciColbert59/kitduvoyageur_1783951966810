import { describe, it, expect } from 'vitest';
import {
  buildGroupeBalances,
  buildGroupeCriticalPath,
  computeGroupeReadiness,
  type GroupeExpenseInfo,
  type GroupeMemberInfo,
  type GroupeTaskInfo,
} from '@/features/hub/mobile/groupeEngine';

const TODAY = '2026-09-10';

function member(userId: string, name: string, status: 'active' | 'pending' = 'active'): GroupeMemberInfo {
  return { userId, name, status };
}

function task(overrides: Partial<GroupeTaskInfo> & { id: string; title: string }): GroupeTaskInfo {
  return { completed: false, dueDate: null, ...overrides };
}

function expense(overrides: Partial<GroupeExpenseInfo> & { id: string; amount: number }): GroupeExpenseInfo {
  return { title: overrides.id, paidBy: null, splitBetween: [], settled: false, ...overrides };
}

describe('groupe engine (mobile)', () => {
  describe('computeGroupeReadiness', () => {
    it('groupe vide → seule la complétion des invitations compte', () => {
      const readiness = computeGroupeReadiness({
        tasks: [],
        kit: [],
        expenses: [],
        members: [member('u1', 'Ana')],
      });

      expect(readiness.pct).toBe(15);
      expect(readiness.factors).toEqual({ tasks: 0, kit: 0, members: 100, budget: 0 });
    });

    it('pondère tâches (40), sac (20), membres (15) et budget (25)', () => {
      const readiness = computeGroupeReadiness({
        tasks: [
          task({ id: 't1', title: 'Réserver refuge', completed: true }),
          task({ id: 't2', title: 'Acheter fuel', completed: true }),
          task({ id: 't3', title: 'Tracer l’itinéraire', completed: true }),
          task({ id: 't4', title: 'Checklist sécurité' }),
        ],
        kit: [
          { id: 'k1', assigned: true },
          { id: 'k2', assigned: false },
        ],
        expenses: [
          expense({ id: 'e1', amount: 60, settled: true }),
          expense({ id: 'e2', amount: 30 }),
        ],
        members: [member('u1', 'Ana'), member('u2', 'Bob'), member('u3', 'Chloé'), member('u4', 'Dan', 'pending')],
      });

      expect(readiness.pct).toBe(64);
      expect(readiness.factors).toEqual({ tasks: 75, kit: 50, members: 75, budget: 50 });
    });

    it('tout est prêt → 100', () => {
      const readiness = computeGroupeReadiness({
        tasks: [task({ id: 't1', title: 'Fait', completed: true })],
        kit: [{ id: 'k1', assigned: true }],
        expenses: [expense({ id: 'e1', amount: 40, settled: true })],
        members: [member('u1', 'Ana'), member('u2', 'Bob')],
      });

      expect(readiness.pct).toBe(100);
    });
  });

  describe('buildGroupeCriticalPath', () => {
    it('exclut les tâches terminées et trie par échéance, sans date en dernier', () => {
      const path = buildGroupeCriticalPath(
        [
          task({ id: 't2', title: 'Choisir le train', dueDate: '2026-09-12' }),
          task({ id: 't3', title: 'Préparer les repas' }),
          task({ id: 't1', title: 'Réserver le refuge', dueDate: '2026-09-08' }),
          task({ id: 't4', title: 'Déjà fait', dueDate: '2026-09-01', completed: true }),
          task({ id: 't5', title: 'Boucle ce soir', dueDate: TODAY }),
        ],
        TODAY
      );

      expect(path.map((entry) => entry.id)).toEqual(['t1', 't5', 't2', 't3']);
      expect(path.map((entry) => entry.daysLeft)).toEqual([-2, 0, 2, null]);
      expect(path.map((entry) => entry.isOverdue)).toEqual([true, false, false, false]);
    });
  });

  describe('buildGroupeBalances', () => {
    const MEMBERS = [member('u-a', 'Alice'), member('u-b', 'Bob'), member('u-c', 'Chloé')];

    it('calcule payé/part/net sur les dépenses en attente et propose les règlements', () => {
      const view = buildGroupeBalances(
        [
          expense({ id: 'e1', amount: 60, paidBy: 'u-a', splitBetween: ['u-a', 'u-b', 'u-c'] }),
          expense({ id: 'e2', amount: 30, paidBy: 'u-b', splitBetween: [] }),
          expense({ id: 'e3', amount: 50, paidBy: 'u-c', splitBetween: ['u-a', 'u-c'], settled: true }),
        ],
        MEMBERS
      );

      const alice = view.rows.find((row) => row.userId === 'u-a');
      const bob = view.rows.find((row) => row.userId === 'u-b');
      const chloe = view.rows.find((row) => row.userId === 'u-c');

      expect(alice).toMatchObject({ paid: 60, share: 30, net: 30 });
      expect(bob).toMatchObject({ paid: 30, share: 30, net: 0 });
      expect(chloe).toMatchObject({ paid: 0, share: 30, net: -30 });

      expect(view.settlements).toEqual([
        { fromUserId: 'u-c', fromName: 'Chloé', toUserId: 'u-a', toName: 'Alice', amount: 30 },
      ]);
      expect(view.outstanding).toBe(30);
      expect(view.balanced).toBe(false);
    });

    it('dépense réglée → comptes équilibrés', () => {
      const view = buildGroupeBalances(
        [expense({ id: 'e1', amount: 40, paidBy: 'u-a', splitBetween: ['u-a', 'u-b'], settled: true })],
        MEMBERS
      );

      expect(view.settlements).toEqual([]);
      expect(view.outstanding).toBe(0);
      expect(view.balanced).toBe(true);
    });
  });
});
