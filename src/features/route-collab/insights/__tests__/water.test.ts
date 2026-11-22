import { describe, expect, it } from 'vitest';
import type { WaterObservation } from '../../types';
import { longestWaterGap, waterEvidenceLevel } from '../water';
import { baseWorkspace } from './fixtures';

const obs = (over: Partial<WaterObservation> = {}): WaterObservation => ({
  id: 'w1',
  name: 'Fontaine',
  lat: 45.9,
  lon: 6.065,
  status: 'unknown',
  potableClaim: 'unknown',
  observedAt: null,
  source: 'osm',
  ...over,
});

describe('longestWaterGap', () => {
  it('plus longue distance entre points d’eau, départ et arrivée compris', () => {
    const g = longestWaterGap(baseWorkspace(), [obs()]);
    expect(g.status).toBe('known');
    expect(g.gapKm).toBe(15);
    expect(g.fromLabel).toBe('Fontaine');
    expect(g.toLabel).toBe('arrivée');
    expect(g.waterPointCount).toBe(1);
  });
  it('un point à sec ou éloigné du tracé ne compte pas', () => {
    const g = longestWaterGap(baseWorkspace(), [obs({ status: 'dry' }), obs({ id: 'far', lat: 46.2 })]);
    expect(g.status).toBe('no_water_data');
  });
  it('aucune donnée : gapKm null, pas 0 ni « tout le tracé sans eau »', () => {
    const g = longestWaterGap(baseWorkspace(), []);
    expect(g.gapKm).toBeNull();
    expect(g.trackKm).toBe(20);
  });
  it('pas de tracé', () => {
    expect(longestWaterGap(baseWorkspace({ sections: [] }), [obs()]).status).toBe('no_track');
  });
});

describe('waterEvidenceLevel', () => {
  const now = new Date('2026-07-10T12:00:00Z');
  it('cartographiée par défaut, jamais « disponible »', () => {
    const e = waterEvidenceLevel(obs(), { now });
    expect(e.level).toBe('mapped');
    expect(e.label).toBe('Cartographiée');
  });
  it('potabilité déclarée', () => {
    expect(waterEvidenceLevel(obs({ potableClaim: 'yes' }), { now }).level).toBe('potability_declared');
  });
  it('confirmée récemment seulement si observée par une source humaine dans le seuil', () => {
    const base = obs({ status: 'flowing', source: 'user', observedAt: '2026-07-05T00:00:00Z' });
    expect(waterEvidenceLevel(base, { now }).level).toBe('confirmed_recent');
    expect(waterEvidenceLevel(base, { now, freshnessDays: 3 }).level).toBe('mapped');
    expect(waterEvidenceLevel({ ...base, source: 'osm' }, { now }).level).toBe('mapped');
    expect(waterEvidenceLevel({ ...base, potableClaim: 'yes' }, { now, freshnessDays: 3 }).level).toBe('potability_declared');
  });
  it('à sec signalé récemment', () => {
    expect(waterEvidenceLevel(obs({ status: 'dry', source: 'user', observedAt: '2026-07-09T00:00:00Z' }), { now }).reportedDry).toBe(true);
  });
});
