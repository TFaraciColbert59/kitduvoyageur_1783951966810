import { describe, expect, it } from 'vitest';
import {
  DEPARTURE_GPS,
  DEPARTURE_HOME,
  departureRowValue,
  departureText,
  readDeparture,
  type DepartureInput,
} from '../engine/departure';
import { UNKNOWN_ORIGIN_LINE } from '../engine/travel';

/**
 * D'où part le trajet pour la personne qui regarde (PLAN-100 4.3) : le départ dit, puis le domicile du
 * profil, puis la position ; sinon aucun. Même ordre que `travelOrigin` (`travelHome.test.ts`).
 */
const input = (over: Partial<DepartureInput> = {}): DepartureInput => ({
  said: null,
  hasHome: false,
  prepared: null,
  viewerId: 'u1',
  ...over,
});

describe('readDeparture : l’ordre des sources', () => {
  it('le départ dit l’emporte sur le domicile et sur la position', () => {
    expect(
      readDeparture(
        input({ said: { name: 'Lyon' }, hasHome: true, prepared: { from: 'gps', by: 'u1' } })
      )
    ).toEqual({ source: 'dit', name: 'Lyon' });
  });

  it('sans départ dit, une préparation faite depuis le domicile ou la position le dit à son lanceur', () => {
    expect(
      readDeparture(input({ hasHome: true, prepared: { from: 'domicile', by: 'u1' } }))
    ).toEqual({ source: 'domicile' });
    expect(readDeparture(input({ hasHome: true, prepared: { from: 'gps', by: 'u1' } }))).toEqual({
      source: 'gps',
    });
    expect(readDeparture(input({ prepared: { from: 'gps', by: 'u1' } }))).toEqual({
      source: 'gps',
    });
  });

  it('la préparation d’une autre personne : son domicile ou sa position ne sont pas montrés', () => {
    for (const from of ['domicile', 'gps'] as const) {
      expect(readDeparture(input({ hasHome: true, prepared: { from, by: 'u2' } }))).toEqual({
        source: 'autre',
      });
      expect(readDeparture(input({ prepared: { from, by: null } }))).toEqual({ source: 'autre' });
      expect(readDeparture(input({ viewerId: null, prepared: { from, by: 'u2' } }))).toEqual({
        source: 'autre',
      });
    }
  });

  it('sans préparation, le prochain trajet part du domicile du profil, sinon de rien', () => {
    expect(readDeparture(input({ hasHome: true }))).toEqual({ source: 'domicile' });
    expect(readDeparture(input())).toEqual({ source: 'aucun' });
  });

  it('une préparation faite depuis un départ dit (effacé depuis) ou d’avant la source rangée ne compte plus', () => {
    expect(readDeparture(input({ hasHome: true, prepared: { from: 'dit', by: null } }))).toEqual({
      source: 'domicile',
    });
    expect(readDeparture(input({ prepared: { from: 'dit', by: null } }))).toEqual({
      source: 'aucun',
    });
    expect(readDeparture(input({ prepared: { from: null, by: null } }))).toEqual({
      source: 'aucun',
    });
  });

  it('ne porte un nom que pour un départ dit', () => {
    for (const over of [
      input({ hasHome: true }),
      input({ prepared: { from: 'gps', by: 'u1' } }),
      input({ prepared: { from: 'domicile', by: 'u2' } }),
      input(),
    ])
      expect(readDeparture(over)).not.toHaveProperty('name');
  });
});

describe('textes de l’écran', () => {
  it('chaque source, dite avec ses mots', () => {
    expect(departureText({ source: 'dit', name: 'Lyon' })).toMatchObject({
      value: 'Lyon',
      source: 'départ dit',
    });
    expect(departureText({ source: 'domicile' })).toMatchObject({
      value: 'depuis ton domicile',
      source: 'ton profil voyageur',
    });
    expect(departureText({ source: 'gps' })).toMatchObject({
      value: 'depuis ta position (arrondie à ~1 km)',
      source: 'position de ton appareil',
    });
    expect(departureText({ source: 'aucun' })).toMatchObject({
      value: UNKNOWN_ORIGIN_LINE,
      source: null,
    });
    expect(departureText(undefined).value).toBe('Trajet non chiffré : point de départ inconnu');
    expect(DEPARTURE_HOME).toBe('depuis ton domicile');
    expect(DEPARTURE_GPS).toBe('depuis ta position (arrondie à ~1 km)');
  });

  it('la ligne de carte : « Non renseigné » sans départ, « Non montré » pour celui d’un autre', () => {
    expect(departureRowValue({ source: 'dit', name: 'Lyon' })).toBe('Lyon');
    expect(departureRowValue({ source: 'domicile' })).toBe(DEPARTURE_HOME);
    expect(departureRowValue({ source: 'gps' })).toBe(DEPARTURE_GPS);
    expect(departureRowValue({ source: 'autre' })).toBe('Non montré');
    expect(departureRowValue({ source: 'aucun' })).toBe('Non renseigné');
    expect(departureRowValue(undefined)).toBe('Non renseigné');
  });

  it('un nom qui se glisserait hors départ dit n’est jamais affiché', () => {
    for (const source of ['domicile', 'gps', 'autre', 'aucun'] as const) {
      const leaky = { source, name: 'Villeurbanne' };
      expect(JSON.stringify(departureText(leaky))).not.toContain('Villeurbanne');
      expect(departureRowValue(leaky)).not.toContain('Villeurbanne');
    }
  });

  it('les textes sont tutoyés et ne portent aucune coordonnée', () => {
    for (const source of ['dit', 'domicile', 'gps', 'autre', 'aucun'] as const) {
      const t = departureText({ source, name: 'Lyon' });
      expect(`${t.value} ${t.hint}`).not.toMatch(/\b(?:votre|vos|vous)\b/i);
      expect(`${t.value} ${t.hint}`).not.toMatch(/\d{2}[.,]\d{2,}/);
    }
  });
});
