import { beforeEach, describe, expect, it } from 'vitest';
import { buildPublicRouteShare, carnetVisibilityFor, storyVisibilityFor, toCarnetPayload, toCommunityPostPayload, toStoryRouteSticker, toStoryRow } from '../communityShare';
import { createWorkspaceRecord, publishWorkspace, resetRouteCollabStoreForTests } from '../serverStore';
import type { RouteWorkspaceState } from '../types';

const NOW = '2026-11-19T08:00:00.000Z';
// Départ privé en (45.600, 6.100) ; le tracé s'en éloigne vers l'est (~ 700 m par pas de 0.01° de longitude).
const coords: Array<[number, number]> = Array.from({ length: 40 }, (_, i) => [6.1 + i * 0.01, 45.6 + i * 0.0005]);

function ws(): RouteWorkspaceState {
  const id = 'ws-share-1';
  return {
    id, tripId: 'trip-secret-1', title: 'Crête du Mont', status: 'draft', sport: 'marche', shapeMode: 'one_way',
    routingOptions: {}, headSeq: 0, reviewedSeq: null, publishedRevisionId: null, publishedRevisionNo: null, sourceOrigin: { kind: 'blank' },
    points: [
      { id: 'p1', workspaceId: id, kind: 'start', orderKey: 'A', lat: coords[0][1], lon: coords[0][0], eleM: 900, name: 'Chez moi', entityVersion: 1 },
      { id: 'p2', workspaceId: id, kind: 'finish', orderKey: 'Z', lat: coords[39][1], lon: coords[39][0], eleM: 1500, name: 'Sommet', entityVersion: 1 },
    ],
    sections: [{
      id: 's1', workspaceId: id, fromPointId: 'p1', toPointId: 'p2', mode: 'routed',
      geometry: { type: 'LineString', coordinates: coords }, distanceKm: 30, durationMin: 400, ascentM: 700, descentM: 100,
      surfaceSegments: [], routingInputHash: null,
      provenance: { provider: 'valhalla', calculatedAt: NOW, profile: 'marche', confidence: 'verified' }, warnings: [], entityVersion: 1,
    }],
    stages: [], variants: [], proposals: [], comments: [], kitItems: [],
    members: [{ userId: 'alice', displayName: 'Alice', role: 'owner' }],
    revisions: [], packs: [], participantPacks: [], updatedAt: NOW,
  };
}

function published() {
  const rec = createWorkspaceRecord(ws());
  const res = publishWorkspace({ workspaceId: rec.id, actorId: 'alice', actorName: 'Alice', expectedHeadSeq: 0, summary: 'v1' });
  if (res.status !== 'published') throw new Error('publication refusée');
  return res.workspace;
}

describe('Publier le tracé dans la communauté (10.9)', () => {
  beforeEach(() => resetRouteCollabStoreForTests());

  it('rien à publier sans version publiée', () => {
    expect(buildPublicRouteShare(createWorkspaceRecord(ws()))).toBeNull();
  });

  it('masque la zone de départ : aucune coordonnée à moins de 500 m du départ réel', () => {
    const share = buildPublicRouteShare(published());
    expect(share).not.toBeNull();
    const dist = (lon: number, lat: number) => {
      const dx = (lon - coords[0][0]) * 111_320 * Math.cos((coords[0][1] * Math.PI) / 180);
      const dy = (lat - coords[0][1]) * 110_540;
      return Math.hypot(dx, dy);
    };
    expect(share!.line.length).toBeGreaterThan(2);
    for (const [lon, lat] of share!.line) expect(dist(lon, lat)).toBeGreaterThan(500);
    expect(share!.startMasked).toBe(true);
  });

  it('la charge utile ne contient ni voyage, ni nom du départ, ni position', () => {
    const share = buildPublicRouteShare(published())!;
    const payload = toCommunityPostPayload(share, { audience: 'abonnies', caption: 'Belle crête', clientRequestId: '11111111-1111-4111-8111-111111111111' });
    const text = JSON.stringify(payload);
    expect(text).not.toContain('trip-secret-1');
    expect(text).not.toContain('Chez moi');
    expect(payload).not.toHaveProperty('place_lat');
    expect(payload).not.toHaveProperty('place_lng');
    expect(payload).toMatchObject({ post_type: 'share', audience: 'abonnies' });
    expect((payload.content as string)).toContain('Belle crête');
  });

  it('une audience club transmet le club, la story ne porte aucun lieu', () => {
    const share = buildPublicRouteShare(published())!;
    expect(toCommunityPostPayload(share, { audience: 'club', clubId: '22222222-2222-4222-8222-222222222222' })).toMatchObject({ club_id: '22222222-2222-4222-8222-222222222222' });
    expect(toStoryRouteSticker(share)).toEqual({ distanceKm: 30, place: null, altitudeM: null });
  });

  it('10.9 carnet : tracé assaini seulement, jamais de position de départ, de nuit ni de voyage ; club = carnet privé', () => {
    const share = buildPublicRouteShare(published())!;
    const p = toCarnetPayload(share, { audience: 'club', clubId: '22222222-2222-4222-8222-222222222222', caption: 'Belle crête', clientRequestId: '11111111-1111-4111-8111-111111111111' });
    const text = JSON.stringify(p);
    expect(text).not.toContain('trip-secret-1');
    expect(text).not.toContain('Chez moi');
    for (const k of ['start_lat', 'start_lng', 'lieu_depart', 'lieu_arrivee', 'club_id']) expect(p).not.toHaveProperty(k);
    expect(p).toMatchObject({ visibility: 'private', nights: [], moments: [], media: [], collaborators: [], post: { enabled: false }, client_request_id: '11111111-1111-4111-8111-111111111111:carnet' });
    expect((p.map_points as { trace: unknown[] }).trace.length).toBe(share.line.length);
    expect(toCarnetPayload(share, { audience: 'public' })).toMatchObject({ visibility: 'public' });
    expect(carnetVisibilityFor('abonnies')).toBe('friends');
  });

  it('10.9 story : texte et distance seulement, sans lieu ni coordonnée ; club et abonnés mappés', () => {
    const share = buildPublicRouteShare(published())!;
    const row = toStoryRow(share, { audience: 'club', clubId: '22222222-2222-4222-8222-222222222222', clientRequestId: '11111111-1111-4111-8111-111111111111' }, 'alice', 'story-1', 'carnet-1');
    expect(row).toMatchObject({ media_type: 'text', image_url: null, storage_path: null, visibility: 'club', club_id: '22222222-2222-4222-8222-222222222222', author_id: 'alice', linked_carnet_id: 'carnet-1', client_request_id: '11111111-1111-4111-8111-111111111111:story' });
    const text = JSON.stringify(row);
    expect(text).not.toMatch(/"lat"|"lng"|lieu|trip-secret-1|Chez moi/);
    expect(row.composition).toEqual([
      expect.objectContaining({ type: 'text', text: 'Crête du Mont' }),
      { type: 'sticker', kind: 'distance', value: 30 },
    ]);
    expect(storyVisibilityFor('abonnies')).toBe('followers');
    expect(toStoryRow(share, { audience: 'public' }, 'alice', 's', null)).not.toHaveProperty('club_id');
  });
});
