import { describe, it, expect } from 'vitest';
import {
  availableNoteDays,
  buildJournalStats,
  formatRelativeTime,
  notesForDay,
  sortJournalNotes,
} from '@/features/hub/mobile/journalEngine';

function note(id: string, createdAt: string, day: number | null = null, pinned = false) {
  return { id, day_number: day, is_pinned: pinned, created_at: createdAt, updated_at: createdAt };
}

const NOW = new Date('2026-09-10T12:00:00Z');

describe('journal engine (mobile sortie)', () => {
  it('statistiques : total, épinglées, jours couverts, progression', () => {
    const stats = buildJournalStats(
      [note('a', '2026-09-08T08:00:00Z', 1, true), note('b', '2026-09-09T08:00:00Z', 3)],
      5
    );
    expect(stats.total).toBe(2);
    expect(stats.pinned).toBe(1);
    expect(stats.daysTold).toBe(2);
    expect(stats.progressPct).toBe(40);
    expect(stats.lastCreatedAt).toBe('2026-09-09T08:00:00Z');
  });

  it('statistiques vides : jamais NaN', () => {
    expect(buildJournalStats([], 0)).toEqual({
      total: 0,
      pinned: 0,
      daysTold: 0,
      progressPct: 0,
      lastCreatedAt: null,
    });
  });

  it('trie épinglées d’abord puis plus récentes', () => {
    const sorted = sortJournalNotes([
      note('old', '2026-09-01T08:00:00Z'),
      note('recent', '2026-09-09T08:00:00Z'),
      note('pin', '2026-09-02T08:00:00Z', 2, true),
    ]);
    expect(sorted.map((n) => n.id)).toEqual(['pin', 'recent', 'old']);
  });

  it('jours disponibles triés et filtre par jour', () => {
    const notes = [note('a', '2026-09-01T08:00:00Z', 3), note('b', '2026-09-02T08:00:00Z', 1), note('c', '2026-09-03T08:00:00Z')];
    expect(availableNoteDays(notes)).toEqual([1, 3]);
    expect(notesForDay(notes, 3).map((n) => n.id)).toEqual(['a']);
    expect(notesForDay(notes, 2)).toEqual([]);
  });

  it('temps relatif compact', () => {
    expect(formatRelativeTime('2026-09-10T11:30:00Z', NOW)).toMatch(/30 minutes/);
    expect(formatRelativeTime('2026-09-10T09:00:00Z', NOW)).toMatch(/3 heures/);
    expect(formatRelativeTime('2026-09-07T12:00:00Z', NOW)).toMatch(/3 jours/);
  });
});
