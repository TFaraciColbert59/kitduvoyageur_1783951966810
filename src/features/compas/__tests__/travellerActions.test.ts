import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompasPlace } from '../engine/places';

/**
 * Profil voyageur enregistré par la personne : formats vérifiés, domicile retrouvé
 * UNE fois sur la carte (même limite que « depuis Lyon ») et rangé à 0,01°, essai
 * sans compte refusé, « Passer » rangé sans rien effacer, rien de la saisie dans un journal.
 */
const h = vi.hoisted(() => ({
  user: { id: 'u1', is_anonymous: false } as { id: string; is_anonymous?: boolean } | null,
  row: null as Record<string, unknown> | null,
  upserts: [] as Array<{ row: Record<string, unknown>; options: unknown }>,
  calls: [] as Array<{ scope: string; limit: number; windowMs: number; failMode?: string }>,
  refuse: null as null | number,
  failWrite: false,
  found: {} as Record<string, unknown>,
  throwOn: null as string | null,
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user }, error: null }) },
    from: (table: string) => {
      if (table !== 'user_traveller') throw new Error(`table inattendue : ${table}`);
      return {
        select: () => ({
          eq: (_column: string, id: string) => ({
            maybeSingle: async () => ({ data: h.row && h.row.user_id === id ? { ...h.row } : null, error: null }),
          }),
        }),
        upsert: async (row: Record<string, unknown>, options: { onConflict?: string; ignoreDuplicates?: boolean }) => {
          h.upserts.push({ row, options });
          if (h.failWrite) return { error: { code: '23514', message: 'refusé' } };
          if (!(options.ignoreDuplicates && h.row)) h.row = { ...row };
          return { error: null };
        },
      };
    },
  }),
}));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async (_id: string, config: { scope: string; limit: number; windowMs: number; failMode?: string }) => {
    h.calls.push({ scope: config.scope, limit: config.limit, windowMs: config.windowMs, failMode: config.failMode });
    return h.refuse ? new Response(null, { status: h.refuse }) : null;
  }),
}));
vi.mock('../server/placeLookup', async (orig) => ({
  ...(await orig<typeof import('../server/placeLookup')>()),
  lookupDestination: vi.fn(async (q: string) => {
    if (h.throwOn === q) throw new Error(`Photon en panne pour « ${q} »`);
    return (h.found[q] as CompasPlace | undefined) ?? null;
  }),
  lookupNatural: vi.fn(async () => null),
  lookupLoose: vi.fn(async () => null),
}));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));

import { saveTravellerAction, skipTravellerAction } from '../server/travellerActions';
import { lookupDestination } from '../server/placeLookup';
import { reportServerError } from '@/lib/observability/appErrors';
import { isHomePlace } from '../engine/places';

const place = (name: string, kind: string, settlement: boolean, lat: number, lon: number): CompasPlace => ({
  name,
  lat,
  lon,
  countryCode: 'FR',
  country: 'France',
  kind,
  settlement,
  extent: null,
});
const LYON = place('Lyon', 'city', true, 45.757813, 4.832011);
const FULL = { nationality: 'fr', residenceCountry: 'FR', currency: 'eur', language: 'pt-br', timeZone: 'Europe/Paris', home: 'Lyon' };
const STORED = {
  user_id: 'u1',
  nationality: 'FR',
  residence_country: null,
  currency: null,
  language: null,
  time_zone: null,
  home_name: 'Lyon',
  home_lat: 45.76,
  home_lon: 4.83,
  home_country: 'FR',
};
const LIMIT = { scope: 'compas-destination', limit: 20, windowMs: 600_000, failMode: 'closed' };

beforeEach(() => {
  h.user = { id: 'u1', is_anonymous: false };
  h.row = null;
  h.upserts = [];
  h.calls = [];
  h.refuse = null;
  h.failWrite = false;
  h.throwOn = null;
  h.found = {
    Lyon: LYON,
    'Camping des Pins': place('Camping des Pins', 'camp_site', false, 44.1, 3.2),
    Bretagne: place('Bretagne', 'state', false, 48.2, -2.9),
  };
  vi.clearAllMocks();
});

