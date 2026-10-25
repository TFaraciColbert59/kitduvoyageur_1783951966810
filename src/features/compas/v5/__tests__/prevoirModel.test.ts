import { describe, expect, it } from 'vitest';
import {
  bookingTotals,
  buyEntries,
  buyTotals,
  formatDistance,
  haversineM,
  liveBookings,
  manualStay,
  nearestRouteShop,
  nightCards,
  nightDays,
  reservationSteps,
  safeUrl,
  sandboxProviders,
  transportCost,
  transportViews,
} from '../model/prevoir';
import { EMPTY_EXTRAS, type V5Extras, type V5StayOption, type V5TransportOption } from '../types';
import { makeData, makeInput } from './fixtures';
import { buildCompasModel } from '../../engine/compasModel';

function stay(p: Partial<V5StayOption> & { id: string; name: string }): V5StayOption {
  return {
    kind: 'hebergement',
    lat: 45,
    lon: 5.4,
    distanceM: 300,
    elevationM: null,
    price: null,
    photo: null,
    source: 'OpenStreetMap',
    url: null,
    partner: null,
    ...p,
  };
}

const gite = stay({ id: 'osm:1', name: 'Gîte du Royans', price: { perPerson: 38, currency: 'EUR', basis: 'bareme', asOf: '2026-10-20' }, url: 'https://gites.example/royans' });
const refuge = stay({ id: 'osm:2', name: 'Refuge de la Molière', kind: 'refuge', distanceM: 4000, price: { perPerson: 24, currency: 'EUR', basis: 'partenaire', asOf: '2026-10-21' }, partner: 'Refuges.info', url: 'https://refuges.example/moliere' });
const camping = stay({ id: 'osm:3', name: 'Camping des Écouges', kind: 'camping', distanceM: 2500 });

const car: V5TransportOption = { id: 'car', label: 'Voiture', detail: '1 h 45 depuis Lyon', amountEur: 64, perPerson: false, source: 'barème carburant', url: null, partner: null };
const train: V5TransportOption = { id: 'train', label: 'Train et bus', detail: null, amountEur: 19, perPerson: true, source: 'SNCF', url: 'https://sncf.example', partner: 'SNCF' };
const bus: V5TransportOption = { id: 'bus', label: 'Car', detail: null, amountEur: null, perPerson: true, source: 'Flixbus', url: null, partner: null };

const extras = (nights: V5Extras['nights'], transport: V5TransportOption[] = []): V5Extras => ({ ...EMPTY_EXTRAS, fetchedAt: '2026-10-22T10:00:00Z', nights, transport });

describe('nightDays / nightCards', () => {
  it('une nuit par jour sauf le dernier ; aucun pour un voyage d’un jour', () => {
    const model = makeData().model;
    expect(nightDays(model.route.dayPlans).map((d) => d.day)).toEqual([1, 2]);
    const oneDay = buildCompasModel(makeInput({ steps: [makeInput().steps[0]] }));
    expect(nightDays(oneDay.route.dayPlans)).toEqual([]);
  });

  it('sans choix : la mieux placée est montrée, rien n’est choisi', () => {
    const data = makeData({ steps: makeInput().steps.map((s) => ({ ...s, accommodationName: null })) });
    const cards = nightCards(data.model, extras({ 1: [gite, camping], 2: [refuge] }));
    expect(cards.map((c) => [c.day, c.state, c.chosen])).toEqual([
      [1, 'to-choose', null],
      [2, 'to-choose', null],
    ]);
    expect(cards[0].shown?.id).toBe('osm:1');
    expect(cards[0].options).toHaveLength(2);
  });

  it('la nuit déjà notée est reconnue dans la liste (casse et accents ignorés)', () => {
    const data = makeData({ steps: makeInput().steps.map((s) => (s.dayNumber === 1 ? { ...s, accommodationName: 'GITE du royans' } : s)) });
    const cards = nightCards(data.model, extras({ 1: [camping, gite] }));
    expect(cards[0].chosen?.id).toBe('osm:1');
    expect(cards[0].shown?.id).toBe('osm:1');
    expect(cards[0].state).toBe('to-confirm');
    expect(cards[0].options.map((o) => o.id)).toEqual(['osm:3', 'osm:1']);
  });

  it('une nuit notée à la main reste affichée, sans prix, photo ni distance inventés', () => {
    const data = makeData();
    const cards = nightCards(data.model, extras({ 1: [camping] }));
    const first = cards[0];
    expect(first.chosen?.name).toBe('Gîte du Royans');
    expect(first.chosen?.manual).toBe(true);
    expect(first.chosen?.price).toBeNull();
    expect(first.chosen?.photo).toBeNull();
    expect(first.chosen?.distanceM).toBeNull();
    expect(first.options.map((o) => o.name)).toEqual(['Gîte du Royans', 'Camping des Écouges']);
  });

  it('la proposition « Hébergement à réserver » n’est jamais une nuit choisie', () => {
    const data = makeData({ steps: makeInput().steps.map((s) => ({ ...s, accommodationName: 'Hébergement à réserver · Rencurel' })) });
    const cards = nightCards(data.model, EMPTY_EXTRAS);
    expect(cards.every((c) => c.chosen === null && c.shown === null && c.options.length === 0)).toBe(true);
  });

  it('manualStay renvoie une option identifiable (noted:<nom>) pour l’écriture', () => {
    const v = manualStay('Chez Marie', 45.1, 5.5);
    expect(v.option.id).toBe('noted:Chez Marie');
    expect(v.option.lat).toBe(45.1);
    expect(v.distanceM).toBeNull();
  });
});

