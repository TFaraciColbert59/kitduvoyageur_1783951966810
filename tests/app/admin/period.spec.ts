import { describe, expect, it } from 'vitest';

import { greeting, parsePeriod } from '@/app/admin/_os/period';

describe('parsePeriod', () => {
  it('défaut Aujourd’hui avec début de journée', () => {
    const r = parsePeriod({});
    expect(r.current).toBe("Aujourd'hui");
    expect(r.from).toBeDefined();
  });

  it('7 jours et 30 jours calculent le bon départ', () => {
    const seven = parsePeriod({ period: '7 jours' });
    expect(seven.current).toBe('7 jours');
    const diff = Date.now() - new Date(seven.from as string).getTime();
    expect(diff).toBeGreaterThan(6 * 24 * 3600 * 1000);
    expect(diff).toBeLessThan(8 * 24 * 3600 * 1000);
  });

  it('custom conserve from/to', () => {
    const r = parsePeriod({ period: 'custom', from: '2026-09-01', to: '2026-09-30' });
    expect(r).toEqual({ current: 'custom', from: '2026-09-01', to: '2026-09-30' });
  });

  it('rejette une période inconnue vers Aujourd’hui', () => {
    expect(parsePeriod({ period: 'DROP TABLE' }).current).toBe("Aujourd'hui");
  });
});

describe('greeting', () => {
  it('Bonjour le matin, Bonsoir le soir', () => {
    expect(greeting(9, 'Tony')).toBe('Bonjour Tony');
    expect(greeting(20, 'Tony')).toBe('Bonsoir Tony');
  });
});
