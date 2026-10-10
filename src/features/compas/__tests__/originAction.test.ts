import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * « depuis Lyon » appliqué : le lieu est retrouvé sur la carte comme la
 * destination (même limite, mêmes messages), rangé arrondi à ~1 km dans
 * `metadata.compas.origin` sans toucher aux autres réglages, et s'efface.
 */
const h = vi.hoisted(() => ({
  meta: {} as Record<string, unknown>,
  calls: [] as Array<{ scope: string; limit: number; windowMs: number; failMode?: string }>,
  refuse: null as null | number,
  denied: false,
  /** Ce que la carte répond, par requête exacte (`lookupDestination`). */
  found: {} as Record<string, unknown>,
  /** Réponses des secours : lieu naturel, ville de base de l'IA, premier lieu venu. */
  natural: null as unknown,
  base: null as unknown,
  loose: null as unknown,
  /** Réponse JSON du spécialiste IA (null : indisponible). */
  ai: null as null | string,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async (_id: string, config: { scope: string; limit: number; windowMs: number; failMode?: string }) => {
    h.calls.push({ scope: config.scope, limit: config.limit, windowMs: config.windowMs, failMode: config.failMode });
    return h.refuse ? new Response(null, { status: h.refuse }) : null;
  }),
}));
vi.mock('../server/compasServer', async (orig) => {
  const real = await orig<typeof import('../server/compasServer')>();
  return {
    ...real,
    requireEditor: vi.fn(async () =>
      h.denied
        ? { error: 'Seuls les organisateurs et éditeurs peuvent modifier le kit.' }
        : {
            supabase: {},
            userId: 'u1',
            trip: {
              id: '11111111-1111-4111-8111-111111111111',
              user_id: 'u1',
              title: 'Rando · Vercors',
              start_date: null,
              end_date: null,
              party_size: 1,
              budget_currency: 'EUR',
              metadata: h.meta,
            },
          }
    ),
    updateTripMetadata: vi.fn(async (_s: unknown, _id: string, patch: (m: Record<string, unknown>) => Record<string, unknown>) => {
      h.meta = patch(h.meta);
      return { metadata: h.meta, error: null };
    }),
  };
});
vi.mock('../server/placeLookup', async (orig) => ({
  ...(await orig<typeof import('../server/placeLookup')>()),
  lookupDestination: vi.fn(async (q: string) => h.found[q] ?? null),
  lookupBase: vi.fn(async () => h.base),
  lookupLoose: vi.fn(async () => h.loose),
  lookupNatural: vi.fn(async () => h.natural),
}));
vi.mock('@/lib/ai/askAI', () => ({
  askAI: vi.fn(async () =>
    h.ai
      ? { text: h.ai, model: 'x', degraded: false, cached: false, provider: 'nvidia' }
      : { text: '{}', model: 'x', degraded: true, cached: false, provider: 'fallback' }
  ),
}));

import { compasSetOriginAction } from '../server/compasActions';
import { updateTripMetadata } from '../server/compasServer';
import { lookupDestination } from '../server/placeLookup';

const TRIP = '11111111-1111-4111-8111-111111111111';
const LYON = {
  name: 'Lyon',
  lat: 45.757813,
  lon: 4.832011,
  countryCode: 'FR',
  country: 'France',
  kind: 'city',
  settlement: true,
  settlementRank: 5,
  extent: null,
};

