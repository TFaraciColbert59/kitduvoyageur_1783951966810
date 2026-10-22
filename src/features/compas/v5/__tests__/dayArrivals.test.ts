import { describe, expect, it } from 'vitest';
import { dayArrivals, stayChoicesFromRows } from '../engine/dayArrivals';
import { parseTransportChoice } from '../engine/transportOptions';
import { rankStayOptions } from '../engine/stayOptions';

const step = (id: string, lat: number, lon: number) => ({ id: `s-${id}`, lat, lon, kind: 'step' as const });

describe('dayArrivals', () => {
  it('prend la dernière étape placée de chaque jour, et marque le dernier jour', () => {
    const out = dayArrivals({
      itinerary: [
        { id: 'a', day: 1, accommodation: null },
        { id: 'b', day: 1, accommodation: 'Gîte du Pré' },
        { id: 'c', day: 2, accommodation: 'Hébergement à réserver · Rencurel' },
      ],
      points: [step('a', 45, 5), step('b', 45.1, 5.1), step('c', 45.2, 5.2)],
    });
    expect(out).toEqual([
      { day: 1, stepId: 'b', lat: 45.1, lon: 5.1, noted: 'Gîte du Pré', isLast: false },
      // « Hébergement à réserver » est une proposition du Compas, pas une nuit notée.
      { day: 2, stepId: 'c', lat: 45.2, lon: 5.2, noted: null, isLast: true },
    ]);
  });

  it('un jour sans étape placée n’a pas d’arrivée ; une étape sans position est écartée', () => {
    const out = dayArrivals({
      itinerary: [
        { id: 'a', day: 1, accommodation: null },
        { id: 'b', day: 2, accommodation: null },
        { id: 'c', day: 3, accommodation: null },
      ],
      points: [step('a', 45, 5), step('c', Number.NaN, 5), { id: 'r-1', lat: 46, lon: 6, kind: 'poi' as never }],
    });
    expect(out.map((a) => a.day)).toEqual([1]);
    // Le dernier jour du voyage reste celui de la dernière étape, placée ou non.
    expect(out[0].isLast).toBe(false);
  });

  it('un voyage vide : rien', () => {
    expect(dayArrivals({ itinerary: [], points: [] })).toEqual([]);
  });
});

describe('stayChoicesFromRows', () => {
  it('lit l’identifiant de la dernière étape de chaque jour', () => {
    expect(
      stayChoicesFromRows([
        { day_number: 1, order_index: 0, metadata: { compas: { stay: { id: 'osm:1' } } } },
        { day_number: 1, order_index: 1, metadata: { compas: { stay: { id: 'noted:Gîte' } } } },
        { day_number: 2, order_index: 0, metadata: null },
        { day_number: 3, order_index: 0, metadata: { compas: { stay: { id: 42 } } } },
        { day_number: 'x', order_index: 0, metadata: { compas: { stay: { id: 'osm:9' } } } },
      ])
    ).toEqual({ 1: 'noted:Gîte' });
  });

  it('une étape plus tôt du jour n’efface pas celle de la fin', () => {
    expect(
      stayChoicesFromRows([
        { day_number: 1, order_index: 2, metadata: { compas: { stay: { id: 'osm:2' } } } },
        { day_number: 1, order_index: 0, metadata: null },
      ])
    ).toEqual({ 1: 'osm:2' });
  });
});

describe('parseTransportChoice', () => {
  it('lit un choix valide, rejette le reste', () => {
    expect(parseTransportChoice({ id: 'train', amountEur: 60, perPerson: true, source: 's' })).toEqual({
      id: 'train',
      amountEur: 60,
      perPerson: true,
      source: 's',
    });
    expect(parseTransportChoice({ id: 'train', amountEur: -1, source: 3 })).toEqual({ id: 'train', amountEur: null, perPerson: false, source: '' });
    expect(parseTransportChoice({ id: 'rocket' })).toBeNull();
    expect(parseTransportChoice(null)).toBeNull();
    expect(parseTransportChoice([])).toBeNull();
    expect(parseTransportChoice('car')).toBeNull();
  });
});

describe('nuit notée par la préparation', () => {
  it('« Refuge · <nom> » retrouve le refuge du même nom', () => {
    const arrival = { lat: 45, lon: 5.4 };
    const out = rankStayOptions({
      arrival,
      pois: [{ id: 7, name: 'Refuge de la Coche', category: 'refuge', lat: 45.003, lon: 5.4, distanceM: 0, elevationM: 1480 }],
      noted: 'Refuge · Refuge de la Coche',
      party: 2,
      nights: null,
      countryCode: 'FR',
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'noted:Refuge · Refuge de la Coche', kind: 'refuge', elevationM: 1480, lat: 45.003 });
  });

  it('« Bivouac » reste un bivouac à l’arrivée, sans prix', () => {
    const out = rankStayOptions({ arrival: { lat: 45, lon: 5.4 }, pois: [], noted: 'Bivouac', party: 2, nights: 'bivouac', countryCode: 'FR' });
    expect(out[0]).toMatchObject({ kind: 'bivouac', price: null, distanceM: 0 });
  });
});
