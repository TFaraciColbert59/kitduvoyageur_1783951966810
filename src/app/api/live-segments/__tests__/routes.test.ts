import { describe, expect, it } from 'vitest';
import { GET as listGET } from '../route';
import { GET as detailGET } from '../[id]/route';
import { POST as effortPOST } from '../[id]/efforts/route';
import { POST as syncPOST } from '../sync/route';

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

interface ListPayload {
  items: Array<{
    id: string;
    name: string;
    sport: string;
    points: unknown[];
    ghostProfiles: Array<{ kind: string; label: string }>;
    distanceFromViewerM: number | null;
  }>;
  dataSource: string;
  catalogSize: number;
}

interface DetailPayload {
  segment: {
    id: string;
    version: number;
    sport: string;
    direction: string;
    totalDistanceM: number;
    points: Array<{ lat: number; lon: number; cumulativeDistanceM: number }>;
  };
  dataSource: string;
}

function effortBody(segment: DetailPayload['segment'], overrides: Record<string, unknown> = {}) {
  return {
    effortId: `${segment.id}:1700000000000:1`,
    segmentId: segment.id,
    segmentVersion: segment.version,
    sport: segment.sport,
    direction: 'forward',
    startedAtMs: 1_700_000_000_000,
    finishedAtMs: 1_700_000_600_000,
    elapsedMs: 600_000,
    distanceCoveredM: segment.totalDistanceM,
    coverageRatio: 1,
    isValidForLeaderboard: true,
    beatPr: true,
    beatKom: true,
    queuedForSync: false,
    ...overrides,
  };
}

