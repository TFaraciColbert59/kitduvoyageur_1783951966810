import { describe, expect, it } from 'vitest';
import {
  MomentUpdateSchema,
  NightInputSchema,
  StepInputSchema,
  TravelerAddSchema,
  TravelerUpdateSchema,
  VerdictInputSchema,
  etapeFromRow,
  firstIssue,
  nightFromRow,
  nightRow,
  stepRow,
  verdictItem,
  verdictRow,
} from '../editSchemas';

const CARNET = '749e9e8c-9540-5a73-8b6c-6ab07264f62f';
const ITEM = '0b1c9c0e-3c1d-4f6a-9a2e-0d4c1b7e8f01';

describe('étape', () => {
  it('accepte une saisie de formulaire (chaînes, virgule décimale)', () => {
    const parsed = StepInputSchema.parse({
      carnetId: CARNET,
      dayNumber: '2',
      from: ' La Bérarde ',
      to: 'Refuge du Pigeonnier',
      distanceKm: '17,5',
      elevationM: '1240',
      durationText: '6 h 40',
    });
    expect(parsed.dayNumber).toBe(2);
    expect(parsed.from).toBe('La Bérarde');
    expect(parsed.distanceKm).toBe(17.5);
    expect(parsed.elevationM).toBe(1240);
  });

  it('refuse un départ vide, un jour hors bornes et une distance négative', () => {
    const base = { carnetId: CARNET, dayNumber: 1, from: 'A', to: 'B' };
    expect(StepInputSchema.safeParse({ ...base, from: '  ' }).success).toBe(false);
    expect(StepInputSchema.safeParse({ ...base, dayNumber: 0 }).success).toBe(false);
    expect(StepInputSchema.safeParse({ ...base, dayNumber: 400 }).success).toBe(false);
    expect(StepInputSchema.safeParse({ ...base, distanceKm: '-3' }).success).toBe(false);
    expect(StepInputSchema.safeParse({ ...base, carnetId: 'pas-un-uuid' }).success).toBe(false);
  });

  it('écrit les colonnes historiques de groupe_etapes et rend l’étape lisible', () => {
    const value = StepInputSchema.parse({
      carnetId: CARNET,
      dayNumber: 3,
      from: 'Vallouise',
      to: 'Lac de la Muzelle',
      distanceKm: 22,
    });
    const row = stepRow(value, 'g-1');
    expect(row).toMatchObject({
      groupe_id: 'g-1',
      jour_numero: 3,
      ordre: 3,
      lieu_depart: 'Vallouise',
      lieu_arrivee: 'Lac de la Muzelle',
      distance_km: 22,
      denivele_m: null,
    });
    const etape = etapeFromRow(
      { ...row, id: 'e-1', date_etape: null, temperature_c: null } as never,
      'Gîte'
    );
    expect(etape).toMatchObject({ dayNumber: 3, label: 'JOUR 3', distanceKm: 22, overnight: 'Gîte' });
  });
});

describe('nuit', () => {
  it('valide le type d’hébergement et l’altitude', () => {
    const ok = NightInputSchema.parse({
      carnetId: CARNET,
      dayNumber: 1,
      name: 'Refuge du Pigeonnier',
      type: 'refuge',
      altitudeM: '2410',
    });
    expect(ok.altitudeM).toBe(2410);
    expect(
      NightInputSchema.safeParse({ carnetId: CARNET, dayNumber: 1, name: 'X', type: 'palace' }).success
    ).toBe(false);
    expect(
      NightInputSchema.safeParse({ carnetId: CARNET, dayNumber: 1, name: '', type: 'gite' }).success
    ).toBe(false);
    expect(
      NightInputSchema.safeParse({
        carnetId: CARNET,
        dayNumber: 1,
        name: 'X',
        type: 'gite',
        altitudeM: 99999,
      }).success
    ).toBe(false);
  });

  it('écrit created_by et relit un type inconnu comme « autre »', () => {
    const value = NightInputSchema.parse({ carnetId: CARNET, dayNumber: 2, name: 'Gîte', type: 'gite' });
    expect(nightRow(value, 'u-1')).toMatchObject({ carnet_id: CARNET, jour_numero: 2, created_by: 'u-1' });
    expect(
      nightFromRow({
        id: 'n',
        jour_numero: 2,
        nom: 'Gîte',
        type: 'palace',
        altitude_m: null,
        infos: null,
        lat: null,
        lng: null,
        map_refuge_id: null,
      }).type
    ).toBe('autre');
  });
});

describe('verdict', () => {
  it('trie et dédoublonne les jours, efface la note quand le verdict est retiré', () => {
    const value = VerdictInputSchema.parse({
      carnetId: CARNET,
      itemId: ITEM,
      verdict: 'defaillant',
      note: ' fermeture cassée ',
      days: [3, 1, '3', 2],
    });
    expect(value.days).toEqual([1, 2, 3]);
    expect(verdictRow(value)).toEqual({
      verdict: 'defaillant',
      verdict_note: 'fermeture cassée',
      jours_utilises: [1, 2, 3],
    });
    const cleared = VerdictInputSchema.parse({
      carnetId: CARNET,
      itemId: ITEM,
      verdict: null,
      note: 'x',
      days: [1],
    });
    expect(verdictRow(cleared)).toEqual({ verdict: null, verdict_note: null, jours_utilises: null });
    expect(verdictItem(cleared)).toMatchObject({ verdict: null, joursUtilises: [] });
  });

  it('refuse un verdict hors liste et une note de plus de 500 caractères', () => {
    expect(VerdictInputSchema.safeParse({ carnetId: CARNET, itemId: ITEM, verdict: 'top' }).success).toBe(
      false
    );
    expect(
      VerdictInputSchema.safeParse({
        carnetId: CARNET,
        itemId: ITEM,
        verdict: 'utile',
        note: 'x'.repeat(501),
      }).success
    ).toBe(false);
  });
});

describe('voyageur', () => {
  it('retire le @ et refuse les caractères de motif', () => {
    expect(
      TravelerAddSchema.parse({ carnetId: CARNET, handle: ' @leo_b ', role: 'contributor' }).handle
    ).toBe('leo_b');
    expect(TravelerAddSchema.safeParse({ carnetId: CARNET, handle: 'a%b', role: 'viewer' }).success).toBe(
      false
    );
    expect(TravelerAddSchema.safeParse({ carnetId: CARNET, handle: 'x', role: 'viewer' }).success).toBe(
      false
    );
  });

  it('ne laisse pas donner le rôle owner par cette voie', () => {
    expect(TravelerAddSchema.safeParse({ carnetId: CARNET, handle: 'leo', role: 'owner' }).success).toBe(
      false
    );
    expect(
      TravelerUpdateSchema.safeParse({ carnetId: CARNET, userId: ITEM, role: 'owner' }).success
    ).toBe(false);
  });
});

describe('moment', () => {
  it('exige un lieu', () => {
    const bad = MomentUpdateSchema.safeParse({ carnetId: CARNET, id: ITEM, place: ' ' });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(firstIssue(bad.error)).toBe('Indique un lieu.');
  });
});
