import { describe, expect, it } from 'vitest';
import { sanitizeWorkspaceForShareLink } from '../shareSanitize';
import type { RouteWorkspaceState } from '../types';

// Départ à Annecy (45.8992, 6.1294) ; ~111 m par 0.001° de latitude.
function workspace(): RouteWorkspaceState {
  const point = (id: string, kind: 'start' | 'via' | 'finish', orderKey: string, lat: number) => ({
    id,
    workspaceId: 'ws',
    kind,
    orderKey,
    lat,
    lon: 6.1294,
    eleM: 450,
    name: id,
    note: `note ${id}`,
    entityVersion: 1,
  });
  const line = (from: number, to: number, steps: number): Array<[number, number]> =>
    Array.from({ length: steps + 1 }, (_, i) => [6.1294, from + ((to - from) * i) / steps] as [number, number]);
  const section = (id: string, fromPointId: string, toPointId: string, coords: Array<[number, number]>) => ({
    id,
    workspaceId: 'ws',
    fromPointId,
    toPointId,
    mode: 'routed' as const,
    geometry: { type: 'LineString' as const, coordinates: coords },
    distanceKm: 1,
    durationMin: 15,
    ascentM: 10,
    descentM: 0,
    elevationSamples: coords.map(() => 450),
    surfaceSegments: [],
    routingInputHash: null,
    provenance: {} as never,
    warnings: [],
    entityVersion: 1,
  });
  return {
    id: 'ws',
    tripId: 'trip',
    title: 'Boucle',
    status: 'published',
    sport: 'marche' as never,
    routingOptions: {} as never,
    headSeq: 3,
    reviewedSeq: 3,
    publishedRevisionId: 'rev',
    publishedRevisionNo: 1,
    sourceOrigin: { kind: 'gpx_import', originalGpxXml: '<gpx>secret</gpx>' },
    shareLink: {
      token: 'x'.repeat(40),
      audience: 'external_viewer',
      expiresAt: null,
      revokedAt: null,
      hidePrivateStartRadiusM: 500,
      createdBy: 'u1',
      createdAt: '2026-11-22T00:00:00.000Z',
    },
    points: [
      point('home', 'start', 'a0', 45.8992),
      point('near', 'via', 'a1', 45.9012), // ~220 m : dans la zone privée
      point('far', 'via', 'a2', 45.9192), // ~2,2 km
      point('end', 'finish', 'a3', 45.9292),
    ],
    sections: [
      section('s1', 'home', 'near', line(45.8992, 45.9012, 4)),
      section('s2', 'near', 'far', line(45.9012, 45.9192, 18)),
      section('s3', 'far', 'end', line(45.9192, 45.9292, 10)),
    ],
    stages: [],
    variants: [{ id: 'v' } as never],
    proposals: [{ id: 'p' } as never],
    comments: [{ id: 'c' } as never],
    kitItems: [{ id: 'k' } as never],
    members: [
      { userId: 'u1', displayName: 'Alice', role: 'owner', delegatedPublish: true },
      { userId: 'u2', displayName: 'Bob', role: 'editor', revokedAt: '2026-11-20T00:00:00.000Z' },
    ],
    revisions: [{ id: 'rev' } as never],
    packs: [{ id: 'pack' } as never],
    participantPacks: [{ userId: 'u1' } as never],
    updatedAt: '2026-11-22T00:00:00.000Z',
  } as unknown as RouteWorkspaceState;
}

const distanceFromHomeM = (lat: number) => Math.abs(lat - 45.8992) * 111_195;

describe('sanitizeWorkspaceForShareLink (8.9, RGPD)', () => {
  it('ne laisse aucune coordonnée dans la zone de départ privée', () => {
    const out = sanitizeWorkspaceForShareLink(workspace());
    for (const p of out.points) expect(distanceFromHomeM(p.lat)).toBeGreaterThan(500);
    for (const s of out.sections) {
      for (const [, lat] of s.geometry.coordinates) expect(distanceFromHomeM(lat)).toBeGreaterThan(500);
    }
    const start = out.points.find((p) => p.kind === 'start');
    expect(start?.name).toBe('Départ (zone privée masquée)');
    expect(out.points.some((p) => p.id === 'near')).toBe(false);
  });

  it('retire les données internes et les membres révoqués', () => {
    const out = sanitizeWorkspaceForShareLink(workspace());
    expect(out.proposals).toEqual([]);
    expect(out.comments).toEqual([]);
    expect(out.kitItems).toEqual([]);
    expect(out.revisions).toEqual([]);
    expect(out.packs).toEqual([]);
    expect(out.variants).toEqual([]);
    expect(out.participantPacks).toEqual([]);
    expect(out.shareLink).toBeNull();
    expect(out.sourceOrigin.originalGpxXml).toBeNull();
    expect(out.members.map((m) => m.userId)).toEqual(['u1']);
    expect(out.points.every((p) => p.note === null)).toBe(true);
  });

  it('sans aucune coordonnée hors zone, ne montre pas le départ', () => {
    const out = sanitizeWorkspaceForShareLink(workspace(), 100_000);
    expect(out.points).toEqual([]);
    expect(out.sections).toEqual([]);
  });
});
