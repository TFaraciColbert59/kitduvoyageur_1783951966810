import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pickTrail, type GeoTrailRow } from '../engine/geoTrails';

/**
 * Destination nommée par un code de sentier (« GR34 », « GR 7 ») : avec le référentiel
 * `geo_trails` allumé et la référence trouvée, la destination est le CENTRE du tracé, son
 * emprise, son nom, et le pays lu à ce centre sur la carte. Sinon (référence inconnue,
 * interrupteur éteint, base ou carte muette) : le comportement d'avant, `trailRegion` puis
 * la recherche par nom. Ni base ni réseau : le référentiel et la carte sont simulés.
 */
const h = vi.hoisted(() => ({
  meta: {} as Record<string, unknown>,
  on: true,
  rows: [] as unknown[],
  found: {} as Record<string, unknown>,
  reverse: null as unknown,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('../server/geoTrails', () => ({
  geoTrailsEnabled: vi.fn(() => h.on),
  referentialTrail: vi.fn(async (ref: string) => pickTrail(h.rows as GeoTrailRow[], ref)),
}));
vi.mock('../server/compasServer', async (orig) => {
  const real = await orig<typeof import('../server/compasServer')>();
  return {
    ...real,
    requireEditor: vi.fn(async () => ({
      supabase: {},
      userId: 'u1',
      trip: {
        id: '11111111-1111-4111-8111-111111111111',
        user_id: 'u1',
        title: 'Trek · nouvelle aventure',
        start_date: null,
        end_date: null,
        party_size: 1,
        budget_currency: 'EUR',
        metadata: h.meta,
      },
    })),
    updateTripMetadata: vi.fn(
      async (
        _s: unknown,
        _id: string,
        patch: (m: Record<string, unknown>) => Record<string, unknown>
      ) => {
        h.meta = patch(h.meta);
        return { metadata: h.meta, error: null };
      }
    ),
  };
});
vi.mock('../server/placeLookup', async (orig) => ({
  ...(await orig<typeof import('../server/placeLookup')>()),
  lookupDestination: vi.fn(async (q: string) => h.found[q] ?? null),
  lookupReverse: vi.fn(async () => h.reverse),
  lookupBase: vi.fn(async () => null),
  lookupLoose: vi.fn(async () => null),
  lookupNatural: vi.fn(async () => null),
}));
vi.mock('@/lib/ai/askAI', () => ({
  askAI: vi.fn(async () => ({
    text: '{}',
    model: 'x',
    degraded: true,
    cached: false,
    provider: 'fallback',
  })),
}));

import { compasSetDestinationAction } from '../server/compasActions';
import { updateTripMetadata } from '../server/compasServer';
import { referentialTrail } from '../server/geoTrails';
import { lookupDestination, lookupReverse } from '../server/placeLookup';
import { trailDestination } from '../server/trailDestination';

const TRIP = '11111111-1111-4111-8111-111111111111';
const GR34: GeoTrailRow = {
  osm_id: 'r123',
  ref: 'GR34',
  name: 'Sentier des douaniers',
  network: 'nwn',
  lat: 48.2,
  lon: -3.1,
  west: -4.8,
  south: 47.2,
  east: -1.5,
  north: 48.9,
};
const GR50: GeoTrailRow = { ...GR34, osm_id: 'r500', ref: 'GR50', name: 'Tour du Haut-Dauphiné' };
const BRETAGNE = {
  name: 'Bretagne',
  lat: 48.2,
  lon: -2.9,
  countryCode: 'FR',
  country: 'France',
  kind: 'state',
  extent: [-5.1, 48.9, -1.0, 47.3],
};
const AT_CENTER = {
  name: 'Saint-Brieuc',
  lat: 48.2,
  lon: -3.1,
  countryCode: 'FR',
  country: 'France',
  kind: 'town',
  extent: null,
};
const anchor = () => (h.meta.compas as Record<string, unknown> | undefined)?.anchor;

describe('destination par code de sentier (référentiel geo_trails)', () => {
  beforeEach(() => {
    h.meta = {};
    h.on = true;
    h.rows = [GR34, GR50];
    h.found = { Bretagne: BRETAGNE };
    h.reverse = AT_CENTER;
    vi.clearAllMocks();
  });

  it('référence trouvée : centre du tracé, emprise [ouest, nord, est, sud], nom du sentier, pays lu au centre', async () => {
    expect(
      await compasSetDestinationAction({ tripId: TRIP, tripSlug: 'x', place: 'GR 34' })
    ).toEqual({
      success: true,
    });
    expect(referentialTrail).toHaveBeenCalledWith('GR34');
    expect(lookupReverse).toHaveBeenCalledWith(48.2, -3.1);
    expect(anchor()).toEqual({
      name: 'Sentier des douaniers',
      lat: 48.2,
      lon: -3.1,
      countryCode: 'FR',
      country: 'France',
      kind: 'other',
      extent: [-4.8, 48.9, -1.5, 47.2],
      osmTag: 'route=hiking',
    });
    // Ni la région du sentier ni une recherche par nom : le référentiel suffit.
    expect(lookupDestination).not.toHaveBeenCalled();
    const call = vi.mocked(updateTripMetadata).mock.calls[0];
    expect(call[3]).toEqual({
      columns: {
        destination_name: 'Sentier des douaniers',
        destination_country_code: 'FR',
        title: 'Trek · Sentier des douaniers',
      },
    });
  });

  it('sentier sans nom dans OSM : la référence sert de nom', async () => {
    h.rows = [{ ...GR34, name: null }];
    await compasSetDestinationAction({ tripId: TRIP, tripSlug: 'x', place: 'GR34' });
    expect(anchor()).toMatchObject({ name: 'GR34', lat: 48.2, lon: -3.1 });
  });

  it('référence inconnue du référentiel : repli sur trailRegion puis la recherche par nom (comme avant)', async () => {
    h.rows = [];
    expect(
      await compasSetDestinationAction({ tripId: TRIP, tripSlug: 'x', place: 'GR34' })
    ).toEqual({
      success: true,
    });
    expect(referentialTrail).toHaveBeenCalledWith('GR34');
    expect(lookupDestination).toHaveBeenCalledWith('Bretagne');
    expect(anchor()).toMatchObject({ name: 'Bretagne', kind: 'state', countryCode: 'FR' });
  });

  it('« GR5 » ne retrouve pas « GR50 » : repli sur la région du GR5', async () => {
    h.rows = [GR50];
    h.found = { Alpes: { ...BRETAGNE, name: 'Alpes', lat: 45.5, lon: 6.5 } };
    await compasSetDestinationAction({ tripId: TRIP, tripSlug: 'x', place: 'GR5' });
    expect(referentialTrail).toHaveBeenCalledWith('GR5');
    expect(lookupDestination).toHaveBeenCalledWith('Alpes');
    expect(anchor()).toMatchObject({ name: 'Alpes' });
  });

  it('interrupteur éteint : aucun appel au référentiel, comportement d’avant', async () => {
    h.on = false;
    await compasSetDestinationAction({ tripId: TRIP, tripSlug: 'x', place: 'GR34' });
    expect(referentialTrail).not.toHaveBeenCalled();
    expect(lookupReverse).not.toHaveBeenCalled();
    expect(lookupDestination).toHaveBeenCalledWith('Bretagne');
    expect(anchor()).toMatchObject({ name: 'Bretagne' });
  });

  it('lieu sans code de sentier : le référentiel n’est pas consulté', async () => {
    h.found = { Vercors: { ...BRETAGNE, name: 'Vercors', kind: 'other' } };
    await compasSetDestinationAction({ tripId: TRIP, tripSlug: 'x', place: 'Vercors' });
    expect(referentialTrail).not.toHaveBeenCalled();
    expect(anchor()).toMatchObject({ name: 'Vercors' });
  });

  it('carte muette au centre du tracé (pays inconnu) : rien de deviné, repli sur la région', async () => {
    h.reverse = null;
    await compasSetDestinationAction({ tripId: TRIP, tripSlug: 'x', place: 'GR34' });
    expect(lookupDestination).toHaveBeenCalledWith('Bretagne');
    expect(anchor()).toMatchObject({ name: 'Bretagne' });
  });

  it('carte en panne au centre du tracé : repli, jamais d’erreur serveur', async () => {
    vi.mocked(lookupReverse).mockRejectedValueOnce(new Error('réseau'));
    expect(
      await compasSetDestinationAction({ tripId: TRIP, tripSlug: 'x', place: 'GR34' })
    ).toEqual({
      success: true,
    });
    expect(anchor()).toMatchObject({ name: 'Bretagne' });
  });

  it('trailDestination : un code de sentier dans une phrase, pas seulement un lieu seul', async () => {
    expect(await trailDestination('le GR34 en 8 jours')).toMatchObject({
      name: 'Sentier des douaniers',
      countryCode: 'FR',
    });
    expect(await trailDestination('Bretagne')).toBeNull();
  });
});

/**
 * « GR34 en 8 jours » arrive comme « Bretagne » (la compréhension garde le sentier comme
 * envie) avec la référence `trail: 'GR34'` à côté : c'est elle que lit le référentiel.
 */
describe('destination proposée avec la référence du sentier (champ trail)', () => {
  beforeEach(() => {
    h.meta = {};
    h.on = true;
    h.rows = [GR34, GR50];
    h.found = { Bretagne: BRETAGNE };
    h.reverse = AT_CENTER;
    vi.clearAllMocks();
  });

  it('référentiel qui trouve : destination au centre du tracé, pas la région', async () => {
    expect(
      await compasSetDestinationAction({
        tripId: TRIP,
        tripSlug: 'x',
        place: 'Bretagne',
        trail: 'GR34',
      })
    ).toEqual({ success: true });
    expect(referentialTrail).toHaveBeenCalledWith('GR34');
    expect(anchor()).toMatchObject({
      name: 'Sentier des douaniers',
      lat: 48.2,
      lon: -3.1,
      extent: [-4.8, 48.9, -1.5, 47.2],
    });
    expect(lookupDestination).not.toHaveBeenCalled();
  });

  it('référence inconnue : la région dite, comme avant', async () => {
    h.rows = [];
    await compasSetDestinationAction({
      tripId: TRIP,
      tripSlug: 'x',
      place: 'Bretagne',
      trail: 'GR34',
    });
    expect(lookupDestination).toHaveBeenCalledWith('Bretagne');
    expect(anchor()).toMatchObject({ name: 'Bretagne', kind: 'state' });
  });

  it('« GR5 » ne retrouve pas « GR50 »', async () => {
    h.rows = [GR50];
    h.found = { Alpes: { ...BRETAGNE, name: 'Alpes', lat: 45.5, lon: 6.5 } };
    await compasSetDestinationAction({ tripId: TRIP, tripSlug: 'x', place: 'Alpes', trail: 'GR5' });
    expect(referentialTrail).toHaveBeenCalledWith('GR5');
    expect(anchor()).toMatchObject({ name: 'Alpes' });
  });

  it('interrupteur éteint : le champ est ignoré, résultat identique à l’appel sans lui', async () => {
    h.on = false;
    await compasSetDestinationAction({ tripId: TRIP, tripSlug: 'x', place: 'Bretagne' });
    const without = { meta: h.meta, columns: vi.mocked(updateTripMetadata).mock.calls[0][3] };
    h.meta = {};
    vi.clearAllMocks();
    await compasSetDestinationAction({
      tripId: TRIP,
      tripSlug: 'x',
      place: 'Bretagne',
      trail: 'GR34',
    });
    expect(referentialTrail).not.toHaveBeenCalled();
    expect(lookupReverse).not.toHaveBeenCalled();
    expect(h.meta).toEqual(without.meta);
    expect(vi.mocked(updateTripMetadata).mock.calls[0][3]).toEqual(without.columns);
  });

  it('référence illisible : refusée comme un lieu invalide, rien n’est écrit', async () => {
    expect(
      await compasSetDestinationAction({
        tripId: TRIP,
        tripSlug: 'x',
        place: 'Bretagne',
        trail: 'le GR 34 en 8 jours de marche',
      })
    ).toEqual({ success: false, error: 'Lieu invalide' });
    expect(updateTripMetadata).not.toHaveBeenCalled();
  });
});
