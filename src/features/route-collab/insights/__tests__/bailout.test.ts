import { describe, expect, it } from 'vitest';
import { bailoutsByStage, nearestBailout, type BailoutCandidate } from '../bailout';
import { baseWorkspace } from './fixtures';

const line: [number, number][] = [[6.0, 45.9], [6.13, 45.9]];
const road: BailoutCandidate = { id: 'r', name: 'D909', kind: 'road', lat: 45.91, lon: 6.065 };
const stop: BailoutCandidate = { id: 'b', name: 'Arrêt Col', kind: 'transport_stop', lat: 45.9, lon: 6.14 };

describe('nearestBailout', () => {
  it('retourne la sortie la plus proche, avec distance et position', () => {
    const r = nearestBailout(line, [road, stop]);
    expect(r.nearest?.candidate.id).toBe('b');
    expect(r.nearest?.distanceKm).toBeCloseTo(0.77, 1);
    expect(r.nearestByKind.road?.candidate.id).toBe('r');
    expect(r.nearestByKind.road?.distanceKm).toBeCloseTo(1.11, 1);
    expect(r.nearestByKind.road?.alongKm).toBeCloseTo(5, 0);
  });
  it('aucun candidat : null et raison, rien d’inventé', () => {
    const r = nearestBailout(line, []);
    expect(r.nearest).toBeNull();
    expect(r.reason).toContain('aucune');
  });
  it('tracé inconnu', () => {
    expect(nearestBailout([], [road]).reason).toContain('inconnu');
  });
  it('par étape depuis l’atelier', () => {
    const r = bailoutsByStage(baseWorkspace(), [road]);
    expect(r).toHaveLength(2);
    expect(r[0].result.nearest?.candidate.id).toBe('r');
    expect(r[1].result.nearest?.distanceKm).toBeGreaterThan(r[0].result.nearest!.distanceKm);
  });
});
