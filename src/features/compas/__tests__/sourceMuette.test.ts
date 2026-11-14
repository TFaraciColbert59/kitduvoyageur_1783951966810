import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Aperçu du 14/11 — source muette. « 5 jours de rando dans les Tatras en août à 2 depuis Paris », OpenStreetMap
 * muet ce jour-là : la préparation annonçait « Ton aventure est prête » avec cinq étapes « Jour N · Kościelisko »
 * (un seul lieu, aucune distance). De bout en bout sur `compasAutofillAction` et `compasRefreshAutofillAction`
 * (client Supabase en mémoire, carte simulée à sa frontière) :
 *
 *  - la carte n'a pas répondu : l'état « incomplet faute de source » est rangé dans `metadata.compas.autofill.itinerary`
 *    (pas une chaîne à relire), le résumé le dit à l'écran, une note le dit à la relecture ;
 *  - la carte a répondu et la zone est pauvre : « zone pauvre », aucune reprise ;
 *  - la carte a répondu et l'itinéraire est fourni : « complet », comportement d'avant ;
 *  - la reprise rejoue l'itinéraire une fois par ouverture, jamais dans la minute qui suit l'échec, jamais si la
 *    personne a touché aux étapes, jamais plus de `STAGES_RETRY_MAX` fois.
 */
const h = vi.hoisted(() => ({
  db: null as unknown as MemorySupabase,
  /** Ce que « la carte » fait : muette (un lieu, `silent`), répond pauvre (un lieu), répond riche (cinq lieux). */
  map: 'silent' as 'silent' | 'silent_one' | 'poor' | 'rich',
  areaAsks: 0,
}));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));
vi.mock('../server/placeLookup', async (orig) => ({
  ...(await orig<typeof import('../server/placeLookup')>()),
  lookupDestination: vi.fn(async () => null),
  lookupLoose: vi.fn(async () => null),
  lookupNatural: vi.fn(async () => null),
  lookupMassif: vi.fn(async () => null),
  lookupReverse: vi.fn(async () => null),
  lookupRiver: vi.fn(async () => null),
  lookupIslandContour: vi.fn(async () => null),
  stageCandidates: vi.fn(async () => []),
  pathCandidates: vi.fn(async () => []),
  stageAliasCandidates: vi.fn(async () => []),
}));

