import { describe, expect, it, vi } from 'vitest';

/**
 * Préférence « sans voiture » (PLAN-100 4.4) : comprise dans la phrase, rangée
 * comme les autres réglages du projet, puis suivie par le trajet d'approche, les
 * déplacements entre étapes et le budget. « Transports en commun » ne se dit que
 * quand la zone en montre (gare, gare routière, embarcadère lus sur la carte).
 */
const h = vi.hoisted(() => ({ meta: {} as Record<string, unknown> }));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
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
        title: 'Rando · Vercors',
        start_date: null,
        end_date: null,
        party_size: 1,
        budget_currency: 'EUR',
        metadata: h.meta,
      },
    })),
    updateTripMetadata: vi.fn(async (_s: unknown, _id: string, patch: (m: Record<string, unknown>) => Record<string, unknown>) => {
      h.meta = patch(h.meta);
      return { metadata: h.meta, error: null };
    }),
  };
});

import { nearestAirportIn, type AirportRow } from '../engine/airports';
import {
  CAR_FREE_CONFLICT_NOTE,
  carFreeOf,
  carFreeStages,
  carFreeStagesNote,
  transitSignal,
} from '../engine/carFree';
import { buildCompasModel, type CompasInput, type CompasPreferences } from '../engine/compasModel';
import { projectBasis, staleParts } from '../engine/dependencies';
import { actionLabel, groundingIssue, parseIntentRules, planApplication, intentActionSchema, type ApplyCurrent } from '../engine/intent';
import { readCompasMeta } from '../engine/meta';
import { understandRequest } from '../engine/request';
import {
  CAR_FREE_NO_LEG_PREFIX,
  planTravelLeg,
  travelOrigin,
  type CarRouteResult,
  type TravelDeps,
  type TravelLegInput,
  type TravelPoint,
} from '../engine/travel';
import { compasSetPreferencesAction } from '../server/compasActions';

const TODAY = '2026-10-11';
const CAR_FREE = { type: 'set_car_free' } as const;

describe('comprise dans la phrase', () => {
  it.each([
    '3 jours dans le Vercors sans voiture',
    'rando en Ardèche, sans la voiture',
    'week-end à Bruges sans louer de voiture',
    'trek au Japon, pas de voiture',
    'une semaine en Sicile sans véhicule',
    'Lisbonne en transports en commun',
    'a week in Wales without a car',
    'city trip car-free à Berlin',
  ])('« %s » : sans voiture', (phrase) => {
    const actions = parseIntentRules(phrase, TODAY);
    expect(actions).toContainEqual(CAR_FREE);
    // Pas aussi une chose « à éviter » : un seul réglage.
    expect(actions.filter((a) => a.type === 'avoid')).toEqual([]);
  });

  it('une phrase sans cela ne pose rien ; « sans bivouac » reste à éviter', () => {
    expect(parseIntentRules('3 jours dans le Vercors', TODAY)).not.toContainEqual(CAR_FREE);
    const actions = parseIntentRules('3 jours dans le Vercors sans bivouac', TODAY);
    expect(actions).not.toContainEqual(CAR_FREE);
    expect(actions).toContainEqual({ type: 'avoid', label: 'bivouac' });
  });

  it('« village sans voiture » décrit un lieu, pas une préférence', () => {
    expect(parseIntentRules('Zermatt, village sans voiture, 2 jours', TODAY)).not.toContainEqual(CAR_FREE);
    expect(parseIntentRules('une station sans voiture en Suisse', TODAY)).not.toContainEqual(CAR_FREE);
  });

  it('sans voiture et autre chose à éviter dans la même phrase : les deux', () => {
    const actions = parseIntentRules('Vercors sans foule, sans voiture', TODAY);
    expect(actions).toContainEqual(CAR_FREE);
    expect(actions).toContainEqual({ type: 'avoid', label: 'foule' });
  });

  it('l’IA ne pose « sans voiture » que si la phrase le dit', () => {
    expect(groundingIssue(CAR_FREE, '3 jours en Ardèche')).toBe('Sans voiture absent de ta phrase');
    expect(groundingIssue(CAR_FREE, '3 jours en Ardèche sans voiture')).toBeNull();
    expect(groundingIssue(CAR_FREE, 'Lisbonne en transports en commun')).toBeNull();
    expect(intentActionSchema.safeParse(CAR_FREE).success).toBe(true);
  });

  it('« voici ce que j’ai compris » le montre, comme compris', () => {
    const lines = understandRequest('3 jours dans le Vercors sans voiture', TODAY).lines;
    expect(lines.find((l) => l.key === 'deplacements')).toEqual({
      key: 'deplacements',
      label: 'Déplacements',
      value: 'Sans voiture : train, bus, vélo ou à pied',
      state: 'compris',
    });
    expect(understandRequest('3 jours dans le Vercors', TODAY).lines.some((l) => l.key === 'deplacements')).toBe(false);
  });

  it('un libellé clair', () => {
    expect(actionLabel(CAR_FREE)).toBe('Sans voiture : train, bus, vélo ou à pied');
  });
});

