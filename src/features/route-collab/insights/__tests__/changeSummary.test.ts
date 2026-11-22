import { describe, expect, it } from 'vitest';
import { summarizeRevisionChanges } from '../changeSummary';
import { baseWorkspace, basePoints, kit, section, stage } from './fixtures';

const night = (id: string, lat = 45.9, lon = 6.13) => ({ id, name: id, type: 'refuge' as const, lat, lon, bookingStatus: 'planned' as const, provenance: 'osm', lastVerifiedAt: null });

describe('summarizeRevisionChanges', () => {
  it('« +4 km le jour 2, nuit déplacée, 2 objets à revérifier »', () => {
    const [a, b, c] = basePoints();
    const prev = { ...baseWorkspace({ stages: [stage('g1', 1, 'a', 'b', { overnightPlace: night('r1') }), stage('g2', 2, 'b', 'c')] }), kitSnapshot: [kit('k1'), kit('k2')] };
    const next = {
      ...baseWorkspace({
        sections: [section('s1', a, b), section('s2', b, c, { distanceKm: 14 })],
        stages: [stage('g1', 1, 'a', 'b', { overnightPlace: night('r2', 45.91, 6.12) }), stage('g2', 2, 'b', 'c')],
      }),
      kitSnapshot: [kit('k1', { status: 'needs_revalidation' }), kit('k2', { status: 'needs_revalidation' })],
    };
    const r = summarizeRevisionChanges(prev, next);
    expect(r.sentence).toBe('+4 km le jour 2, nuit déplacée, 2 objets à revérifier');
    expect(r.facts).toContainEqual({ kind: 'distance', dayNumber: 2, deltaKm: 4 });
  });
  it('aucun changement', () => {
    const ws = baseWorkspace();
    const r = summarizeRevisionChanges(ws, ws);
    expect(r.facts).toEqual([]);
    expect(r.sentence).toBe('Aucun changement relevé');
  });
  it('baisse, D+ et jour ajouté ; D+ devenu inconnu signalé, pas chiffré', () => {
    const [a, b, c] = basePoints();
    const prev = baseWorkspace();
    const next = baseWorkspace({
      sections: [section('s1', a, b, { distanceKm: 8.5, ascentM: 700 }), section('s2', b, c, { ascentM: null })],
      stages: [...prev.stages, stage('g3', 3, 'c', 'c')],
    });
    const r = summarizeRevisionChanges(prev, next);
    expect(r.sentence).toContain('−1,5 km le jour 1');
    expect(r.sentence).toContain('+100 m de D+ le jour 1');
    expect(r.sentence).toContain('D+ devenu inconnu le jour 2');
    expect(r.sentence).toContain('jour 3 ajouté');
  });
  it('un objet déjà à revérifier n’est pas recompté', () => {
    const prev = { ...baseWorkspace(), kitSnapshot: [kit('k1', { status: 'needs_revalidation' })] };
    const next = { ...baseWorkspace(), kitItems: [kit('k1', { status: 'needs_revalidation' })] };
    expect(summarizeRevisionChanges(prev, next).facts).toEqual([]);
  });
});
