import { describe, expect, it } from 'vitest';
import { MIN_PRIVATE_START_RADIUS_M, sanitizeWorkspaceForShareLink } from '../shareSanitize';
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
    provenance: { provider: 'geoapify-secret', calculatedAt: null, profile: 'marche', confidence: 'verified' },
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
    sourceOrigin: {
      kind: 'gpx_import',
      sourceId: 'src-secret',
      sourceUrl: 'https://exemple.test/prive',
      originalGpxXml: '<gpx>secret</gpx>',
    },
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
    stages: [
      {
        id: 'st1',
        workspaceId: 'ws',
        orderKey: '001',
        dayNumber: 1,
        title: 'Jour 1',
        dateIso: '2026-11-23',
        departureTimeLocal: '08:30',
        timezone: 'Europe/Paris',
        startPointId: 'home',
        endPointId: 'far',
        overnightPlace: { id: 'o', name: 'Refuge secret', type: 'refuge', lat: 45.9192, lon: 6.1294 },
        notes: 'note secrète',
        waterObservations: [{ id: 'w', name: 'Source secrète', lat: 45.91, lon: 6.13 }],
        weatherSlice: null,
        hazards: [{ id: 'h', title: 'Danger secret' }],
        entityVersion: 1,
      },
    ],
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
    expect(out.sourceOrigin.originalGpxXml).toBeUndefined();
    expect(out.points.every((p) => p.note === null)).toBe(true);
  });

  it('membres : nom affiché et rôle seulement, aucun identifiant réel', () => {
    const out = sanitizeWorkspaceForShareLink(workspace());
    expect(out.members).toHaveLength(1);
    expect(out.members[0]).toMatchObject({ displayName: 'Alice', role: 'owner' });
    expect(out.members[0].userId).not.toBe('u1');
    expect(JSON.stringify(out)).not.toContain('u1"');
    expect(out.members[0]).not.toHaveProperty('delegatedPublish');
  });

  it('liste blanche : ni tripId, ni provenance réelle, ni sourceId/sourceUrl/XML GPX', () => {
    const out = sanitizeWorkspaceForShareLink(workspace());
    const json = JSON.stringify(out);
    expect(out.tripId).toBe('');
    for (const secret of ['"trip"', 'geoapify-secret', 'src-secret', 'exemple.test', 'secret</gpx>', 'note ']) {
      expect(json).not.toContain(secret);
    }
    expect(out.sourceOrigin).not.toHaveProperty('sourceId');
    expect(out.sourceOrigin).not.toHaveProperty('sourceUrl');
    expect(out.sections.every((s) => s.provenance.confidence === 'unknown' && s.provenance.provider === null)).toBe(true);
    expect(out.publishedRevisionId).toBeNull();
  });

  it('étapes réduites : ni lieu de nuit, ni notes, ni eau, ni dangers', () => {
    const out = sanitizeWorkspaceForShareLink(workspace());
    expect(out.stages).toHaveLength(1);
    const stage = out.stages[0];
    expect(stage).toMatchObject({ id: 'st1', dayNumber: 1, title: 'Jour 1', dateIso: '2026-11-23' });
    expect(stage.overnightPlace).toBeNull();
    expect(stage.notes).toBe('');
    expect(stage.waterObservations).toEqual([]);
    expect(stage.hazards).toEqual([]);
    expect(JSON.stringify(out)).not.toContain('Refuge secret');
    // « home » est masqué mais conservé : son identifiant reste référencé ; « far » aussi.
    expect(stage.startPointId).toBe('home');
    expect(stage.endPointId).toBe('far');
  });

  it('sans aucune coordonnée hors zone, ne montre pas le départ', () => {
    const out = sanitizeWorkspaceForShareLink(workspace(), 100_000);
    expect(out.points).toEqual([]);
    expect(out.sections).toEqual([]);
  });

  it('rayon minimal de 200 m même si un rayon plus petit (ou nul) est demandé', () => {
    expect(MIN_PRIVATE_START_RADIUS_M).toBe(200);
    for (const radius of [0, 10, -5]) {
      const out = sanitizeWorkspaceForShareLink(workspace(), radius);
      for (const p of out.points) expect(distanceFromHomeM(p.lat)).toBeGreaterThan(200);
      for (const s of out.sections) {
        for (const [, lat] of s.geometry.coordinates) expect(distanceFromHomeM(lat)).toBeGreaterThan(200);
      }
    }
  });

  it('boucle : l’arrivée est aussi une zone privée', () => {
    const base = workspace();
    // Arrivée à ~45 m du départ : dans le rayon.
    const loop = {
      ...base,
      shapeMode: 'loop' as const,
      points: base.points.map((p) => (p.id === 'end' ? { ...p, lat: 45.8996 } : p)),
      sections: base.sections.map((s) =>
        s.id === 's3'
          ? { ...s, geometry: { type: 'LineString' as const, coordinates: [[6.1294, 45.9192], [6.1294, 45.9045], [6.1294, 45.8996]] as Array<[number, number]> } }
          : s,
      ),
    };
    const out = sanitizeWorkspaceForShareLink(loop as unknown as RouteWorkspaceState);
    const end = out.points.find((p) => p.id === 'end');
    expect(end?.name).toBe('Arrivée (zone privée masquée)');
    for (const p of out.points) expect(distanceFromHomeM(p.lat)).toBeGreaterThan(500);
  });

  it('idempotent sur une sortie déjà masquée (la base) : un point masqué n’est pas un centre', () => {
    const once = sanitizeWorkspaceForShareLink(workspace());
    const twice = sanitizeWorkspaceForShareLink(once);
    expect(twice.points.map((p) => [p.id, p.lat, p.lon])).toEqual(once.points.map((p) => [p.id, p.lat, p.lon]));
    expect(twice.sections.map((s) => s.geometry.coordinates.length)).toEqual(
      once.sections.map((s) => s.geometry.coordinates.length),
    );
  });
});