describe('rangée comme les autres réglages', () => {
  const prefs = (over: Partial<CompasPreferences> = {}): CompasPreferences => ({
    pace: 'normal',
    nights: null,
    avoid: [],
    wishes: [],
    ...over,
  });
  const current = (p: CompasPreferences): ApplyCurrent => ({
    startDate: null,
    endDate: null,
    days: null,
    shortHours: null,
    preferences: p,
    hasRoute: false,
  });

  it('l’application garde les autres réglages et pose carFree', () => {
    const ops = planApplication([CAR_FREE, { type: 'wish', label: 'lac' }], current(prefs({ pace: 'tranquille', avoid: ['foule'] })));
    expect(ops).toEqual([
      { op: 'prefs', preferences: { pace: 'tranquille', nights: null, avoid: ['foule'], wishes: ['lac'], carFree: true } },
    ]);
  });

  it('un autre réglage ensuite ne retire pas « sans voiture »', () => {
    const ops = planApplication([{ type: 'set_pace', pace: 'soutenu' }], current(prefs({ carFree: true })));
    expect(ops).toEqual([{ op: 'prefs', preferences: { pace: 'soutenu', nights: null, avoid: [], wishes: [], carFree: true } }]);
  });

  it('la lecture des réglages rangés (défensive)', () => {
    const read = (carFree: unknown) => readCompasMeta({ compas: { prefs: { pace: 'normal', carFree } } }).preferences?.carFree;
    expect(read(true)).toBe(true);
    expect(read(false)).toBeNull();
    expect(read('oui')).toBeNull();
    expect(read(1)).toBeNull();
    expect(read(undefined)).toBeNull();
  });

  it('l’écriture accepte carFree et le garde (rien n’est perdu en route)', async () => {
    h.meta = { compas: { prefs: { pace: 'tranquille' } } };
    const res = await compasSetPreferencesAction({
      tripId: '11111111-1111-4111-8111-111111111111',
      tripSlug: 'x',
      preferences: { pace: 'tranquille', nights: null, avoid: [], wishes: [], carFree: true },
    });
    expect(res).toEqual({ success: true });
    expect(((h.meta.compas as Record<string, unknown>).prefs as Record<string, unknown>).carFree).toBe(true);
  });

  const model = (preferences: Partial<CompasPreferences> | null) =>
    buildCompasModel({
      trip: {
        id: 't1',
        slug: 'vercors',
        title: 'Vercors',
        destinationName: 'Vercors',
        startDate: '2026-10-12',
        endDate: '2026-10-14',
        primaryActivity: 'hiking',
        estimatedBudget: null,
        budgetCurrency: 'EUR',
        partySize: 1,
        ownerId: 'u1',
        preferences,
      },
      steps: [],
      items: [],
      members: [],
      expenses: [],
      inventory: [],
      bookings: [],
      weather: [],
      routeDurationMin: null,
      routeHasGeometry: false,
      waterPointsCount: null,
      viewerId: 'u1',
      now: new Date('2026-09-30T12:00:00Z'),
      timeZone: 'Europe/Paris',
    } as CompasInput);

  it('le modèle de l’écran le garde : changer une envie ne l’efface pas', () => {
    expect(model({ pace: 'normal', carFree: true }).preferences.carFree).toBe(true);
    expect(model({ pace: 'normal' }).preferences.carFree).toBeUndefined();
  });

  it('le changer réadapte l’itinéraire, le trajet et le budget', () => {
    const base = {
      anchor: null,
      destinationName: 'Vercors',
      days: 3,
      hours: null,
      startDate: null,
      activity: 'hiking',
      partySize: 1,
    };
    const before = projectBasis({ ...base, prefs: { pace: 'normal' } });
    const now = projectBasis({ ...base, prefs: { pace: 'normal', carFree: true } });
    expect(now.carFree).toBe('oui');
    expect(before.carFree).toBeNull();
    expect(staleParts(before, now)).toEqual(['steps', 'nights', 'transport', 'budget']);
    // Une empreinte d'avant cette version n'est pas un changement.
    const { carFree: _old, ...legacy } = before;
    void _old;
    expect(staleParts(legacy, projectBasis({ ...base, prefs: { pace: 'normal' } }))).toEqual([]);
  });
});

