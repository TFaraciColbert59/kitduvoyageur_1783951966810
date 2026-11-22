import { describe, expect, it } from 'vitest';
import { baseWorkspace, section } from '../insights/__tests__/fixtures';
import { buildProfileModel, nearestProfileIndex, profileIndexAtDistance, readProfileAt } from '../profileLink';

function model() {
  const ws = baseWorkspace();
  const sections = [
    { ...ws.sections[0], elevationSamples: [1000, 1100, 1200] as Array<number | null>, durationMin: 120 },
    { ...ws.sections[1], elevationSamples: [1200, 1150, 1100] as Array<number | null>, durationMin: 60 },
  ];
  return buildProfileModel({ orderedPoints: ws.points, sections, stages: ws.stages });
}

describe('profileLink · carte ↔ profil (2.6)', () => {
  it('un point du profil par coordonnée de chaque tronçon, distances croissantes', () => {
    const m = model();
    expect(m.points).toHaveLength(6);
    expect(m.points[5].distanceM).toBeCloseTo(m.totalM, 3);
    expect(m.hasElevation).toBe(true);
  });

  it('carte → profil : un point voisin du tracé trouve son index, un point lointain non', () => {
    const m = model();
    expect(nearestProfileIndex(m, [6.26, 45.9005])).toBe(5);
    expect(nearestProfileIndex(m, [6.0, 45.95])).toBeNull();
  });

  it('profil → carte : le kilomètre demandé retombe sur le bon point', () => {
    const m = model();
    const idx = profileIndexAtDistance(m, m.points[1].distanceM + 1)!;
    expect(idx).toBe(1);
    expect(profileIndexAtDistance(m, -3)).toBe(0);
    expect(profileIndexAtDistance(m, 1e9)).toBe(5);
  });

  it('lit km, altitude, pente et heure de passage du jour', () => {
    const m = model();
    const r = readProfileAt(m, 2)!;
    expect(r.km).toBeGreaterThan(9);
    expect(r.elevationM).toBe(1200);
    expect(r.day).toBe(1);
    expect(r.passageTime).toBe('10:00');
    expect(r.slopePct).not.toBeNull();
    const mid = readProfileAt(m, 1)!;
    expect(mid.passageTime).toBe('09:00');
    // Le jour 2 repart à l'heure de départ du jour 2.
    const d2 = readProfileAt(m, 3)!;
    expect(d2.day).toBe(2);
    expect(d2.passageTime).toBe('08:00');
  });

  it('altitude absente : pente et altitude restent inconnues, jamais 0', () => {
    const ws = baseWorkspace();
    const bare = [
      { ...ws.sections[0], elevationSamples: undefined },
      { ...ws.sections[1], elevationSamples: undefined },
    ];
    const m = buildProfileModel({ orderedPoints: ws.points, sections: bare, stages: ws.stages });
    const r = readProfileAt(m, 1)!;
    expect(r.elevationM).toBeNull();
    expect(r.slopePct).toBeNull();
  });

  it('durée de tronçon inconnue : pas d’heure de passage inventée', () => {
    const ws = baseWorkspace();
    const sec = [section('s1', ws.points[0], ws.points[1], { durationMin: null }), ws.sections[1]];
    const m = buildProfileModel({ orderedPoints: ws.points, sections: sec, stages: ws.stages });
    expect(readProfileAt(m, 1)!.passageTime).toBeNull();
  });
});
