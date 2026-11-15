import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireUserMock = vi.hoisted(() =>
  vi.fn(async () => ({
    ok: true as const,
    user: { id: 'user-route-1', email: 'test@lkdv.test' },
    supabase: {},
  })),
);

vi.mock('@/lib/api/requireUser', () => ({
  requireUser: requireUserMock,
}));

import { resetWatchStore } from '@/features/compte/server/watches';
import { GET as statusGET } from '../status/route';
import { GET as sessionsGET, POST as sessionsPOST } from '../sessions/route';
import { POST as packsPOST } from '../packs/route';
import { POST as chunksPOST } from '../packs/[packId]/chunks/route';
import { POST as verifyPOST } from '../packs/[packId]/verify/route';
import { GET as liveGET, POST as livePOST } from '../live-sync/route';
import { makeBatch, makeManifest } from '@/components/compte/watches/__tests__/fixtures';

const params = (packId: string) => ({ params: Promise.resolve({ packId }) });

beforeEach(() => {
  resetWatchStore();
  requireUserMock.mockClear();
});

describe('D03 — routes API montres', () => {
  it('GET /status renvoie le diagnostic réel et accepte les drapeaux de diagnostic', async () => {
    const unavailable = await statusGET(
      new Request('http://localhost/api/watches/status'),
    );
    expect(unavailable.status).toBe(200);
    const defaultPayload = await unavailable.json();
    expect(defaultPayload.status).toBe('native_target_unavailable');
    expect(defaultPayload.matrix).toHaveLength(3);

    const available = await statusGET(
      new Request(
        'http://localhost/api/watches/status?xcodeWatchKitTargetPresent=1&wearOsGradleModulePresent=1&runtimeBridgeInjected=1',
      ),
    );
    expect((await available.json()).status).toBe('available');
  });

  it('POST /sessions ingère un lot idempotent puis GET /sessions le liste', async () => {
    const batch = makeBatch();
    const post = await sessionsPOST(
      new Request('http://localhost/api/watches/sessions', {
        method: 'POST',
        body: JSON.stringify({ batch }),
      }),
    );
    expect(post.status).toBe(200);
    const payload = await post.json();
    expect(payload.ack.ackedThroughSeq).toBe(1);
    expect(payload.session.points).toHaveLength(1);
    expect(payload.replayed).toBe(false);

    const replay = await sessionsPOST(
      new Request('http://localhost/api/watches/sessions', {
        method: 'POST',
        body: JSON.stringify({ batch }),
      }),
    );
    expect((await replay.json()).replayed).toBe(true);

    const list = await sessionsGET();
    const sessionsPayload = await list.json();
    expect(sessionsPayload.total).toBe(1);
    expect(sessionsPayload.sessions[0].points).toHaveLength(1);
  });

  it('refuse un lot invalide avec un statut 422 explicite', async () => {
    const response = await sessionsPOST(
      new Request('http://localhost/api/watches/sessions', {
        method: 'POST',
        body: JSON.stringify({ batch: { batchId: 'x' } }),
      }),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe('invalid_batch');
  });

  it('prépare, transfère et vérifie un paquet hors ligne', async () => {
    const manifest = makeManifest();
    const staged = await packsPOST(
      new Request('http://localhost/api/watches/packs', {
        method: 'POST',
        body: JSON.stringify({ manifest, totalChunks: 4 }),
      }),
    );
    expect(staged.status).toBe(201);
    const stagedPayload = await staged.json();
    expect(stagedPayload.pack.status).toBe('queued');
    expect(stagedPayload.pack.capabilities.viewBaseMap).toBe(false);

    for (let chunkIndex = 0; chunkIndex < 4; chunkIndex += 1) {
      const response = await chunksPOST(
        new Request(`http://localhost/api/watches/packs/pack-1/chunks`, {
          method: 'POST',
          body: JSON.stringify({
            chunk: {
              packId: 'pack-1',
              routeRevision: 3,
              chunkIndex,
              totalChunks: 4,
              byteLength: 1000,
              resourceIdsCovered: [manifest.resources[chunkIndex].resourceId],
              chunkChecksum: `c-${chunkIndex}`,
            },
          }),
        }),
        params('pack-1'),
      );
      expect(response.status).toBe(200);
      expect((await response.json()).ack.ackedChunkIndex).toBe(chunkIndex);
    }

    const verified = await verifyPOST(
      new Request('http://localhost/api/watches/packs/pack-1/verify', {
        method: 'POST',
        body: JSON.stringify({ checksumSha256: 'checksum-ok' }),
      }),
      params('pack-1'),
    );
    expect(verified.status).toBe(200);
    const verifiedPayload = await verified.json();
    expect(verifiedPayload.pack.status).toBe('available');
    expect(verifiedPayload.pack.capabilities.localPlaceSearch).toBe(false);
  });

  it('refuse un bloc dont le packId ne correspond pas à la route', async () => {
    const response = await chunksPOST(
      new Request('http://localhost/api/watches/packs/pack-1/chunks', {
        method: 'POST',
        body: JSON.stringify({
          chunk: {
            packId: 'pack-2',
            routeRevision: 1,
            chunkIndex: 0,
            totalChunks: 1,
            byteLength: 1,
            resourceIdsCovered: ['route'],
            chunkChecksum: 'c',
          },
        }),
      }),
      params('pack-1'),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('pack_mismatch');
  });

  it('construit une trame Live Sync et ne remplit pas les capteurs absents', async () => {
    const response = await livePOST(
      new Request('http://localhost/api/watches/live-sync', {
        method: 'POST',
        body: JSON.stringify({
          action: 'build_frame',
          sessionId: 'session-1',
          routeId: 'route-1',
          metrics: {
            distanceM: 1200,
            elevGainM: 100,
            movingS: 600,
            elapsedS: 700,
            heartRateBpm: null,
            currentSpeedMps: null,
            offRoute: false,
            paused: false,
          },
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.frame.frameSeq).toBe(1);
    const heartRate = payload.frame.customFields.find(
      (field: { key: string }) => field.key === 'heart_rate_bpm',
    );
    expect(heartRate).toMatchObject({ available: false, value: null, formatted: '—' });
  });

  it('valide une disposition de champs et refuse une entrée vide', async () => {
    const valid = await livePOST(
      new Request('http://localhost/api/watches/live-sync', {
        method: 'POST',
        body: JSON.stringify({
          action: 'set_layout',
          config: {
            sport: 'rando',
            maxSlotsPerPage: 2,
            pages: [['distance_total_m', 'heart_rate_bpm']],
          },
        }),
      }),
    );
    expect(valid.status).toBe(200);
    expect((await valid.json()).layout.valid).toBe(true);

    const invalid = await livePOST(
      new Request('http://localhost/api/watches/live-sync', {
        method: 'POST',
        body: JSON.stringify({ action: 'set_layout', config: { sport: 'rando' } }),
      }),
    );
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).code).toBe('invalid_live_sync');

    const missingSession = await liveGET(
      new Request('http://localhost/api/watches/live-sync'),
    );
    expect(missingSession.status).toBe(422);
  });

  it('exige une session pour toutes les routes', async () => {
    requireUserMock.mockResolvedValueOnce({
      ok: false as const,
      response: new Response(JSON.stringify({ error: 'Session requise.' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }) as never,
    } as never);
    const response = await statusGET(
      new Request('http://localhost/api/watches/status'),
    );
    expect(response.status).toBe(401);
  });
});
