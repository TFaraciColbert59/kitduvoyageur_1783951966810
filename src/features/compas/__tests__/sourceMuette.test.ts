import { readFileSync } from 'node:fs';
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
  /** Ce que « la carte » répond pour les objectifs de journée d'un séjour sur une base. */
  objectives: 'silent' as 'silent' | 'empty' | 'rich',
  objectiveAsks: 0,
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
// Objectifs de journée réels autour de Zakopane / Kościelisko (sommets, lacs, col, refuge), à moins de 11 km.
const OBJ = (id: number, name: string, kind: string, lat: number, lon: number, eleM: number | null, notable = false) => ({ id: `n9${id}`, name, kind, lat, lon, eleM, notable });
const OBJECTIVES = [
  OBJ(1, 'Giewont', 'peak', 49.2514, 19.9344, 1894, true),
  OBJ(2, 'Kasprowy Wierch', 'peak', 49.2319, 19.9817, 1987, true),
  OBJ(3, 'Czarny Staw Gąsienicowy', 'lake', 49.2339, 20.0049, 1624),
  OBJ(4, 'Hala Gąsienicowa', 'hut', 49.2437, 20.0023, 1500),
  OBJ(5, 'Przełęcz Zawrat', 'pass', 49.2197, 20.0036, 2159),
  OBJ(6, 'Nosal', 'peak', 49.2742, 19.9961, 1206),
];
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
  /** Objectifs de journée autour de la base : muets (null), répondus sans rien (liste vide) ou riches (sommets, lac, col). */
  lookupAreaObjectives: vi.fn(async (_base: unknown, _deadline: number, diag?: string[]) => {
    h.objectiveAsks += 1;
    if (h.objectives === 'silent') {
      diag?.push('Objectifs : Overpass muet');
      return null;
    }
    diag?.push(`Objectifs : Overpass ${h.objectives === 'rich' ? OBJECTIVES.length : 0}`);
    return h.objectives === 'rich' ? OBJECTIVES : [];
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
  h.objectives = 'silent';
  h.objectiveAsks = 0;
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
    // Séjour sur une base (rando) : la carte des objectifs est muette aussi, la trace des sources le dit.
    expect(readItinerary(autofill().itinerary)).toEqual({ state: 'source_silent', places: 1, objectives: 0, sources: ['Photon 2', 'Objectifs : Overpass muet'] });
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

  it('la carte a répondu mais la zone est pauvre (un seul lieu, itinéraire de lieu en lieu) : « zone pauvre », aucune reprise', async () => {
    // Un bivouac (nuits dehors) reste un itinéraire de lieu en lieu : le séjour sur une base ne s'applique pas.
    h.db.rows('trips')[0].primary_activity = 'bivouac';
    h.map = 'poor';
    const res = await launch();
    expect(res.success).toBe(true);
    if (!res.success || !('summary' in res)) throw new Error('résumé attendu');
    expect(steps()).toHaveLength(5);
    expect(res.summary.itinerary).toBe('poor_zone');
    expect(readItinerary(autofill().itinerary)?.state).toBe('poor_zone');
    expect(autofill().stagesFallback).toBeUndefined();
    expect(h.objectiveAsks).toBe(0);
    expect(res.summary.notes.some((n) => /La carte n’a pas répondu/.test(n))).toBe(false);
  });

  describe('séjour de randonnée sur une base (Tatras) : un objectif réel par journée', () => {
    it('la carte répond avec des objectifs : cinq journées différentes, chacune avec son objectif, sa distance et ses sources', async () => {
      h.map = 'poor';
      h.objectives = 'rich';
      const res = await launch();
      expect(res.success).toBe(true);
      if (!res.success || !('summary' in res)) throw new Error('résumé attendu');
      expect(steps()).toHaveLength(5);
      const titles = steps().map((s) => String(s.title));
      // Le constat : cinq fois « Jour N · Kościelisko ». Maintenant : « base → objectif → base », jamais deux fois le même.
      expect(new Set(titles).size).toBe(5);
      for (const [i, title] of titles.entries()) {
        expect(title).toMatch(new RegExp(`^Jour ${i + 1} · Kościelisko → .+ → Kościelisko$`));
        const objective = (steps()[i].metadata as { objective?: { name: string } }).objective;
        expect(OBJECTIVES.map((o) => o.name)).toContain(objective?.name);
        expect(title).toContain(objective?.name);
      }
      // Distance aller-retour estimée par le moteur (annoncée), jamais nulle.
      for (const s of steps()) {
        expect(Number(s.distance_km)).toBeGreaterThan(0);
        expect((s.metadata as { distance?: { source?: string } }).distance?.source).toBe('estimation');
        expect(String(s.description)).toContain('aller-retour');
      }
      // L'étiquette juste : ni zone pauvre, ni « incomplet faute de source ».
      expect(res.summary.itinerary).toBe('complete');
      expect(readItinerary(autofill().itinerary)).toMatchObject({ state: 'complete', places: 1, objectives: 5 });
      expect(readItinerary(autofill().itinerary)?.sources).toContain('Objectifs : Overpass 6');
      expect(autofill().stagesFallback).toBeUndefined();
      // La nuit reste à la base : le dernier lieu du titre (lu par `placeOfDay`) est la base, jamais l'objectif.
      expect(titles.every((x) => x.endsWith('→ Kościelisko'))).toBe(true);
    });

    it('la carte répond sans rien trouver autour de la base : « base seule, journées à compléter », pas « zone pauvre »', async () => {
      h.map = 'poor';
      h.objectives = 'empty';
      const res = await launch();
      expect(res.success).toBe(true);
      if (!res.success || !('summary' in res)) throw new Error('résumé attendu');
      expect(res.summary.itinerary).toBe('base_only');
      expect(readItinerary(autofill().itinerary)).toMatchObject({ state: 'base_only', objectives: 0 });
      expect(autofill().stagesFallback).toBeUndefined();
    });

    it('la carte des objectifs est muette : « incomplet faute de source » (reprise armée), jamais « zone pauvre »', async () => {
      h.map = 'poor';
      h.objectives = 'silent';
      const res = await launch();
      expect(res.success).toBe(true);
      if (!res.success || !('summary' in res)) throw new Error('résumé attendu');
      expect(res.summary.itinerary).toBe('source_silent');
      expect(autofill().stagesFallback).toBe(1);
      expect(readItinerary(autofill().itinerary)?.sources).toContain('Objectifs : Overpass muet');
    });

    it('nuits en refuge ou bivouac voulues : pas de séjour sur base, l’itinéraire de lieu en lieu reste le sien', async () => {
      const src = readFileSync(new URL('../server/autofillActions.ts', import.meta.url), 'utf8');
      expect(src).toMatch(/opts\.nights !== 'bivouac'[\s\S]{0,120}opts\.nights !== 'refuge'[\s\S]{0,120}opts\.nights !== 'mixte'/);
    });
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