describe('compasSetOriginAction', () => {
  beforeEach(() => {
    h.meta = { route_id: 12, compas: { anchor: { name: 'Vercors', lat: 45.07, lon: 5.55 }, prefs: { pace: 'tranquille' } } };
    h.calls = [];
    h.refuse = null;
    h.denied = false;
    h.found = { Lyon: LYON };
    h.natural = null;
    h.base = null;
    h.loose = null;
    h.ai = null;
    vi.clearAllMocks();
  });

  it('range le départ arrondi à 0,01°, sans toucher au reste des réglages', async () => {
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Lyon' })).toEqual({ success: true });
    expect(h.meta).toEqual({
      route_id: 12,
      compas: {
        anchor: { name: 'Vercors', lat: 45.07, lon: 5.55 },
        prefs: { pace: 'tranquille' },
        origin: { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR', source: 'dit' },
      },
    });
  });

  it('même limite que la destination : 20 par 10 min, fermée', async () => {
    await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Lyon' });
    expect(h.calls).toEqual([{ scope: 'compas-destination', limit: 20, windowMs: 600_000, failMode: 'closed' }]);
  });

  it('limite atteinte : message clair, aucune recherche, rien d’écrit', async () => {
    h.refuse = 429;
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Lyon' })).toEqual({
      success: false,
      error: 'Trop de lieux cherchés d’affilée : patiente quelques minutes.',
    });
    expect(lookupDestination).not.toHaveBeenCalled();
    expect((h.meta.compas as Record<string, unknown>).origin).toBeUndefined();
  });

  it('lieu inconnu de la carte : refusé, jamais deviné', async () => {
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Atlantide' })).toEqual({
      success: false,
      error: '« Atlantide » introuvable sur la carte.',
    });
    expect((h.meta.compas as Record<string, unknown>).origin).toBeUndefined();
  });

  it('effacer (null ou vide) retire le départ sans rien chercher ni compter', async () => {
    (h.meta.compas as Record<string, unknown>).origin = { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR', source: 'dit' };
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: null })).toEqual({ success: true });
    expect((h.meta.compas as Record<string, unknown>).origin).toBeUndefined();
    expect((h.meta.compas as Record<string, unknown>).anchor).toEqual({ name: 'Vercors', lat: 45.07, lon: 5.55 });
    (h.meta.compas as Record<string, unknown>).origin = { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR', source: 'dit' };
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: '  ' })).toEqual({ success: true });
    expect((h.meta.compas as Record<string, unknown>).origin).toBeUndefined();
    expect(h.calls).toEqual([]);
    expect(lookupDestination).not.toHaveBeenCalled();
  });

  it('entrée invalide refusée par le schéma', async () => {
    expect(await compasSetOriginAction({ tripId: 'pas-un-uuid', tripSlug: 'x', place: 'Lyon' })).toEqual({
      success: false,
      error: 'Lieu invalide',
    });
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'x'.repeat(81) })).toEqual({
      success: false,
      error: 'Lieu invalide',
    });
  });

  it('lecteur ou voyage inaccessible : refusé avant la limite, rien cherché, rien écrit, aucun passage compté', async () => {
    h.denied = true;
    const before = structuredClone(h.meta);
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Lyon' })).toEqual({
      success: false,
      error: 'Seuls les organisateurs et éditeurs peuvent modifier le kit.',
    });
    expect(h.calls).toEqual([]);
    expect(lookupDestination).not.toHaveBeenCalled();
    expect(updateTripMetadata).not.toHaveBeenCalled();
    expect(h.meta).toEqual(before);
    // Effacer est refusé de la même façon.
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: null })).toMatchObject({ success: false });
    expect(updateTripMetadata).not.toHaveBeenCalled();
  });

  describe('« Annuler » : le départ d’avant est rétabli tel quel', () => {
    const grenoble = { name: 'Grenoble', lat: 45.19, lon: 5.72, countryCode: 'FR' };

    it('même point, même pays, sans chercher sur la carte ni compter de passage', async () => {
      (h.meta.compas as Record<string, unknown>).origin = { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR', source: 'dit' };
      expect(
        await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Grenoble', restore: grenoble })
      ).toEqual({ success: true });
      expect((h.meta.compas as Record<string, unknown>).origin).toEqual({ ...grenoble, source: 'dit' });
      expect((h.meta.compas as Record<string, unknown>).anchor).toEqual({ name: 'Vercors', lat: 45.07, lon: 5.55 });
      expect(h.calls).toEqual([]);
      expect(lookupDestination).not.toHaveBeenCalled();
    });

    it('reste possible quand la limite de recherches est atteinte (aucune recherche à faire)', async () => {
      h.refuse = 429;
      expect(
        await compasSetOriginAction({
          tripId: TRIP,
          tripSlug: 'x',
          place: 'Grenoble',
          restore: { ...grenoble, countryCode: null },
        })
      ).toEqual({ success: true });
      expect((h.meta.compas as Record<string, unknown>).origin).toEqual({
        name: 'Grenoble',
        lat: 45.19,
        lon: 5.72,
        countryCode: null,
        source: 'dit',
      });
    });

    it('le point rétabli reste arrondi à 0,01° et le pays en majuscules', async () => {
      await compasSetOriginAction({
        tripId: TRIP,
        tripSlug: 'x',
        place: 'Grenoble',
        restore: { name: 'Grenoble', lat: 45.191234, lon: 5.724321, countryCode: 'fr' },
      });
      expect((h.meta.compas as Record<string, unknown>).origin).toEqual({ ...grenoble, source: 'dit' });
    });

    it('d’abord pas de départ : « Annuler » l’efface, sans rien chercher', async () => {
      await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Lyon' });
      expect((h.meta.compas as Record<string, unknown>).origin).toMatchObject({ name: 'Lyon' });
      h.calls = [];
      vi.clearAllMocks();
      expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: null })).toEqual({ success: true });
      expect((h.meta.compas as Record<string, unknown>).origin).toBeUndefined();
      expect(h.calls).toEqual([]);
      expect(lookupDestination).not.toHaveBeenCalled();
    });

    it('un « restore » invalide est refusé par le schéma, rien d’écrit', async () => {
      const before = structuredClone(h.meta);
      const bad: unknown[] = [
        { ...grenoble, lat: 91 },
        { ...grenoble, lat: -91 },
        { ...grenoble, lon: 181 },
        { ...grenoble, lon: -181 },
        { ...grenoble, lat: Number.NaN },
        { ...grenoble, lon: Number.POSITIVE_INFINITY },
        { ...grenoble, lat: '45.19' },
        { ...grenoble, name: '' },
        { ...grenoble, name: '   ' },
        { ...grenoble, name: 'x'.repeat(81) },
        { ...grenoble, countryCode: 'FRA' },
        { ...grenoble, countryCode: 'F' },
        { ...grenoble, countryCode: '1F' },
        { ...grenoble, countryCode: 33 },
        { name: 'Grenoble', lat: 45.19 },
        'Grenoble',
      ];
      for (const restore of bad) {
        expect(
          await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Grenoble', restore } as never)
        ).toEqual({ success: false, error: 'Lieu invalide' });
      }
      expect(updateTripMetadata).not.toHaveBeenCalled();
      expect(h.meta).toEqual(before);
    });
  });

  describe('seul un lieu habité, une région ou un pays peut être un départ', () => {
    const at = { lat: 46.1, lon: 6.2, countryCode: 'FR', country: 'France', extent: null };
    const refusal = (q: string) => `« ${q} » n’est pas un lieu habité, une région ou un pays : dis une ville (« depuis Lyon »).`;
    const origin = () => (h.meta.compas as Record<string, unknown>).origin;

    it.each([
      ['ville', { kind: 'city', settlement: true, settlementRank: 5 }],
      ['bourg', { kind: 'town', settlement: true, settlementRank: 4 }],
      ['village', { kind: 'village', settlement: true, settlementRank: 3 }],
      ['hameau', { kind: 'hamlet', settlement: true, settlementRank: 2 }],
      ['quartier', { kind: 'suburb', settlement: true, settlementRank: 1 }],
      ['lieu-dit habité', { kind: 'locality', settlement: true, settlementRank: 0 }],
      ['pays', { kind: 'country', settlement: false }],
      ['région', { kind: 'state', settlement: false }],
      ['région (autre nature)', { kind: 'region', settlement: false }],
      ['département', { kind: 'county', settlement: false }],
      ['province', { kind: 'province', settlement: false }],
      ['district', { kind: 'district', settlement: false }],
      ['ville sans drapeau « habité »', { kind: 'city' }],
    ])('accepté : %s', async (_label, kind) => {
      h.found = { Ailleurs: { ...at, name: 'Ailleurs', ...kind } };
      expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Ailleurs' })).toEqual({ success: true });
      expect(origin()).toEqual({ name: 'Ailleurs', lat: 46.1, lon: 6.2, countryCode: 'FR', source: 'dit' });
    });

    it('accepté : la région que le spécialiste IA ramène à une ville de base', async () => {
      h.ai = JSON.stringify({ base: 'Grenoble', country_code: 'FR', label: 'Vercors' });
      h.base = { ...at, name: 'Grenoble', kind: 'city', settlement: true, lat: 45.19, lon: 5.72 };
      expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Vercors' })).toEqual({ success: true });
      expect(origin()).toEqual({ name: 'Vercors', lat: 45.19, lon: 5.72, countryCode: 'FR', source: 'dit' });
    });

    it.each([
      ['sommet', { kind: 'other', landmark: true, osmTag: 'natural=peak' }],
      ['lac', { kind: 'water', landmark: true, osmTag: 'natural=water' }],
      ['parc national', { kind: 'other', landmark: true, osmTag: 'boundary=national_park', extent: [5, 46, 7, 45] }],
      ['rivière', { kind: 'other', landmark: true, osmTag: 'waterway=river' }],
      ['île', { kind: 'island', landmark: true, osmTag: 'place=island' }],
      ['camping', { kind: 'camp_site', osmTag: 'tourism=camp_site' }],
      ['hôtel', { kind: 'hotel', osmTag: 'tourism=hotel' }],
      ['maison', { kind: 'house', osmTag: 'building=house' }],
      ['parking', { kind: 'parking', osmTag: 'amenity=parking' }],
      ['magasin', { kind: 'shop', osmTag: 'shop=supermarket' }],
      ['rue', { kind: 'street' }],
      ['pont', { kind: 'bridge', osmTag: 'man_made=bridge' }],
    ])('refusé : %s (rien d’écrit, le départ d’avant reste)', async (_label, kind) => {
      (h.meta.compas as Record<string, unknown>).origin = { name: 'Grenoble', lat: 45.19, lon: 5.72, countryCode: 'FR', source: 'dit' };
      const before = structuredClone(h.meta);
      h.found = { Camping: { ...at, name: 'Camping', settlement: false, ...kind } };
      expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Camping' })).toEqual({
        success: false,
        error: refusal('Camping'),
      });
      expect(updateTripMetadata).not.toHaveBeenCalled();
      expect(h.meta).toEqual(before);
      // La recherche a eu lieu : le passage est compté, comme pour une destination refusée.
      expect(h.calls).toHaveLength(1);
    });

    it('refusé : le lieu naturel trouvé en secours (« Mont Blanc » n’est pas un départ)', async () => {
      h.natural = { ...at, name: 'Mont Blanc', kind: 'other', landmark: true, osmTag: 'natural=peak', extent: [6, 46, 7, 45] };
      expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'Mont Blanc' })).toEqual({
        success: false,
        error: refusal('Mont Blanc'),
      });
      expect(origin()).toBeUndefined();
    });

    it('refusé : le premier lieu venu de la carte quand rien d’habité ne porte ce nom', async () => {
      h.loose = { ...at, name: 'Camping des Pins', kind: 'other', settlement: false, osmTag: 'tourism=camp_site' };
      expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: 'x', place: 'camping' })).toEqual({
        success: false,
        error: refusal('camping'),
      });
      expect(origin()).toBeUndefined();
      expect(updateTripMetadata).not.toHaveBeenCalled();
    });

    it('« Annuler » n’est pas concerné : le départ d’avant est rétabli sans cette vérification', async () => {
      expect(
        await compasSetOriginAction({
          tripId: TRIP,
          tripSlug: 'x',
          place: 'Grenoble',
          restore: { name: 'Grenoble', lat: 45.19, lon: 5.72, countryCode: 'FR' },
        })
      ).toEqual({ success: true });
      expect(origin()).toEqual({ name: 'Grenoble', lat: 45.19, lon: 5.72, countryCode: 'FR', source: 'dit' });
    });
  });
});