describe('transport', () => {
  it('coût du groupe : total tel quel, par personne multiplié, inconnu laissé inconnu', () => {
    expect(transportCost(car, 4)).toBe(64);
    expect(transportCost(train, 4)).toBe(76);
    expect(transportCost(bus, 4)).toBeNull();
    expect(transportViews([car, train, bus], 2).map((v) => v.costEur)).toEqual([64, 38, null]);
  });
});

describe('bookingTotals', () => {
  const data = makeData();
  const chosenCards = (...picked: Array<[number, V5StayOption]>) =>
    nightCards(data.model, extras(Object.fromEntries(picked.map(([d, o]) => [d, [o]])))).map((c) => ({ ...c, chosen: c.options[0] ?? null }));

  it('additionne les nuits par personne × groupe et le trajet, sans mélanger les devises', () => {
    const cards = chosenCards([1, gite], [2, refuge]);
    const t = bookingTotals(cards, transportViews([car], 4)[0], 4);
    expect(t.nightsTotalEur).toBe((38 + 24) * 4);
    expect(t.transportTotalEur).toBe(64);
    expect(t.total).toBe(248 + 64);
    expect(t.currency).toBe('EUR');
    expect(t.perPerson).toBe(78);
    expect(t.hasHints).toBe(true);
    expect(t.unpriced).toBe(0);
    expect(t.chosenCount).toBe(3);

    const chf = stay({ id: 'x', name: 'Hütte', price: { perPerson: 30, currency: 'CHF', basis: 'partenaire', asOf: '2026-10-22' } });
    const mixed = bookingTotals(chosenCards([1, gite], [2, chf]), null, 2);
    expect(mixed.total).toBeNull();
    expect(mixed.byCurrency).toEqual({ EUR: 76, CHF: 60 });
  });

  it('compte les choix sans prix au lieu de les compter zéro', () => {
    const cards = chosenCards([1, gite], [2, camping]);
    const t = bookingTotals(cards, transportViews([bus], 4)[0], 4);
    expect(t.unpriced).toBe(2);
    expect(t.total).toBe(152);
    expect(t.chosenCount).toBe(3);
  });

  it('rien de choisi : pas de total', () => {
    const t = bookingTotals(nightCards(data.model, extras({ 1: [gite] })).map((c) => ({ ...c, chosen: null })), null, 4);
    expect(t.chosenCount).toBe(0);
    expect(t.total).toBeNull();
    expect(t.perPerson).toBeNull();
  });
});

describe('« Tout réserver » : les liens, un par un', () => {
  it('ne liste que les choix, dans l’ordre du voyage, avec leur lien et leur partenaire', () => {
    const data = makeData();
    const cards = nightCards(data.model, extras({ 1: [gite], 2: [refuge] })).map((c) => ({ ...c, chosen: c.options[0] ?? null }));
    const steps = reservationSteps(cards, transportViews([train], 4)[0]);
    expect(steps.map((s) => [s.key, s.url, s.partner])).toEqual([
      ['night:1', 'https://gites.example/royans', null],
      ['night:2', 'https://refuges.example/moliere', 'Refuges.info'],
      ['transport:train', 'https://sncf.example', 'SNCF'],
    ]);
    expect(reservationSteps(cards.map((c) => ({ ...c, chosen: null })), null)).toEqual([]);
  });
  it('seul le https est ouvrable', () => {
    expect(safeUrl('https://a.example')).toBe('https://a.example');
    expect(safeUrl('http://a.example')).toBeNull();
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl(null)).toBeNull();
  });
});

