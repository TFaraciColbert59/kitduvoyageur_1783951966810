import { describe, expect, it } from 'vitest';
import {
  anchorFromOrigin,
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

describe('sans lieu mais avec un départ dit : l’aventure est préparée autour du départ', () => {
  const LYON = { name: 'Lyon', lat: 45.76, lon: 4.84, countryCode: 'FR', source: 'dit' as const };

  it('séjour : la ville dite devient le lieu, rayon 60 km, et la note le dit', () => {
    const { anchor, note } = anchorFromOrigin(LYON, 'sejour');
    expect(anchor).toEqual({
      name: 'Lyon',
      lat: 45.76,
      lon: 4.84,
      countryCode: 'FR',
      country: null,
      radiusKm: 60,
      kind: 'town',
    });
    expect(note).toBe(
      'Lieu non précisé : préparé autour de Lyon, ton point de départ. Change-le dans « Où » si tu pensais à un autre endroit.'
    );
  });

  it('journée : comme un séjour (60 km, note)', () => {
    const { anchor, note } = anchorFromOrigin(LYON, 'journee');
    expect(anchor.radiusKm).toBe(60);
    expect(note).toContain('préparé autour de Lyon');
  });

  it('sortie de quelques heures : rayon 15 km, aucune note (comme la position partagée)', () => {
    const { anchor, note } = anchorFromOrigin(LYON, 'sortie');
    expect(anchor).toMatchObject({ name: 'Lyon', radiusKm: 15, kind: 'town' });
    expect(note).toBeNull();
  });

  it('le point et le pays sont ceux du départ dit, jamais un autre ; pays inconnu reste inconnu', () => {
    const { anchor } = anchorFromOrigin({ ...LYON, name: 'Grand-Bornand', lat: 45.94, lon: 6.43, countryCode: null }, 'sejour');
    expect(anchor).toMatchObject({ name: 'Grand-Bornand', lat: 45.94, lon: 6.43, countryCode: null, country: null });
  });
});
