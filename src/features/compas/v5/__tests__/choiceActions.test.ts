import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeDb } from './fakeDb';

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb, denied: false }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));
vi.mock('../../server/compasServer', async (orig) => {
  const real = await orig<typeof import('../../server/compasServer')>();
  return {
    ...real,
    requireEditor: vi.fn(async (tripId: string) => {
      if (h.denied) return { error: 'Seuls les organisateurs et éditeurs peuvent modifier le kit.' };
      const trip = h.db.tables.trips.find((t) => t.id === tripId);
      if (!trip) return { error: 'Voyage introuvable ou non autorisé.' };
      return { supabase: h.db.client, userId: 'u1', trip, anonymous: false };
    }),
  };
});

import { compasV5SetStayAction, compasV5SetTransportAction } from '../server/choiceActions';
import type { V5StayOption } from '../types';

const TRIP = '11111111-1111-4111-8111-111111111111';
const SLUG = 'vercors-novembre';

const refuge: V5StayOption = {
  id: 'osm:4242',
  name: 'Refuge de la Coche',
  kind: 'refuge',
  lat: 45.003,
  lon: 5.401,
  distanceM: 340,
  elevationM: 1480,
  price: { perPerson: 58, currency: 'EUR', basis: 'bareme', asOf: '2026-10-01' },
  photo: null,
  source: 'OpenStreetMap · prix : repère du barème Compas 2026-10',
  url: null,
  partner: null,
};