describe('API /api/live-segments', () => {
  it('liste le catalogue avec les traces et les fantômes assainis', async () => {
    const response = await listGET(new Request('http://localhost/api/live-segments?limit=20'));
    expect(response.status).toBe(200);
    const body = await json<ListPayload>(response);
    expect(body.dataSource).toBe('demo_catalog');
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].points.length).toBeGreaterThan(2);
    expect(body.items[0].ghostProfiles[0]?.kind).toBe('target');
  });

  it('filtre par sport et par rayon sans inventer de résultat', async () => {
    const hiking = await json<ListPayload>(
      await listGET(new Request('http://localhost/api/live-segments?sport=hiking')),
    );
    expect(hiking.items).toHaveLength(1);
    expect(hiking.items[0].sport).toBe('hiking');

    const far = await json<ListPayload>(
      await listGET(
        new Request('http://localhost/api/live-segments?lat=-33.86&lon=151.2&radius=1000'),
      ),
    );
    expect(far.items).toEqual([]);
  });

  it('refuse une position incomplète ou un paramètre inconnu', async () => {
    const incomplete = await listGET(
      new Request('http://localhost/api/live-segments?lat=45.8'),
    );
    expect(incomplete.status).toBe(422);
    const unknown = await listGET(
      new Request('http://localhost/api/live-segments?viewerId=someone'),
    );
    expect(unknown.status).toBe(422);
  });

  it('sert une définition complète puis 404 sur un identifiant inconnu', async () => {
    const list = await json<ListPayload>(
      await listGET(new Request('http://localhost/api/live-segments?limit=1')),
    );
    const id = list.items[0].id;
    const response = await detailGET(new Request(`http://localhost/api/live-segments/${id}`), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(200);
    const body = await json<DetailPayload>(response);
    expect(body.segment.id).toBe(id);
    expect(body.segment.points.length).toBeGreaterThan(2);

    const missing = await detailGET(new Request('http://localhost/api/live-segments/nope'), {
      params: Promise.resolve({ id: 'nope' }),
    });
    expect(missing.status).toBe(404);
  });

  it('valide un effort cohérent et scelle le verdict serveur', async () => {
    const list = await json<ListPayload>(
      await listGET(new Request('http://localhost/api/live-segments?sport=cycling&limit=1')),
    );
    const id = list.items[0].id;
    const detail = await json<DetailPayload>(
      await detailGET(new Request(`http://localhost/api/live-segments/${id}`), {
        params: Promise.resolve({ id }),
      }),
    );

    const response = await effortPOST(
      new Request(`http://localhost/api/live-segments/${id}/efforts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(effortBody(detail.segment)),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(200);
    const body = await json<{
      accepted: boolean;
      persisted: boolean;
      effort: { isValidForLeaderboard: boolean; beatPr: boolean; beatKom: boolean };
    }>(response);
    expect(body.accepted).toBe(true);
    expect(body.persisted).toBe(false);
    expect(body.effort.isValidForLeaderboard).toBe(true);
    // Aucun fantôme PR/KOM dans le catalogue : le serveur ne recopie pas `true`.
    expect(body.effort.beatPr).toBe(false);
    expect(body.effort.beatKom).toBe(false);
  });

  it('invalide une couverture insuffisante ou un saut GPS', async () => {
    const list = await json<ListPayload>(
      await listGET(new Request('http://localhost/api/live-segments?limit=1')),
    );
    const id = list.items[0].id;
    const detail = await json<DetailPayload>(
      await detailGET(new Request(`http://localhost/api/live-segments/${id}`), {
        params: Promise.resolve({ id }),
      }),
    );

    const short = await effortPOST(
      new Request(`http://localhost/api/live-segments/${id}/efforts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          effortBody(detail.segment, {
            distanceCoveredM: detail.segment.totalDistanceM * 0.2,
          }),
        ),
      }),
      { params: Promise.resolve({ id }) },
    );
    const shortBody = await json<{
      effort: { isValidForLeaderboard: boolean; invalidationReason: string };
    }>(short);
    expect(short.status).toBe(200);
    expect(shortBody.effort.isValidForLeaderboard).toBe(false);
    expect(shortBody.effort.invalidationReason).toBe('insufficient_coverage');

    const teleport = await effortPOST(
      new Request(`http://localhost/api/live-segments/${id}/efforts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(effortBody(detail.segment, { elapsedMs: 5_000 })),
      }),
      { params: Promise.resolve({ id }) },
    );
    const teleportBody = await json<{ effort: { invalidationReason: string } }>(teleport);
    expect(teleportBody.effort.invalidationReason).toBe('gps_teleport_detected');
  });

  it('refuse un corps d’effort incomplet', async () => {
    const list = await json<ListPayload>(
      await listGET(new Request('http://localhost/api/live-segments?limit=1')),
    );
    const id = list.items[0].id;
    const response = await effortPOST(
      new Request(`http://localhost/api/live-segments/${id}/efforts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ segmentId: id }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(422);
    const body = await json<{ code: string }>(response);
    expect(body.code).toBe('invalid_effort');
  });

  it('refuse une version de segment périmée', async () => {
    const list = await json<ListPayload>(
      await listGET(new Request('http://localhost/api/live-segments?limit=1')),
    );
    const id = list.items[0].id;
    const detail = await json<DetailPayload>(
      await detailGET(new Request(`http://localhost/api/live-segments/${id}`), {
        params: Promise.resolve({ id }),
      }),
    );
    const response = await effortPOST(
      new Request(`http://localhost/api/live-segments/${id}/efforts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(effortBody(detail.segment, { segmentVersion: 99 })),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(422);
    const body = await json<{ code: string }>(response);
    expect(body.code).toBe('segment_version_mismatch');
  });

  it('prépare les références appareil et refuse les incompatibilités', async () => {
    const device = {
      deviceId: 'garmin-1',
      deviceName: 'Edge 1040',
      platform: 'garmin_connect',
      supportsLiveSegments: true,
      maxSyncedSegments: 10,
      supportedSports: ['cycling'],
      hasPermission: true,
      isOnline: true,
    };
    const response = await syncPOST(
      new Request('http://localhost/api/live-segments/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ device, segmentIds: ['demo-semnoz'] }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await json<{
      references: Array<{ segmentId: string; checksum: string; targetGhost: unknown }>;
      skippedSegmentIds: string[];
    }>(response);
    expect(body.references).toHaveLength(1);
    expect(body.references[0].segmentId).toBe('demo-semnoz');
    expect(body.references[0].checksum).toMatch(/^[0-9a-f]{8}$/);
    expect(body.references[0].targetGhost).not.toBeNull();

    const optedOut = await syncPOST(
      new Request('http://localhost/api/live-segments/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ device, segmentIds: ['demo-semnoz'], optedIn: false }),
      }),
    );
    expect(optedOut.status).toBe(422);
    const optedOutBody = await json<{ code: string }>(optedOut);
    expect(optedOutBody.code).toBe('privacy_opted_out');

    const incompatible = await syncPOST(
      new Request('http://localhost/api/live-segments/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          device: { ...device, supportsLiveSegments: false, platform: 'web_unsupported' },
          segmentIds: ['demo-semnoz'],
        }),
      }),
    );
    expect(incompatible.status).toBe(422);
  });
});
