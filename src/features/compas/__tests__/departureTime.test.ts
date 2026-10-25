import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Heure de départ du jour enregistrée (PLAN-100 5.5) : rangée dans `metadata.compas.departure_time`
 * sans toucher aux autres réglages, effaçable, refusée hors « HH:MM », et relue par l'écran
 * (`compasPlan`) sans jamais en inventer une.
 */
const h = vi.hoisted(() => ({
  meta: {} as Record<string, unknown>,
  denied: false,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('../server/compasServer', async (orig) => {
  const real = await orig<typeof import('../server/compasServer')>();
  return {
    ...real,
    requireEditor: vi.fn(async () =>
      h.denied
        ? { error: 'Seuls les organisateurs et éditeurs peuvent modifier le kit.' }
        : { supabase: {}, userId: 'u1', trip: { id: TRIP, metadata: h.meta } }
    ),
    updateTripMetadata: vi.fn(
      async (_s: unknown, _id: string, patch: (m: Record<string, unknown>) => Record<string, unknown>) => {
        h.meta = patch(h.meta);
        return { metadata: h.meta, error: null };
      }
    ),
  };
});

import { compasSetDepartureTimeAction } from '../server/compasActions';
import { updateTripMetadata } from '../server/compasServer';
import { compasPlan } from '../server/getCompasData';

const TRIP = '11111111-1111-4111-8111-111111111111';
const base = { tripId: TRIP, tripSlug: 'trek-3-vallees' };

beforeEach(() => {
  h.meta = { compas: { planned_days: 3, origin: { name: 'Lyon', lat: 45.76, lon: 4.83 } }, other: 1 };
  h.denied = false;
  vi.mocked(updateTripMetadata).mockClear();
});

describe('compasSetDepartureTimeAction', () => {
  it('range l’heure dite, sans toucher aux autres réglages', async () => {
    expect(await compasSetDepartureTimeAction({ ...base, time: '07:30' })).toEqual({ success: true });
    expect(h.meta).toEqual({
      compas: { planned_days: 3, origin: { name: 'Lyon', lat: 45.76, lon: 4.83 }, departure_time: '07:30' },
      other: 1,
    });
  });

  it('null efface l’heure, et seulement elle', async () => {
    await compasSetDepartureTimeAction({ ...base, time: '07:30' });
    expect(await compasSetDepartureTimeAction({ ...base, time: null })).toEqual({ success: true });
    expect(h.meta).toEqual({
      compas: { planned_days: 3, origin: { name: 'Lyon', lat: 45.76, lon: 4.83 } },
      other: 1,
    });
  });

  it.each(['24:00', '7:30', '07:60', '07:30:00', '', 'midi'])('refuse « %s » sans rien écrire', async (time) => {
    expect(await compasSetDepartureTimeAction({ ...base, time })).toEqual({
      success: false,
      error: 'Heure invalide',
    });
    expect(updateTripMetadata).not.toHaveBeenCalled();
  });

  it('accepte les bornes 00:00 et 23:59', async () => {
    expect((await compasSetDepartureTimeAction({ ...base, time: '00:00' })).success).toBe(true);
    expect((await compasSetDepartureTimeAction({ ...base, time: '23:59' })).success).toBe(true);
    expect((h.meta.compas as Record<string, unknown>).departure_time).toBe('23:59');
  });

  it('un lecteur est refusé, rien n’est écrit', async () => {
    h.denied = true;
    const res = await compasSetDepartureTimeAction({ ...base, time: '08:00' });
    expect(res.success).toBe(false);
    expect(updateTripMetadata).not.toHaveBeenCalled();
  });

  it('un voyage invalide est refusé', async () => {
    const res = await compasSetDepartureTimeAction({ tripId: 'x', tripSlug: 'trek', time: '08:00' });
    expect(res).toEqual({ success: false, error: 'Heure invalide' });
  });
});

describe('compasPlan relit l’heure de départ', () => {
  it('donne l’heure rangée', () => {
    expect(compasPlan({ compas: { departure_time: '06:45' } }).departureTime).toBe('06:45');
  });

  it.each([undefined, null, 645, '6:45', '25:00', '06:45:00', ''])(
    'aucune heure inventée pour %s',
    (value) => {
      expect(compasPlan({ compas: { departure_time: value } }).departureTime).toBeNull();
    }
  );

  it('sans métadonnées : null', () => {
    expect(compasPlan(null).departureTime).toBeNull();
  });
});