const village = (id: number, name: string, dLat: number, dLon: number) => ({
  id: `n${id}`,
  name,
  lat: 49.28 + dLat,
  lon: 19.95 + dLon,
  kind: 'village',
  settlement: true,
  population: 3000 - id,
  eleM: null,
  countryCode: 'PL',
});
// Lieux de la zone : cinq villages proches (l'itinéraire en trouve trois distincts au moins) ; « pauvre » : deux
// lieux dont un seul se rejoint (le constat du 14/11 : cinq nuits « Kościelisko », « 1 lieu où dormir »).
const RICH = [
  village(1, 'Kościelisko', -0.02, -0.07),
  village(2, 'Witów', -0.01, -0.1),
  village(3, 'Dzianisz', 0.02, -0.13),
  village(4, 'Zakopane', 0.0, -0.05),
  village(5, 'Poronin', 0.05, 0.12),
];
const POOR = [RICH[0], RICH[4]];
vi.mock('../server/stagePoiLookup', () => ({
  /** Quatrième argument : ce que la vraie recherche remplit quand la carte complète n'a pas répondu. */
  lookupAreaPlaces: vi.fn(async (_q: unknown, _deadline: number, diag?: string[], status?: { silent: boolean }) => {
    h.areaAsks += 1;
    if (h.map === 'rich') return RICH;
    if (h.map === 'silent_one') {
      if (status) status.silent = true;
      return [RICH[0]];
    }
    diag?.push(h.map === 'silent' ? 'Photon 2' : 'Overpass 2');
    if (h.map === 'silent' && status) status.silent = true;
    return POOR;
  }),
  lookupRiverLine: vi.fn(async () => null),
  lookupTrailLine: vi.fn(async () => null),
  lookupStagePois: vi.fn(async () => null),
  readCachedStagePois: vi.fn(async () => ({ pois: [], complete: false })),
}));
vi.mock('@/lib/geo/terrainElevation', async (orig) => ({
  ...(await orig<typeof import('@/lib/geo/terrainElevation')>()),
  terrainElevations: vi.fn((points: unknown[]) => Promise.resolve(points.map(() => null))),
}));
vi.mock('@/features/adventure-prep/routingService', async (orig) => ({
  ...(await orig<typeof import('@/features/adventure-prep/routingService')>()),
  routeAttempt: vi.fn(async () => ({ legs: null, reason: 'provider_unavailable' })),
}));
vi.mock('../server/sharedCache', async (orig) => ({
  ...(await orig<typeof import('../server/sharedCache')>()),
  cached: vi.fn(async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  readShared: vi.fn(async () => undefined),
  writeShared: vi.fn(async () => undefined),
}));
vi.mock('../server/elevation', () => ({
  routeAscentM: vi.fn(async () => null),
  pointsMaxAltitudeM: vi.fn(async () => null),
}));
vi.mock('../server/weather', async (orig) => ({
  ...(await orig<typeof import('../server/weather')>()),
  getClimateNormals: vi.fn(async () => null),
}));
vi.mock('@/lib/ai/askAI', () => ({
  aiEnabled: () => false,
  askAI: vi.fn(async () => ({ text: '{}', model: 'x', degraded: true, cached: false, provider: 'fallback' })),
}));

import { compasAutofillAction, compasRefreshAutofillAction } from '../server/autofillActions';
import { readItinerary, sourceRetryDue, thinItinerary, SOURCE_RETRY_AFTER_MS } from '../server/autofillState';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const TRIP = '99999999-9999-4999-8999-999999999999';
const TATRAS = {
  name: 'Tatras',
  lat: 49.2,
  lon: 19.95,
  countryCode: 'PL',
  country: 'Pologne',
  kind: 'other',
  extent: [19.5, 49.0, 20.4, 49.45],
};
const launch = () => compasAutofillAction({ tripId: TRIP, tripSlug: 'voyage', from: null, phase: 'all' });
const refresh = () => compasRefreshAutofillAction({ tripId: TRIP, tripSlug: 'voyage' });
const steps = () => h.db.rows('trip_steps');
const meta = () => h.db.rows('trips')[0].metadata as { compas?: { autofill?: Record<string, unknown>; autofill_carry?: Record<string, unknown> } };
const autofill = () => meta().compas?.autofill ?? {};
const names = () => new Set(steps().map((s) => String(s.title).replace(/^Jour \d+ · /, '')));
/** Les étapes écrites ne sont « à la personne » que si elle y touche : horodatage d'avant la fin de la préparation. */
const markUntouched = () => {
  for (const s of steps()) s.updated_at = '2000-01-01T00:00:00.000Z';
};

beforeEach(() => {
  vi.clearAllMocks();
  h.map = 'silent';
  h.areaAsks = 0;
  h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
  h.db.rows('trips').push({
    id: TRIP,
    user_id: 'u1',
    title: 'Rando · Tatras',
    start_date: '2026-08-10',
    end_date: '2026-08-14',
    destination_name: 'Tatras',
    destination_country_code: 'PL',
    party_size: 2,
    budget_currency: 'EUR',
    primary_activity: 'hiking',
    estimated_budget: null,
    metadata: { compas: { anchor: TATRAS } },
    updated_at: '2026-10-09T09:00:00.000000+00:00',
  });
});
afterEach(() => vi.useRealTimers());

describe('Aperçu du 14/11 — source muette', () => {
  it('la carte n’a pas répondu : l’état est « incomplet faute de source », rangé dans les métadonnées, dit au résumé et en note', async () => {
    const res = await launch();
    expect(res.success).toBe(true);
    if (!res.success || !('summary' in res)) throw new Error('résumé attendu');
    // Le constat : cinq étapes sur le même lieu.
    expect(steps()).toHaveLength(5);
    expect(names().size).toBe(1);
    // L'état explicite, pas une chaîne à relire.
    expect(res.summary.itinerary).toBe('source_silent');
    expect(readItinerary(autofill().itinerary)).toEqual({ state: 'source_silent', places: 1, sources: ['Photon 2'] });
    // La note dit ce qui manque, sur l'écran rechargé aussi.
    expect(res.summary.notes.some((n) => /La carte n’a pas répondu/.test(n))).toBe(true);
    // Le mécanisme de reprise existant est armé (compteur d'essais).
    expect(autofill().stagesFallback).toBe(1);
  });

  it('la carte n’a pas répondu et rien ne se trace (un seul lieu) : le repli sur le lieu est dit incomplet, pas « prêt »', async () => {
    h.map = 'silent_one';
    const res = await launch();
    expect(res.success).toBe(true);
    if (!res.success || !('summary' in res)) throw new Error('résumé attendu');
    expect(names().size).toBe(1);
    expect(res.summary.itinerary).toBe('source_silent');
    expect(autofill().stagesFallback).toBe(1);
  });

  it('la carte a répondu mais la zone est pauvre (un seul lieu) : « zone pauvre », aucune reprise', async () => {
    h.map = 'poor';
    const res = await launch();
    expect(res.success).toBe(true);
    if (!res.success || !('summary' in res)) throw new Error('résumé attendu');
    expect(steps()).toHaveLength(5);
    expect(res.summary.itinerary).toBe('poor_zone');
    expect(readItinerary(autofill().itinerary)?.state).toBe('poor_zone');
    expect(autofill().stagesFallback).toBeUndefined();
    expect(res.summary.notes.some((n) => /La carte n’a pas répondu/.test(n))).toBe(false);
  });

  it('la carte a répondu et l’itinéraire est fourni : « complet », comme avant', async () => {
    h.map = 'rich';
    const res = await launch();
    expect(res.success).toBe(true);
    if (!res.success || !('summary' in res)) throw new Error('résumé attendu');
    expect(names().size).toBeGreaterThanOrEqual(3);
    expect(res.summary.itinerary).toBe('complete');
    expect(autofill().stagesFallback).toBeUndefined();
  });

  describe('reprise automatique de l’itinéraire seul', () => {
    const afterMinutes = (min: number) => vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + min * 60_000 });

    it('pas dans la minute qui suit l’échec : la carte vient de se taire', async () => {
      await launch();
      const asksAfterFirst = h.areaAsks;
      markUntouched();
      expect(await refresh()).toEqual({ success: true, parts: [], kept: [], label: '' });
      expect(steps()).toHaveLength(5);
      expect(h.areaAsks).toBe(asksAfterFirst);
    });

    it('à l’ouverture suivante, la carte répond : l’itinéraire est rejoué et devient complet', async () => {
      await launch();
      markUntouched();
      expect(names().size).toBe(1);
      h.map = 'rich';
      afterMinutes(5);
      const res = await refresh();
      expect(res.success && res.parts).toContain('steps');
      // Le préremplissage repasse (c'est ce que fait l'écran après la réponse).
      const again = await launch();
      expect(again.success).toBe(true);
      if (!again.success || !('summary' in again)) throw new Error('résumé attendu');
      expect(again.summary.itinerary).toBe('complete');
      expect(names().size).toBeGreaterThanOrEqual(3);
      expect(steps()).toHaveLength(5);
      // Plus rien à reprendre.
      expect(autofill().stagesFallback).toBeUndefined();
      expect(readItinerary(autofill().itinerary)?.state).toBe('complete');
    });

    it('la carte reste muette : une tentative par ouverture, trois au plus, jamais de boucle', async () => {
      await launch();
      let attempts = 0;
      for (let open = 0; open < 6; open += 1) {
        markUntouched();
        afterMinutes(5 * (open + 1));
        const res = await refresh();
        if (res.success && res.parts.length) {
          attempts += 1;
          await launch();
        }
      }
      // Le premier passage + deux reprises = `STAGES_RETRY_MAX` (3) préparations restées sans carte.
      expect(attempts).toBe(2);
      expect(autofill().stagesFallback).toBe(3);
      expect(steps()).toHaveLength(5);
    });

    it('la personne a retouché une étape : rien n’est rejoué, la reprise se referme', async () => {
      await launch();
      markUntouched();
      steps()[2].title = 'Jour 3 · Ma cabane à moi';
      steps()[2].updated_at = new Date(Date.now() + 60_000).toISOString();
      const asksAfterFirst = h.areaAsks;
      h.map = 'rich';
      afterMinutes(5);
      expect(await refresh()).toEqual({ success: true, parts: [], kept: [], label: '' });
      expect(steps().map((s) => s.title)).toContain('Jour 3 · Ma cabane à moi');
      expect(h.areaAsks).toBe(asksAfterFirst);
      expect(autofill().stagesFallback).toBeUndefined();
      // Refermée : l'ouverture suivante ne demande plus rien.
      afterMinutes(20);
      expect(await refresh()).toEqual({ success: true, parts: [], kept: [], label: '' });
    });

    it('la personne a ajouté ou retiré une étape : même chose', async () => {
      await launch();
      markUntouched();
      h.db.tables.trip_steps = steps().slice(0, 4);
      h.map = 'rich';
      afterMinutes(5);
      expect(await refresh()).toEqual({ success: true, parts: [], kept: [], label: '' });
      expect(steps()).toHaveLength(4);
      expect(autofill().stagesFallback).toBeUndefined();
    });
  });

  describe('états purs', () => {
    it('un itinéraire est mince s’il a moins de lieux que de jours (trois au plus), sauf séjour sur place', () => {
      expect(thinItinerary(1, 5, 'loop')).toBe(true);
      expect(thinItinerary(2, 5, 'traverse')).toBe(true);
      expect(thinItinerary(3, 5, 'loop')).toBe(false);
      expect(thinItinerary(1, 5, 'base')).toBe(false);
      expect(thinItinerary(1, 1, 'loop')).toBe(false);
    });

    it('la reprise attend la fin du délai, et seul l’état « sans carte » attend', () => {
      const at = '2026-11-14T10:00:00.000Z';
      const t0 = Date.parse(at);
      const silent = { state: 'source_silent' as const, places: 1 };
      expect(sourceRetryDue(silent, at, t0 + 10_000)).toBe(false);
      expect(sourceRetryDue(silent, at, t0 + SOURCE_RETRY_AFTER_MS)).toBe(true);
      expect(sourceRetryDue(silent, undefined, t0 + 10_000_000)).toBe(false);
      expect(sourceRetryDue({ state: 'poor_zone', places: 1 }, at, t0)).toBe(true);
      expect(sourceRetryDue(undefined, at, t0)).toBe(true);
    });

    it('un état illisible dans les métadonnées est ignoré', () => {
      expect(readItinerary({ state: 'prête' })).toBeUndefined();
      expect(readItinerary('source_silent')).toBeUndefined();
      expect(readItinerary({ state: 'complete', places: -3, sources: ['a', 4] })).toEqual({ state: 'complete', places: 0, sources: ['a'] });
    });
  });
});
