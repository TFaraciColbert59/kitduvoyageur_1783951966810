import { describe, it, expect } from 'vitest';
import {
  bucketChecklist,
  checklistBucket,
  checklistProgress,
  nextChecklistItem,
} from '@/features/hub/mobile/checklistEngine';

interface Item {
  id: string;
  done: boolean;
  due_offset_days: number;
  position: number;
}

function item(id: string, due: number, done = false, position = 0): Item {
  return { id, due_offset_days: due, done, position };
}

describe('checklist engine (mobile sortie)', () => {
  it('classe les échéances en j30 / j7 / j1 (mêmes bornes que la vue)', () => {
    expect(checklistBucket(30)).toBe('j30');
    expect(checklistBucket(14)).toBe('j7');
    expect(checklistBucket(8)).toBe('j7');
    expect(checklistBucket(7)).toBe('j1');
    expect(checklistBucket(0)).toBe('j1');
  });

  it('répartit les items dans les 3 groupes', () => {
    const buckets = bucketChecklist([item('a', 30), item('b', 14), item('c', 3), item('d', 7)]);
    expect(buckets.j30.map((i) => i.id)).toEqual(['a']);
    expect(buckets.j7.map((i) => i.id)).toEqual(['b']);
    expect(buckets.j1.map((i) => i.id)).toEqual(['c', 'd']);
  });

  it('progression : faits, total, pourcentage borné, restants', () => {
    const items = [item('a', 30, true), item('b', 14, true), item('c', 3), item('d', 7)];
    expect(checklistProgress(items)).toEqual({ done: 2, total: 4, pct: 50, remaining: 2 });
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, pct: 0, remaining: 0 });
    expect(checklistProgress([item('a', 30, true)])).toEqual({ done: 1, total: 1, pct: 100, remaining: 0 });
  });

  it('prochaine tâche = non faite la plus urgente (échéance puis position)', () => {
    const items = [item('loin', 30), item('proche', 3, false, 5), item('proche-bis', 3, false, 1), item('fait', 1, true)];
    expect(nextChecklistItem(items)?.id).toBe('proche-bis');
    expect(nextChecklistItem([item('fait', 1, true)])).toBeNull();
  });
});
