import { describe, it, expect } from 'vitest';
import { formatSessionRemaining } from '@/features/tribu/lib/live';

const NOW = new Date('2026-09-13T12:00:00Z').getTime();
const MINUTE = 60 * 1000;

describe('formatSessionRemaining', () => {
  it('retourne null sans date valide', () => {
    expect(formatSessionRemaining(null, NOW)).toBeNull();
    expect(formatSessionRemaining('pas-une-date', NOW)).toBeNull();
  });

  it('signale une session terminée', () => {
    expect(formatSessionRemaining(new Date(NOW - MINUTE).toISOString(), NOW)).toBe(
      'Session terminée'
    );
  });

  it('minutes puis heures puis jours', () => {
    expect(formatSessionRemaining(new Date(NOW + 30 * MINUTE).toISOString(), NOW)).toBe(
      '30 min restantes'
    );
    expect(formatSessionRemaining(new Date(NOW + 90 * MINUTE).toISOString(), NOW)).toBe(
      '1 h 30 min restantes'
    );
    expect(formatSessionRemaining(new Date(NOW + 2 * 60 * MINUTE).toISOString(), NOW)).toBe(
      '2 h restantes'
    );
    expect(formatSessionRemaining(new Date(NOW + 26 * 60 * MINUTE).toISOString(), NOW)).toBe(
      '1 jour restant'
    );
    expect(formatSessionRemaining(new Date(NOW + 3 * 24 * 60 * MINUTE).toISOString(), NOW)).toBe(
      '3 jours restants'
    );
  });
});
