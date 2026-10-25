import { describe, it, expect } from 'vitest';
import { formatEphemeralCountdown } from '@/features/tribu/lib/ephemeral';

const NOW = new Date('2026-09-13T12:00:00Z').getTime();
const HOUR = 60 * 60 * 1000;

describe('formatEphemeralCountdown', () => {
  it('retourne null sans date valide', () => {
    expect(formatEphemeralCountdown(null, NOW)).toBeNull();
    expect(formatEphemeralCountdown(undefined, NOW)).toBeNull();
    expect(formatEphemeralCountdown('pas-une-date', NOW)).toBeNull();
  });

  it('signale une dissolution imminente si dépassée', () => {
    expect(formatEphemeralCountdown(new Date(NOW - HOUR).toISOString(), NOW)).toBe(
      'Dissolution imminente'
    );
  });

  it('affiche les heures restantes sous 24 h', () => {
    expect(formatEphemeralCountdown(new Date(NOW + 5 * HOUR).toISOString(), NOW)).toBe(
      'Dissoute dans 5 h'
    );
    expect(formatEphemeralCountdown(new Date(NOW + 30 * 60 * 1000).toISOString(), NOW)).toBe(
      'Dissoute dans moins d’une heure'
    );
  });

  it('affiche les jours restants au-delà', () => {
    expect(formatEphemeralCountdown(new Date(NOW + 26 * HOUR).toISOString(), NOW)).toBe(
      'Dissoute dans 1 jour'
    );
    expect(formatEphemeralCountdown(new Date(NOW + 6 * 24 * HOUR).toISOString(), NOW)).toBe(
      'Dissoute dans 6 jours'
    );
  });
});
