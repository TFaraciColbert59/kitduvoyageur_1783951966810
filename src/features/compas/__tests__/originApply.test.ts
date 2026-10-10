import { describe, expect, it } from 'vitest';
import { originOf } from '../engine/tripContext';
import { projectBasis, staleParts } from '../engine/dependencies';
import { parseIntentRules, planApplication, type ApplyCurrent } from '../engine/intent';
import { inverseOps } from '../components/compasApply';
import type { CompasCtl } from '../components/compasTypes';

const current: ApplyCurrent = {
  startDate: null,
  endDate: null,
  days: null,
  shortHours: null,
  preferences: { pace: 'normal', nights: null, avoid: [], wishes: [] },
  hasRoute: false,
};

describe('lieu de départ rangé sur le voyage', () => {
  it('lecture défensive de metadata.compas.origin', () => {
    expect(originOf({ name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'fr', source: 'dit' })).toEqual({
      name: 'Lyon',
      lat: 45.76,
      lon: 4.83,
      countryCode: 'FR',
      source: 'dit',
    });
    expect(originOf({ name: 'Lyon', lat: 45.76, lon: 4.83 })).toMatchObject({ countryCode: null });
    expect(originOf(null)).toBeNull();
    expect(originOf({ name: '', lat: 45.76, lon: 4.83 })).toBeNull();
    expect(originOf({ name: 'Lyon', lat: null, lon: 4.83 })).toBeNull();
    expect(originOf({ name: 'Lyon', lat: 145, lon: 4.83 })).toBeNull();
    expect(originOf('Lyon')).toBeNull();
  });
});

describe('appliquer « depuis Lyon »', () => {
  it('une opération « origin » à côté de la destination', () => {
    const ops = planApplication(parseIntentRules('rando 3 jours dans le Vercors depuis Lyon', '2026-10-09'), current);
    expect(ops[0]).toEqual({ op: 'destination', place: 'Vercors' });
    expect(ops).toContainEqual({ op: 'origin', place: 'Lyon' });
    expect(ops.filter((o) => o.op === 'destination')).toHaveLength(1);
  });

  it('« Annuler » rétablit le départ d’avant, ou l’efface s’il n’y en avait pas', () => {
    const ctl = (originName: string | null) =>
      ({
        data: {
          originName,
          model: { dates: { start: null, end: null, hours: null, days: null }, preferences: current.preferences },
        },
      }) as unknown as CompasCtl;
    expect(inverseOps(ctl('Grenoble'), [{ op: 'origin', place: 'Lyon' }])).toEqual([{ op: 'origin', place: 'Grenoble' }]);
    expect(inverseOps(ctl(null), [{ op: 'origin', place: 'Lyon' }])).toEqual([{ op: 'origin', place: null }]);
  });
});

describe('changer de départ refait le trajet et le budget, rien d’autre', () => {
  const basis = (origin: { name: string; lat: number; lon: number } | null) =>
    projectBasis({
      anchor: { name: 'Vercors', lat: 45.07, lon: 5.55 },
      destinationName: 'Vercors',
      days: 3,
      hours: null,
      startDate: '2027-06-01',
      activity: 'hiking',
      partySize: 2,
      prefs: null,
      origin,
    });

  it('empreinte arrondie à ~1 km', () => {
    expect(basis({ name: 'Lyon', lat: 45.7578, lon: 4.832 }).origin).toBe('Lyon@45.76,4.83');
    expect(basis(null).origin).toBeNull();
  });

  it('Lyon → Grenoble, ou départ dit après coup : trajet et budget', () => {
    const lyon = basis({ name: 'Lyon', lat: 45.76, lon: 4.83 });
    expect(staleParts(lyon, basis({ name: 'Grenoble', lat: 45.19, lon: 5.72 }))).toEqual(['transport', 'budget']);
    expect(staleParts(basis(null), lyon)).toEqual(['transport', 'budget']);
    expect(staleParts(lyon, lyon)).toEqual([]);
  });

  it('une empreinte d’avant ce lot (sans départ) ne déclenche rien', () => {
    const old = { ...basis(null) } as Record<string, unknown>;
    delete old.origin;
    expect(staleParts(old, basis({ name: 'Lyon', lat: 45.76, lon: 4.83 }))).toEqual([]);
  });
});