function seed(): FakeDb {
  return createFakeDb({
    trips: [
      {
        id: TRIP,
        user_id: 'u1',
        start_date: '2026-11-03',
        party_size: 4,
        updated_at: '2026-10-22T09:00:00.000Z',
        metadata: { route_id: 12, compas: { prefs: { pace: 'tranquille' }, origin: { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR' } } },
      },
    ],
    trip_steps: [
      { id: 'st-1a', trip_id: TRIP, day_number: 1, order_index: 0, accommodation_name: null, metadata: null, updated_at: '2026-10-22T09:00:00.000Z' },
      { id: 'st-1b', trip_id: TRIP, day_number: 1, order_index: 1, accommodation_name: null, metadata: { note: 'garde-moi', compas: { other: 2 } }, updated_at: '2026-10-22T09:00:00.000Z' },
      { id: 'st-2a', trip_id: TRIP, day_number: 2, order_index: 0, accommodation_name: 'Gîte du Pré', metadata: null, updated_at: '2026-10-22T09:00:00.000Z' },
    ],
    trip_expenses: [
      { id: 'x-fuel', trip_id: TRIP, category: 'transport', is_planned: true, title: 'Carburant aller-retour (300 km)', amount: 70, metadata: { basis: 'b' } },
      { id: 'x-toll', trip_id: TRIP, category: 'transport', is_planned: true, title: 'Vignette suisse · 40 jours', amount: 45, metadata: {} },
      { id: 'x-site', trip_id: TRIP, category: 'transport', is_planned: true, title: 'Carburant sur place (120 km)', amount: 20, metadata: {} },
      { id: 'x-rent', trip_id: TRIP, category: 'transport', is_planned: true, title: 'Location de voiture · 3 jour(s)', amount: 150, metadata: {} },
      { id: 'x-real', trip_id: TRIP, category: 'transport', is_planned: false, title: 'Carburant aller-retour réel', amount: 66, metadata: {} },
      { id: 'x-food', trip_id: TRIP, category: 'nourriture', is_planned: true, title: 'Repas', amount: 200, metadata: {} },
    ],
  });
}

const stepOf = (id: string) => h.db.tables.trip_steps.find((s) => s.id === id)!;
const expenseIds = () => h.db.tables.trip_expenses.map((e) => e.id);
const writes = (table: string) => h.db.log.filter((l) => l.table === table);

beforeEach(() => {
  h.db = seed();
  h.denied = false;
});

describe('compasV5SetStayAction', () => {
  it('range le nom et le détail du choix sur la dernière étape du jour, sans écraser son JSON', async () => {
    expect(await compasV5SetStayAction({ tripId: TRIP, tripSlug: SLUG, day: 1, option: refuge })).toEqual({ success: true });
    const step = stepOf('st-1b');
    expect(step.accommodation_name).toBe('Refuge de la Coche');
    expect(step.metadata).toEqual({
      note: 'garde-moi',
      compas: {
        other: 2,
        stay: {
          id: 'osm:4242',
          name: 'Refuge de la Coche',
          kind: 'refuge',
          lat: 45.003,
          lon: 5.401,
          price: refuge.price,
          source: refuge.source,
          url: null,
          partner: null,
        },
      },
    });
    // La première étape du jour n'est pas touchée.
    expect(stepOf('st-1a').accommodation_name).toBeNull();
  });

  it('rejouer le même choix ne change rien (une seule écriture)', async () => {
    await compasV5SetStayAction({ tripId: TRIP, tripSlug: SLUG, day: 1, option: refuge });
    const before = JSON.stringify(h.db.tables.trip_steps);
    expect(await compasV5SetStayAction({ tripId: TRIP, tripSlug: SLUG, day: 1, option: refuge })).toEqual({ success: true });
    expect(writes('trip_steps')).toHaveLength(1);
    expect(JSON.stringify(h.db.tables.trip_steps)).toBe(before);
  });

  it('changer d’option remplace le détail, sans le cumuler', async () => {
    await compasV5SetStayAction({ tripId: TRIP, tripSlug: SLUG, day: 2, option: refuge });
    const noted: V5StayOption = { ...refuge, id: 'noted:Gîte du Pré', name: 'Gîte du Pré', kind: 'hebergement', price: null };
    await compasV5SetStayAction({ tripId: TRIP, tripSlug: SLUG, day: 2, option: noted });
    const step = stepOf('st-2a');
    expect(step.accommodation_name).toBe('Gîte du Pré');
    expect((step.metadata as { compas: { stay: { id: string } } }).compas.stay.id).toBe('noted:Gîte du Pré');
  });

  it('option null : efface le nom et le choix, garde le reste du JSON', async () => {
    await compasV5SetStayAction({ tripId: TRIP, tripSlug: SLUG, day: 1, option: refuge });
    expect(await compasV5SetStayAction({ tripId: TRIP, tripSlug: SLUG, day: 1, option: null })).toEqual({ success: true });
    const step = stepOf('st-1b');
    expect(step.accommodation_name).toBeNull();
    expect(step.metadata).toEqual({ note: 'garde-moi', compas: { other: 2 } });
  });

  it('effacer sur une étape sans rien : aucune écriture ; `compas` vide disparaît', async () => {
    expect(await compasV5SetStayAction({ tripId: TRIP, tripSlug: SLUG, day: 1, option: null })).toEqual({ success: true });
    expect(writes('trip_steps')).toHaveLength(0);
    await compasV5SetStayAction({ tripId: TRIP, tripSlug: SLUG, day: 2, option: refuge });
    await compasV5SetStayAction({ tripId: TRIP, tripSlug: SLUG, day: 2, option: null });
    expect(stepOf('st-2a').metadata).toEqual({});
  });

  it('un jour sans étape : message du Compas, rien d’écrit', async () => {
    expect(await compasV5SetStayAction({ tripId: TRIP, tripSlug: SLUG, day: 9, option: refuge })).toEqual({
      success: false,
      error: 'Aucune étape pour cette nuit.',
    });
    expect(h.db.log).toHaveLength(0);
  });

  it('droits : un lecteur ne modifie rien', async () => {
    h.denied = true;
    const res = await compasV5SetStayAction({ tripId: TRIP, tripSlug: SLUG, day: 1, option: refuge });
    expect(res.success).toBe(false);
    expect(h.db.log).toHaveLength(0);
  });

  it('écriture refusée par la base : message d’échec', async () => {
    h.db.failWrites.add('trip_steps');
    expect(await compasV5SetStayAction({ tripId: TRIP, tripSlug: SLUG, day: 1, option: refuge })).toEqual({
      success: false,
      error: 'Impossible d’enregistrer l’hébergement.',
    });
  });

  describe('validation (zod)', () => {
    const bad = async (patch: Record<string, unknown>) =>
      compasV5SetStayAction({ tripId: TRIP, tripSlug: SLUG, day: 1, option: { ...refuge, ...patch } as never });

    it('refuse les entrées invalides sans rien écrire', async () => {
      for (const patch of [
        { id: 'refuge-4242' },
        { id: 'osm:abc' },
        { id: 'noted:' },
        { name: '   ' },
        { name: 'x'.repeat(121) },
        { kind: 'palace' },
        { lat: 91 },
        { lon: -181 },
        { price: { perPerson: -1, currency: 'EUR', basis: 'bareme', asOf: '2026-10-01' } },
        { price: { perPerson: 10, currency: 'euro', basis: 'bareme', asOf: '2026-10-01' } },
        { price: { perPerson: 10, currency: 'EUR', basis: 'devine', asOf: '2026-10-01' } },
        { url: 'javascript:alert(1)' },
        { url: 'http://example.com' },
        { url: '//evil.example/x' },
        { source: 'x'.repeat(301) },
      ]) {
        expect((await bad(patch)).success, JSON.stringify(patch)).toBe(false);
      }
      expect(h.db.log).toHaveLength(0);
    });

    it('accepte un lien https et le relais d’affiliation du site', async () => {
      expect((await bad({ url: 'https://www.refuge-coche.example/reserver' })).success).toBe(true);
      expect((await bad({ url: '/go/refuge-coche', partner: 'Booking' })).success).toBe(true);
    });

    it('refuse un jour, un voyage ou un slug invalides', async () => {
      for (const input of [
        { tripId: 'pas-un-uuid', tripSlug: SLUG, day: 1, option: refuge },
        { tripId: TRIP, tripSlug: 'Pas Un Slug', day: 1, option: refuge },
        { tripId: TRIP, tripSlug: SLUG, day: 0, option: refuge },
        { tripId: TRIP, tripSlug: SLUG, day: 61, option: refuge },
        { tripId: TRIP, tripSlug: SLUG, day: 1.5, option: refuge },
        { tripId: TRIP, tripSlug: SLUG, day: 1 },
      ])
        expect((await compasV5SetStayAction(input as never)).success).toBe(false);
      expect(h.db.log).toHaveLength(0);
    });

    it('ignore les champs en trop (photo, distance) : ils ne sont pas rangés', async () => {
      await bad({ photo: { url: 'https://evil.example/x.jpg' }, distanceM: 1, extra: 'x' });
      const stay = (stepOf('st-1b').metadata as { compas: { stay: Record<string, unknown> } }).compas.stay;
      expect(Object.keys(stay).sort()).toEqual(['id', 'kind', 'lat', 'lon', 'name', 'partner', 'price', 'source', 'url']);
    });
  });
});

describe('compasV5SetTransportAction', () => {
  const train = { id: 'train', amountEur: 60, perPerson: true, source: 'barème Compas 2026-10 · train' } as const;

  it('train sans ligne au budget : la ligne est créée au tarif du groupe, les lignes voiture partent', async () => {
    expect(await compasV5SetTransportAction({ tripId: TRIP, tripSlug: SLUG, transport: train })).toEqual({ success: true });
    const created = h.db.tables.trip_expenses.find((e) => e.title === 'Train aller-retour × 4')!;
    expect(created).toMatchObject({ amount: 240, category: 'transport', is_planned: true, currency: 'EUR', payer_id: 'u1', split_type: 'equal' });
    expect(created.metadata).toMatchObject({ choice: 'train', basis: 'barème Compas 2026-10 · train' });
    // Carburant et vignette retirés ; le reste du budget n'est pas touché.
    expect(expenseIds()).not.toContain('x-fuel');
    expect(expenseIds()).not.toContain('x-toll');
    expect(expenseIds()).toEqual(expect.arrayContaining(['x-site', 'x-rent', 'x-real', 'x-food']));
  });

  it('le choix est rangé sur le voyage en fusionnant le JSON existant', async () => {
    await compasV5SetTransportAction({ tripId: TRIP, tripSlug: SLUG, transport: train });
    expect(h.db.tables.trips[0].metadata).toEqual({
      route_id: 12,
      compas: {
        prefs: { pace: 'tranquille' },
        origin: { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR' },
        transport: { id: 'train', amountEur: 60, perPerson: true, source: 'barème Compas 2026-10 · train' },
      },
    });
  });

  it('voiture avec ses lignes au budget : rien n’est créé, rien n’est retiré', async () => {
    const res = await compasV5SetTransportAction({
      tripId: TRIP,
      tripSlug: SLUG,
      transport: { id: 'car', amountEur: 115, perPerson: false, source: 'carburant' },
    });
    expect(res).toEqual({ success: true });
    expect(expenseIds()).toEqual(['x-fuel', 'x-toll', 'x-site', 'x-rent', 'x-real', 'x-food']);
    expect(writes('trip_expenses')).toHaveLength(0);
  });

  it('covoiturage : le budget ne compte plus de trajet d’approche, aucun prix n’est rangé', async () => {
    const res = await compasV5SetTransportAction({
      tripId: TRIP,
      tripSlug: SLUG,
      transport: { id: 'carpool', amountEur: null, perPerson: false, source: 'aucun tarif relevé' },
    });
    expect(res).toEqual({ success: true });
    expect(expenseIds()).toEqual(['x-site', 'x-rent', 'x-real', 'x-food']);
    expect(writes('trip_expenses').filter((w) => w.op === 'insert')).toHaveLength(0);
    expect((h.db.tables.trips[0].metadata as { compas: { transport: { amountEur: unknown } } }).compas.transport.amountEur).toBeNull();
  });

  it('à pied : zéro euro, aucune ligne', async () => {
    await compasV5SetTransportAction({
      tripId: TRIP,
      tripSlug: SLUG,
      transport: { id: 'foot', amountEur: 0, perPerson: false, source: 'ton choix' },
    });
    expect(expenseIds()).toEqual(['x-site', 'x-rent', 'x-real', 'x-food']);
  });

  it('repasser de « à pied » au train recrée la ligne depuis le choix envoyé (annulation possible)', async () => {
    await compasV5SetTransportAction({ tripId: TRIP, tripSlug: SLUG, transport: { id: 'foot', amountEur: 0, perPerson: false, source: 'x' } });
    await compasV5SetTransportAction({ tripId: TRIP, tripSlug: SLUG, transport: train });
    expect(h.db.tables.trip_expenses.filter((e) => e.title === 'Train aller-retour × 4')).toHaveLength(1);
  });

  it('idempotent : rejouer le même choix ne crée ni ne retire rien', async () => {
    await compasV5SetTransportAction({ tripId: TRIP, tripSlug: SLUG, transport: train });
    const expensesBefore = JSON.stringify(h.db.tables.trip_expenses);
    const tripWrites = writes('trips').length;
    expect(await compasV5SetTransportAction({ tripId: TRIP, tripSlug: SLUG, transport: train })).toEqual({ success: true });
    expect(JSON.stringify(h.db.tables.trip_expenses)).toBe(expensesBefore);
    expect(writes('trips')).toHaveLength(tripWrites);
  });

  it('la ligne écrite par un choix se reconnaît comme trajet d’approche (une autre option la remplace)', async () => {
    await compasV5SetTransportAction({ tripId: TRIP, tripSlug: SLUG, transport: train });
    await compasV5SetTransportAction({
      tripId: TRIP,
      tripSlug: SLUG,
      transport: { id: 'flight', amountEur: 150, perPerson: true, source: 'vol' },
    });
    const titles = h.db.tables.trip_expenses.map((e) => e.title);
    expect(titles).toContain('Vol aller-retour × 4');
    expect(titles).not.toContain('Train aller-retour × 4');
  });

  it('droits : un lecteur ne modifie rien', async () => {
    h.denied = true;
    expect((await compasV5SetTransportAction({ tripId: TRIP, tripSlug: SLUG, transport: train })).success).toBe(false);
    expect(h.db.log).toHaveLength(0);
  });

  it('métadonnées non écrites : la ligne créée à l’instant est retirée, le budget reste comme avant', async () => {
    h.db.failWrites.add('trips');
    const before = expenseIds();
    const res = await compasV5SetTransportAction({ tripId: TRIP, tripSlug: SLUG, transport: train });
    expect(res.success).toBe(false);
    expect(expenseIds()).toEqual(before);
  });

  it('budget en écriture refusée : échec net, le choix n’est pas rangé', async () => {
    h.db.failWrites.add('trip_expenses');
    const res = await compasV5SetTransportAction({ tripId: TRIP, tripSlug: SLUG, transport: train });
    expect(res).toEqual({ success: false, error: 'Erreur serveur' });
    expect((h.db.tables.trips[0].metadata as { compas: Record<string, unknown> }).compas.transport).toBeUndefined();
  });

  describe('validation (zod)', () => {
    const send = (transport: Record<string, unknown>) => compasV5SetTransportAction({ tripId: TRIP, tripSlug: SLUG, transport } as never);

    it('refuse les choix incohérents ou hors bornes', async () => {
      for (const t of [
        { id: 'bus', amountEur: 10, perPerson: true, source: 'x' },
        { id: 'rocket', amountEur: 10, perPerson: true, source: 'x' },
        { id: 'carpool', amountEur: 12, perPerson: false, source: 'x' },
        { id: 'car', amountEur: null, perPerson: false, source: 'x' },
        { id: 'train', amountEur: -5, perPerson: true, source: 'x' },
        { id: 'train', amountEur: 1e9, perPerson: true, source: 'x' },
        { id: 'train', amountEur: Number.NaN, perPerson: true, source: 'x' },
        { id: 'foot', amountEur: 5, perPerson: false, source: 'x' },
        { id: 'train', amountEur: 10, perPerson: 'oui', source: 'x' },
        { id: 'train', amountEur: 10, perPerson: true, source: 'x'.repeat(401) },
      ])
        expect((await send(t)).success, JSON.stringify(t)).toBe(false);
      expect(h.db.log).toHaveLength(0);
    });

    it('refuse un voyage ou un slug invalides', async () => {
      expect((await compasV5SetTransportAction({ tripId: 'x', tripSlug: SLUG, transport: train })).success).toBe(false);
      expect((await compasV5SetTransportAction({ tripId: TRIP, tripSlug: '../etc', transport: train })).success).toBe(false);
    });
  });
});