describe('saveTravellerAction', () => {
  it('range le profil nettoyé et le domicile arrondi à 0,01°, rend la vue sans coordonnées', async () => {
    expect(await saveTravellerAction(FULL)).toEqual({
      success: true,
      view: { nationality: 'FR', residenceCountry: 'FR', currency: 'EUR', language: 'pt-BR', timeZone: 'Europe/Paris', homeName: 'Lyon' },
    });
    expect(h.upserts).toEqual([
      {
        row: {
          user_id: 'u1',
          nationality: 'FR',
          residence_country: 'FR',
          currency: 'EUR',
          language: 'pt-BR',
          time_zone: 'Europe/Paris',
          home_name: 'Lyon',
          home_lat: 45.76,
          home_lon: 4.83,
          home_country: 'FR',
          updated_at: expect.any(String),
        },
        options: { onConflict: 'user_id' },
      },
    ]);
  });

  it('domicile cherché une seule fois, avec la limite des lieux : 20 par 10 min, fermée', async () => {
    await saveTravellerAction(FULL);
    expect(h.calls).toEqual([LIMIT]);
    expect(lookupDestination).toHaveBeenCalledTimes(1);
  });

  it('même domicile qu’avant : ni recherche, ni comptage, position gardée', async () => {
    h.row = { ...STORED };
    expect(await saveTravellerAction({ nationality: 'BE', home: 'lyon' })).toMatchObject({
      success: true,
      view: { nationality: 'BE', homeName: 'Lyon' },
    });
    expect(lookupDestination).not.toHaveBeenCalled();
    expect(h.calls).toEqual([]);
    expect(h.upserts[0].row).toMatchObject({ nationality: 'BE', home_name: 'Lyon', home_lat: 45.76, home_lon: 4.83, home_country: 'FR' });
  });

  it('sans domicile : rien de cherché, le domicile est effacé', async () => {
    h.row = { ...STORED };
    expect(await saveTravellerAction({ nationality: 'FR', home: '  ' })).toMatchObject({ success: true, view: { homeName: null } });
    expect(h.calls).toEqual([]);
    expect(h.upserts[0].row).toMatchObject({ home_name: null, home_lat: null, home_lon: null, home_country: null });
  });

  it('limite atteinte : message clair, rien cherché ni écrit', async () => {
    h.refuse = 429;
    expect(await saveTravellerAction(FULL)).toEqual({
      success: false,
      error: 'Trop de lieux cherchés d’affilée : patiente quelques minutes.',
    });
    expect(lookupDestination).not.toHaveBeenCalled();
    expect(h.upserts).toEqual([]);
  });

  it('lieu inconnu de la carte : refusé, jamais deviné', async () => {
    expect(await saveTravellerAction({ home: 'Atlantide' })).toEqual({
      success: false,
      error: '« Atlantide » introuvable sur la carte.',
    });
    expect(h.upserts).toEqual([]);
  });

  it('un camping ou une région ne sont pas un domicile', async () => {
    for (const name of ['Camping des Pins', 'Bretagne'])
      expect(await saveTravellerAction({ home: name })).toEqual({
        success: false,
        error: `« ${name} » n’est pas une ville ou un village : écris ta commune (« Lyon »).`,
      });
    expect(h.upserts).toEqual([]);
  });

  it('formats refusés avant toute recherche : nationalité, pays, devise, langue, fuseau, domicile', async () => {
    for (const bad of [
      { nationality: 'UK' },
      { nationality: 'FRA' },
      { residenceCountry: 'ZZ' },
      { currency: 'EURO' },
      { language: 'klingon!' },
      { timeZone: 'Mars/Olympus' },
      { home: 'L' },
      { home: 'x'.repeat(81) },
    ])
      expect(await saveTravellerAction(bad), JSON.stringify(bad)).toEqual({ success: false, error: 'Profil invalide' });
    expect(await saveTravellerAction({ nationality: 42 } as never)).toEqual({ success: false, error: 'Profil invalide' });
    expect(lookupDestination).not.toHaveBeenCalled();
    expect(h.calls).toEqual([]);
    expect(h.upserts).toEqual([]);
  });

  it('sans session, ou essai sans compte : refusé avant toute recherche', async () => {
    h.user = null;
    expect(await saveTravellerAction(FULL)).toEqual({ success: false, error: 'Connecte-toi pour enregistrer ton profil voyageur.' });
    h.user = { id: 'u9', is_anonymous: true };
    expect(await saveTravellerAction(FULL)).toEqual({ success: false, error: 'Crée ton compte pour enregistrer ton profil voyageur.' });
    expect(h.calls).toEqual([]);
    expect(lookupDestination).not.toHaveBeenCalled();
    expect(h.upserts).toEqual([]);
  });

  it('écriture refusée par la base : un message fixe, sans la valeur', async () => {
    h.failWrite = true;
    expect(await saveTravellerAction({ nationality: 'FR' })).toEqual({
      success: false,
      error: 'Impossible d’enregistrer ton profil voyageur.',
    });
  });

  it('panne de la carte : « Erreur serveur », et rien de la saisie dans le journal', async () => {
    h.throwOn = 'Lyon';
    expect(await saveTravellerAction(FULL)).toEqual({ success: false, error: 'Erreur serveur' });
    expect(reportServerError).toHaveBeenCalledTimes(1);
    const [scope, err] = vi.mocked(reportServerError).mock.calls[0];
    expect(scope).toBe('compas.saveTravellerAction');
    expect((err as Error).message).not.toContain('Lyon');
  });
});

describe('skipTravellerAction', () => {
  it('« Passer » range une ligne vide : la question n’est plus posée', async () => {
    expect(await skipTravellerAction()).toEqual({ success: true });
    expect(h.upserts).toEqual([{ row: { user_id: 'u1' }, options: { onConflict: 'user_id', ignoreDuplicates: true } }]);
    expect(h.row).toEqual({ user_id: 'u1' });
  });

  it('un profil déjà rempli n’est jamais effacé par « Passer »', async () => {
    h.row = { ...STORED };
    await skipTravellerAction();
    expect(h.row).toEqual(STORED);
  });

  it('sans session ou essai sans compte : rien d’écrit', async () => {
    h.user = null;
    expect(await skipTravellerAction()).toEqual({ success: false });
    h.user = { id: 'u9', is_anonymous: true };
    expect(await skipTravellerAction()).toEqual({ success: false });
    expect(h.upserts).toEqual([]);
  });
});

describe('isHomePlace', () => {
  it('une ville ou un village ; jamais un camping, un sommet, une région ni un pays', () => {
    expect(isHomePlace(place('Lyon', 'city', true, 45, 5))).toBe(true);
    expect(isHomePlace(place('Méaudre', 'village', true, 45, 5))).toBe(true);
    expect(isHomePlace(place('Annecy', 'town', false, 45, 6))).toBe(true);
    for (const kind of ['camp_site', 'peak', 'state', 'region', 'county', 'province', 'country'])
      expect(isHomePlace(place('X', kind, false, 45, 5)), kind).toBe(false);
  });
});
