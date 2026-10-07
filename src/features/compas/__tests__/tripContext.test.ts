import { describe, expect, it } from 'vitest';
import {
  anchorOf,
  buildTripContext,
  partySizeOf,
  tripContextFromRow,
  tripLengthDays,
} from '../engine/tripContext';

describe('tripLengthDays — une seule règle', () => {
  it('compte les dates, bornes incluses', () => {
    expect(tripLengthDays('2026-11-01', '2026-11-07')).toBe(7);
    expect(tripLengthDays('2026-11-01', null)).toBe(1);
    expect(tripLengthDays('2026-11-01', '2026-11-01')).toBe(1);
  });
  it('se replie sur la durée retenue quand les dates manquent ou sont incohérentes', () => {
    expect(tripLengthDays(null, null, 5)).toBe(5);
    expect(tripLengthDays('2026-11-07', '2026-11-01', 4)).toBe(4);
    expect(tripLengthDays(null, null, '6')).toBe(6);
  });
  it('rejette les durées invalides et borne à 60', () => {
    expect(tripLengthDays(null, null, 0)).toBeNull();
    expect(tripLengthDays(null, null, 2.5)).toBeNull();
    expect(tripLengthDays(null, null, 'abc')).toBeNull();
    expect(tripLengthDays(null, null, 90)).toBe(60);
    expect(tripLengthDays('2026-01-01', '2026-12-31')).toBe(60);
  });
  it('les dates priment sur la durée retenue', () => {
    expect(tripLengthDays('2026-11-01', '2026-11-03', 10)).toBe(3);
  });
});

describe('partySizeOf', () => {
  it('party_size prime, sinon les membres, au moins 1, au plus 20', () => {
    expect(partySizeOf(3, 5)).toBe(3);
    expect(partySizeOf(null, 4)).toBe(4);
    expect(partySizeOf(null, 0)).toBe(1);
    expect(partySizeOf(null)).toBe(1);
    expect(partySizeOf(0, 2)).toBe(2);
    expect(partySizeOf(50)).toBe(20);
  });
});

describe('anchorOf', () => {
  it('valide les coordonnées', () => {
    expect(anchorOf({ name: 'Chamonix', lat: 45.92, lon: 6.87 })).toEqual({ name: 'Chamonix', lat: 45.92, lon: 6.87 });
    expect(anchorOf({ name: 'x', lat: null, lon: 2 })).toBeNull();
    expect(anchorOf({ name: 'x', lat: 120, lon: 2 })).toBeNull();
    expect(anchorOf(null)).toBeNull();
  });
});

describe('buildTripContext', () => {
  it('assemble jours, nuits, groupe et destination', () => {
    const ctx = buildTripContext({
      startDate: '2026-11-01',
      endDate: '2026-11-05',
      partySize: null,
      memberCount: 2,
      destinationName: '  Chamonix ',
      countryCode: 'fr',
      anchor: { name: 'Chamonix', lat: 45.92, lon: 6.87 },
      activity: 'trekking',
    });
    expect(ctx).toMatchObject({
      days: 5,
      nights: 4,
      dated: true,
      party: 2,
      hours: null,
      destination: { name: 'Chamonix', countryCode: 'FR', anchor: { lat: 45.92 } },
      activity: 'trekking',
    });
  });
  it('sortie courte : heures gardées seulement pour un jour', () => {
    const one = buildTripContext({ startDate: null, endDate: null, plannedDays: 1, partySize: 1, destinationName: null, activity: null, durationHours: 4 });
    expect(one).toMatchObject({ days: 1, nights: 0, dated: false, hours: 4 });
    const many = buildTripContext({ startDate: null, endDate: null, plannedDays: 3, partySize: 1, destinationName: null, activity: null, durationHours: 4 });
    expect(many.hours).toBeNull();
  });
  it('lit une ligne trips + metadata.compas', () => {
    const ctx = tripContextFromRow(
      {
        start_date: null,
        end_date: null,
        destination_name: 'Népal',
        destination_country_code: 'NP',
        party_size: 3,
        metadata: { compas: { planned_days: 12, anchor: { name: 'Pokhara', lat: 28.2, lon: 83.98 } } },
      },
      { activity: 'trekking' }
    );
    expect(ctx).toMatchObject({ days: 12, nights: 11, dated: false, party: 3, destination: { countryCode: 'NP', anchor: { name: 'Pokhara' } } });
  });
});
