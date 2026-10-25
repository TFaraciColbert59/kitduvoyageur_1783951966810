import { describe, it, expect } from 'vitest';
import {
  isSafetyOverdue,
  nextSafetyCheckpoint,
  safetyProgress,
  safetyStatusLabel,
  sortSafetyCheckpoints,
} from '@/features/hub/mobile/safetyEngine';

type Status = 'pending' | 'checked' | 'missed' | 'alert_sent';

function cp(id: string, status: Status, scheduled_at: string, title = id) {
  return { id, status, scheduled_at, title };
}

const NOW = new Date('2026-09-10T12:00:00Z');

describe('safety engine (mobile sortie)', () => {
  it('libellés de statut', () => {
    expect(safetyStatusLabel('pending')).toBe('En attente');
    expect(safetyStatusLabel('checked')).toBe('Validé');
    expect(safetyStatusLabel('missed')).toBe('En retard');
    expect(safetyStatusLabel('alert_sent')).toBe('Alerte envoyée');
  });

  it('progression des pointages', () => {
    expect(
      safetyProgress([cp('a', 'checked', '2026-09-01T08:00:00Z'), cp('b', 'pending', '2026-09-11T08:00:00Z'), cp('c', 'missed', '2026-09-09T08:00:00Z')])
    ).toEqual({ checked: 1, total: 3, pct: 33 });
    expect(safetyProgress([])).toEqual({ checked: 0, total: 0, pct: 0 });
  });

  it('trie par criticité puis horaire', () => {
    const sorted = sortSafetyCheckpoints([
      cp('checked', 'checked', '2026-09-01T08:00:00Z'),
      cp('pending', 'pending', '2026-09-11T08:00:00Z'),
      cp('alert', 'alert_sent', '2026-09-09T08:00:00Z'),
      cp('missed', 'missed', '2026-09-08T08:00:00Z'),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(['alert', 'missed', 'pending', 'checked']);
  });

  it('prochain point = pending le plus proche ; rien si tout est pointé', () => {
    const next = nextSafetyCheckpoint(
      [cp('later', 'pending', '2026-09-12T08:00:00Z'), cp('soon', 'pending', '2026-09-11T08:00:00Z'), cp('done', 'checked', '2026-09-01T08:00:00Z')],
      NOW
    );
    expect(next?.id).toBe('soon');
    expect(nextSafetyCheckpoint([cp('done', 'checked', '2026-09-01T08:00:00Z')], NOW)).toBeNull();
  });

  it('retard = pending dont l’horaire est passé', () => {
    expect(isSafetyOverdue(cp('late', 'pending', '2026-09-10T08:00:00Z'), NOW)).toBe(true);
    expect(isSafetyOverdue(cp('soon', 'pending', '2026-09-10T18:00:00Z'), NOW)).toBe(false);
    expect(isSafetyOverdue(cp('done', 'checked', '2026-09-09T08:00:00Z'), NOW)).toBe(false);
  });
});