describe('quand s’applique-t-elle', () => {
  it('seulement si elle est posée, et pas pour un road trip ou un van (dit)', () => {
    expect(carFreeOf(null, 'hiking')).toEqual({ on: false, note: null });
    expect(carFreeOf({ carFree: null }, 'hiking')).toEqual({ on: false, note: null });
    expect(carFreeOf({ carFree: true }, 'hiking')).toEqual({ on: true, note: null });
    for (const activity of ['roadtrip', 'vanlife'])
      expect(carFreeOf({ carFree: true }, activity)).toEqual({ on: false, note: CAR_FREE_CONFLICT_NOTE });
    // Pas de conflit à dire quand la préférence n'est pas posée.
    expect(carFreeOf({ carFree: null }, 'roadtrip')).toEqual({ on: false, note: null });
    expect(CAR_FREE_CONFLICT_NOTE).toMatch(/road trip/);
  });

  it('les déplacements entre étapes en voiture passent en bus, le reste est inchangé', () => {
    const stages = [
      { day: 1, move: 'aucun', name: 'A' },
      { day: 2, move: 'voiture', name: 'B' },
      { day: 3, move: 'marche', name: 'C' },
      { day: 4, move: 'voiture', name: 'D' },
      { day: 5, move: 'velo', name: 'E' },
    ];
    const out = carFreeStages(stages);
    expect(out.converted).toBe(2);
    expect(out.stages.map((s) => s.move)).toEqual(['aucun', 'bus', 'marche', 'bus', 'velo']);
    expect(stages[1].move).toBe('voiture');
    expect(carFreeStages([{ move: 'marche' }]).converted).toBe(0);
    expect(carFreeStagesNote(0)).toBeNull();
    expect(carFreeStagesNote(1)).toMatch(/^Sans voiture : 1 déplacement entre étapes compté en bus \(estimation/);
    expect(carFreeStagesNote(2)).toMatch(/2 déplacements entre étapes comptés en bus/);
  });
});

describe('« transports en commun » seulement quand la zone en montre', () => {
  const gare = { category: 'transport', name: 'Gare de Die', distanceM: 400 };
  const resto = { category: 'resto', name: 'Chez Paul', distanceM: 100 };

  it('une gare repérée : on le dit, avec son nom', () => {
    const s = transitSignal({ pois: [resto, gare, { category: 'transport', name: 'Gare routière', distanceM: 900 }], complete: true });
    expect(s.status).toBe('reperes');
    expect(s.text).toMatch(/^Transports en commun : /);
    expect(s.text).toContain('Gare de Die');
    expect(s.text).toContain('Résa · Trajets');
  });

  it('un point sans nom garde sa catégorie, jamais un nom inventé', () => {
    const s = transitSignal({ pois: [{ category: 'transport', name: null, distanceM: 300 }], complete: true });
    expect(s.status).toBe('reperes');
    expect(s.text).not.toContain('null');
  });

  it('rien repéré : « non évalué », jamais « il n’y en a pas »', () => {
    const s = transitSignal({ pois: [resto], complete: true });
    expect(s.status).toBe('non_evalue');
    expect(s.text).toMatch(/non évalués/);
    expect(s.text).toMatch(/arrêts de bus/);
    expect(s.text).not.toMatch(/aucun transport/i);
  });

  it('pas encore lus (cache vide, lecture partielle) : non évalué, et le dit', () => {
    expect(transitSignal({ pois: null, complete: false }).status).toBe('non_evalue');
    const s = transitSignal({ pois: [resto], complete: false });
    expect(s.status).toBe('non_evalue');
    expect(s.text).toMatch(/pas encore lues/);
    // Une gare trouvée dans une lecture partielle reste une gare trouvée.
    expect(transitSignal({ pois: [gare], complete: false }).status).toBe('reperes');
  });
});

/* ---------- Le trajet d'approche ---------- */

const ROWS: AirportRow[] = [
  ['LYS', 'Lyon Saint-Exupéry Airport', 45.726, 5.09, 'FR', 'L'],
  ['BIQ', 'Biarritz Pays Basque Airport', 43.468, -1.523, 'FR', 'L'],
  ['AJA', 'Ajaccio Napoléon Bonaparte airport', 41.924, 8.803, 'FR', 'M'],
  ['GVA', 'Geneva International Airport', 46.238, 6.109, 'CH', 'L'],
];
const LYON = { name: 'Lyon', lat: 45.76, lon: 4.84, countryCode: 'FR' };
const VERCORS = { lat: 45.07, lon: 5.55 };

function deps(car: CarRouteResult) {
  const calls: TravelPoint[][] = [];
  const d: TravelDeps = {
    carRoute: async (from, to) => {
      calls.push([from, to]);
      return car;
    },
    walkKm: async () => 0,
    airport: (p, country) => nearestAirportIn(ROWS, p.lat, p.lon, { country }),
  };
  return { d, calls };
}
const input = (over: Partial<TravelLegInput>): TravelLegInput => ({
  origin: travelOrigin(LYON, null),
  target: VERCORS,
  destination: { name: 'Vercors', countryCode: 'FR' },
  days: 3,
  party: 2,
  transport: true,
  carFree: true,
  ...over,
});

describe('sans voiture : le trajet d’approche', () => {
  it('Lyon → Vercors (moins de 150 km) : ni voiture ni train chiffrés, la note le dit, aucun calcul de route', async () => {
    const { d, calls } = deps({ km: 120, minutes: 95, end: null });
    const leg = await planTravelLeg(input({}), d);
    expect(leg).toMatchObject({ transport: null, carFuel: null, train: null, flight: null, originUnknown: false });
    expect(leg.notes).toHaveLength(1);
    expect(leg.notes[0].startsWith(CAR_FREE_NO_LEG_PREFIX)).toBe(true);
    expect(leg.notes[0]).toMatch(/pas chiffré/);
    expect(leg.notes[0]).toMatch(/Résa · Trajets/);
    expect(calls).toEqual([]);
  });

  it('la même demande avec la voiture ne change pas', async () => {
    const { d } = deps({ km: 120, minutes: 95, end: null });
    const leg = await planTravelLeg(input({ carFree: false }), d);
    expect(leg.transport?.mode).toBe('voiture');
    expect(leg.carFuel).not.toBeNull();
  });

  it('Lyon → Bruxelles en 6 jours : le train, là où la voiture aurait gagné', async () => {
    const { d } = deps({ km: 680, minutes: 430, end: null });
    const where = { target: { lat: 50.85, lon: 4.35 }, destination: { name: 'Bruxelles', countryCode: 'BE' }, days: 6 };
    expect((await planTravelLeg(input({ ...where, carFree: false }), d)).transport?.mode).toBe('voiture');
    const leg = await planTravelLeg(input(where), d);
    expect(leg.transport).toMatchObject({ mode: 'train', departure: 'Lyon' });
    expect(leg.carFuel).toBeNull();
    expect(leg.train?.priceSource).toBe('estimation');
  });

  it('Lyon → Paris en 5 jours : le train aussi', async () => {
    const { d } = deps({ km: 465, minutes: 270, end: null });
    const leg = await planTravelLeg(input({ target: { lat: 48.86, lon: 2.35 }, destination: { name: 'Paris', countryCode: 'FR' }, days: 5 }), d);
    expect(leg.transport?.mode).toBe('train');
  });

  it('trop loin pour la durée, sans train possible (île) : l’avion, comme avec la voiture', async () => {
    // Annecy → Ajaccio en 3 jours : 14 h de route et de ferry, la Corse n'a pas de train depuis le continent.
    const { d } = deps({ km: 700, minutes: 840, end: null });
    const where = {
      origin: travelOrigin({ name: 'Annecy', lat: 45.9, lon: 6.12, countryCode: 'FR' }, null),
      target: { lat: 41.92, lon: 8.74 },
      destination: { name: 'Ajaccio', countryCode: 'FR' },
      days: 3,
    };
    const leg = await planTravelLeg(input(where), d);
    expect(leg.train).toBeNull();
    expect(leg.carFuel).toBeNull();
    expect(leg.transport).toMatchObject({ mode: 'avion' });
    expect(leg.transport?.route).toMatch(/→ AJA$/);
    expect(leg.transport?.basis).toMatch(/^14 h de route à l’aller pour 3 jours : vol aller-retour/);
  });

  it('Genève → Biarritz en 3 jours : l’avion directement, comme avec la voiture', async () => {
    const { d } = deps({ km: 900, minutes: 560, end: null });
    const where = {
      origin: travelOrigin({ name: 'Genève', lat: 46.2, lon: 6.14, countryCode: 'CH' }, null),
      target: { lat: 43.48, lon: -1.56 },
      destination: { name: 'Biarritz', countryCode: 'FR' },
      days: 3,
    };
    expect((await planTravelLeg(input(where), d)).transport).toMatchObject({ mode: 'avion', route: 'GVA → BIQ' });
    expect((await planTravelLeg(input({ ...where, carFree: false }), d)).transport).toMatchObject({ mode: 'avion', route: 'GVA → BIQ' });
  });

  it('route non calculée et destination proche : la note, jamais une route estimée en voiture', async () => {
    const { d } = deps({ failure: 'provider_unavailable' });
    const leg = await planTravelLeg(input({ target: { lat: 48.86, lon: 2.35 }, destination: { name: 'Paris', countryCode: 'FR' }, days: 5 }), d);
    expect(leg.carFuel).toBeNull();
    expect(leg.transport).toBeNull();
    expect(leg.notes.some((n) => n.startsWith(CAR_FREE_NO_LEG_PREFIX))).toBe(true);
    expect(leg.notes.join(' ')).not.toMatch(/en voiture estimé/);
  });

  it('une sortie de quelques heures, sans module trajet : pas de temps de route estimé', async () => {
    const { d } = deps({ km: 300, minutes: 200, end: null });
    const leg = await planTravelLeg(
      input({
        transport: false,
        days: 1,
        origin: travelOrigin({ name: 'Annecy', lat: 45.9, lon: 6.12, countryCode: 'FR' }, null),
        target: { lat: 44.2, lon: 6.9 },
      }),
      d
    );
    expect(leg.notes).toEqual([]);
    // Avec la voiture, la journée trop loin est signalée comme avant.
    const withCar = await planTravelLeg(
      input({
        carFree: false,
        transport: false,
        days: 1,
        origin: travelOrigin({ name: 'Annecy', lat: 45.9, lon: 6.12, countryCode: 'FR' }, null),
        target: { lat: 44.2, lon: 6.9 },
      }),
      d
    );
    expect(withCar.notes.length).toBe(1);
  });

  it('Japon : le Shinkansen comme sans cette préférence', async () => {
    const { d } = deps({ km: 510, minutes: 380, end: null });
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin({ name: 'Tokyo', lat: 35.68, lon: 139.69, countryCode: 'JP' }, null),
        target: { lat: 34.69, lon: 135.5 },
        destination: { name: 'Osaka', countryCode: 'JP' },
        days: 3,
      }),
      d
    );
    expect(leg.transport?.mode).toBe('train');
  });

  it('sans point de départ : rien n’est chiffré, et rien ne parle de voiture', async () => {
    const { d } = deps({ km: 120, minutes: 95, end: null });
    const leg = await planTravelLeg(input({ origin: null }), d);
    expect(leg.originUnknown).toBe(true);
    expect(leg.notes.some((n) => n.startsWith(CAR_FREE_NO_LEG_PREFIX))).toBe(false);
  });
});