describe('réservations réelles et mode test', () => {
  it('écarte les réservations annulées, expirées, échouées ou remboursées', () => {
    const rows = ['confirmed', 'pending', 'cancelled', 'expired', 'failed', 'refunded', 'draft'].map((status, i) => ({ id: String(i), vertical: 'hotel', provider: 'routestack', status, amountEur: 10 }));
    expect(liveBookings(rows).map((b) => b.status)).toEqual(['confirmed', 'pending', 'draft']);
  });
  it('signale chaque fournisseur en mode test', () => {
    expect(sandboxProviders({ routestack: 'sandbox', viator: 'live' })).toEqual(['routestack']);
    expect(sandboxProviders({ routestack: 'sandbox', viator: 'sandbox' })).toEqual(['routestack', 'viator']);
    expect(sandboxProviders({ routestack: 'disabled', viator: 'live' })).toEqual([]);
  });
});

describe('magasin sur la route', () => {
  const data = makeData();
  it('haversine : ordre de grandeur et zéro', () => {
    expect(haversineM(45, 5.4, 45, 5.4)).toBe(0);
    expect(haversineM(45, 5.4, 45.01, 5.4)).toBeGreaterThan(1000);
    expect(haversineM(45, 5.4, 45.01, 5.4)).toBeLessThan(1200);
  });
  it('choisit le commerce repéré le plus proche d’une arrivée, rien sans commerce', () => {
    const points = [
      ...data.points,
      { id: 'p1', lat: 45.001, lon: 5.4, label: 'Épicerie du village', category: 'commerce', kind: 'poi' as const },
      { id: 'p2', lat: 45.3, lon: 5.9, label: 'Loin', category: 'commerce', kind: 'poi' as const },
      { id: 'p3', lat: 45.0, lon: 5.4, label: 'Fontaine', category: 'eau', kind: 'poi' as const },
    ];
    const shop = nearestRouteShop(points, data.model.route.dayPlans);
    expect(shop?.label).toBe('Épicerie du village');
    expect(shop?.day).toBe(1);
    expect(shop?.distanceM).toBeLessThan(200);
    expect(nearestRouteShop(data.points, data.model.route.dayPlans)).toBeNull();
  });
  it('formatDistance : mètres sous le kilomètre, kilomètres au-delà', () => {
    expect(formatDistance('fr', 300)).toBe('300 m');
    expect(formatDistance('fr', 2500)).toBe('2,5 km');
    expect(formatDistance('en', 2500)).toBe('2.5 km');
  });
});

describe('À acheter', () => {
  it('liste les objets à acheter avec le produit réel de la boutique, vitaux d’abord, et leur total', () => {
    const data = makeData();
    const entries = buyEntries(data.model.kit.lines, data.shop, data.viewerId);
    expect(entries.map((e) => e.line.name)).toContain('Trousse de secours');
    const trousse = entries.find((e) => e.line.name === 'Trousse de secours');
    expect(trousse?.product?.name).toBe('Trousse de secours randonnée');
    expect(trousse?.priceEur).toBe(24.9);
    expect(trousse?.stage).toBe('needed');
    expect(entries[0].line.vital).toBe(true);
    const totals = buyTotals(entries);
    expect(totals.count).toBe(entries.length);
    expect(totals.boutiqueEur).toBe(24.9);
    expect(totals.pricedCount).toBe(1);
    expect(totals.unpricedCount).toBe(entries.length - 1);
  });
  it('un objet déjà déclaré (« added ») n’est plus à acheter', () => {
    const data = makeData({ items: makeInput().items.map((i) => (i.id === 'i3' ? { ...i, purchaseState: 'added' } : i)) });
    const entries = buyEntries(data.model.kit.lines, data.shop, data.viewerId);
    expect(entries.find((e) => e.line.name === 'Trousse de secours')).toBeUndefined();
  });
});
