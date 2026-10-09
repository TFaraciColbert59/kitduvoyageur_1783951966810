import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRAVELLER_ZONE,
  browserTimeZone,
  browserToday,
  localToday,
  safeTimeZone,
  travellerToday,
} from '../engine/zone';

/** 9 oct. 13 h UTC : 10 oct. 2 h à Auckland, 9 oct. 6 h à Los Angeles, 9 oct. 15 h à Paris. */
const AT = new Date('2026-10-09T13:00:00Z');

/** Le fuseau du processus, le temps d'un appel (Node relit `TZ` à chaque changement). */
function withTz<T>(tz: string, fn: () => T): T {
  const before = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

describe('« aujourd’hui » selon le fuseau', () => {
  it('localToday : la date du calendrier dans le fuseau donné', () => {
    expect(localToday('Pacific/Auckland', AT)).toBe('2026-10-10');
    expect(localToday('America/Los_Angeles', AT)).toBe('2026-10-09');
  });

  it('safeTimeZone : un fuseau IANA réel, sinon null', () => {
    expect(safeTimeZone('Pacific/Auckland')).toBe('Pacific/Auckland');
    expect(safeTimeZone('America/Los_Angeles')).toBe('America/Los_Angeles');
    expect(safeTimeZone('Mars/Olympus')).toBeNull();
    expect(safeTimeZone('')).toBeNull();
    expect(safeTimeZone(42)).toBeNull();
    expect(safeTimeZone(undefined)).toBeNull();
    expect(safeTimeZone(`Europe/${'x'.repeat(60)}`)).toBeNull();
  });

  it('travellerToday : le fuseau envoyé par le navigateur, Paris seulement sans lui', () => {
    expect(travellerToday('Pacific/Auckland', AT)).toBe('2026-10-10');
    expect(travellerToday('America/Los_Angeles', AT)).toBe('2026-10-09');
    // 22 h 30 UTC : déjà le 10 à Paris, encore le 9 à Los Angeles.
    const late = new Date('2026-10-09T22:30:00Z');
    expect(DEFAULT_TRAVELLER_ZONE).toBe('Europe/Paris');
    expect(travellerToday(undefined, late)).toBe('2026-10-10');
    expect(travellerToday('Mars/Olympus', late)).toBe('2026-10-10');
    expect(travellerToday('America/Los_Angeles', late)).toBe('2026-10-09');
  });

  it('browserToday et browserTimeZone : la date et le fuseau du navigateur, pas ceux d’UTC', () => {
    expect(withTz('Pacific/Auckland', () => browserToday(AT))).toBe('2026-10-10');
    expect(withTz('America/Los_Angeles', () => browserToday(AT))).toBe('2026-10-09');
    expect(withTz('Pacific/Auckland', () => browserTimeZone())).toBe('Pacific/Auckland');
  });
});
