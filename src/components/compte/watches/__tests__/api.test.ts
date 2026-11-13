import { describe, expect, it, vi } from 'vitest';
import { createWatchesApi, WatchesApiError, type WatchApi } from '../api';
import { makeBatch, makeDevice, makeManifest } from './fixtures';

type Call = { url: string; init?: RequestInit };

function buildApi(respond: (call: Call) => { status?: number; body: unknown }): {
  api: WatchApi;
  calls: Call[];
} {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    const { status = 200, body } = respond(call);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  return { api: createWatchesApi(fetchImpl, '/api/watches'), calls };
}

describe('D03 — client HTTP montres', () => {
  it('encode le diagnostic et les drapeaux natifs', async () => {
    const { api, calls } = buildApi(() => ({
      body: {
        status: 'available',
        diagnostic: {},
        matrix: [],
        ficheIds: [],
        capabilities: {},
        devices: [],
        persistence: 'process_memory',
      },
    }));
    await api.getStatus({
      platform: 'apple_watch',
      deviceId: 'watch 1',
      xcodeWatchKitTargetPresent: true,
      runtimeBridgeInjected: true,
    });
    const url = calls[0].url;
    expect(url).toContain('/api/watches/status?');
    expect(url).toContain('platform=apple_watch');
    expect(url).toContain('deviceId=watch+1');
    expect(url).toContain('xcodeWatchKitTargetPresent=1');
    expect(url).toContain('runtimeBridgeInjected=1');
  });

  it('déclare une montre et transmet le profil complet', async () => {
    const profile = makeDevice();
    const { api, calls } = buildApi(() => ({
      body: { profile, capabilities: {} },
    }));
    await api.registerDevice(profile);
    expect(calls[0].url).toBe('/api/watches/devices');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      deviceId: 'watch-1',
      platform: 'apple_watch',
      permissions: { healthMetricsRead: 'indeterminate' },
    });
  });

  it('envoie les lots de séance dans l’enveloppe attendue', async () => {
    const batch = makeBatch();
    const { api, calls } = buildApi(() => ({
      body: {
        ack: {
          watchSessionId: batch.watchSessionId,
          ackedThroughSeq: 1,
          ackedEventSeq: 0,
          summaryAcked: false,
          canonicalClientSessionId: batch.watchSessionId,
          ackedAtUtcMs: 1,
        },
        session: {},
        replayed: false,
      },
    }));
    await api.ingestBatch(batch);
    expect(calls[0].url).toBe('/api/watches/sessions');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ batch });
  });

  it('utilise le chemin par paquet pour les blocs et la vérification', async () => {
    const chunk = {
      packId: 'pack-1',
      routeRevision: 1,
      chunkIndex: 0,
      totalChunks: 1,
      byteLength: 100,
      resourceIdsCovered: ['route'],
      chunkChecksum: 'c',
    };
    const { api, calls } = buildApi(() => ({
      body: { ack: { packId: 'pack-1', routeRevision: 1, ackedChunkIndex: 0 }, pack: {} },
    }));

    await api.ingestChunk(chunk);
    expect(calls[0].url).toBe('/api/watches/packs/pack-1/chunks');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ chunk });

    await api.verifyPack('pack-1', 'checksum-ok');
    expect(calls[1].url).toBe('/api/watches/packs/pack-1/verify');
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({
      checksumSha256: 'checksum-ok',
    });
  });

  it('prépare un paquet avec son nombre de blocs', async () => {
    const manifest = makeManifest();
    const { api, calls } = buildApi(() => ({ body: { pack: {} } }));
    await api.stagePack(manifest, 4);
    expect(calls[0].url).toBe('/api/watches/packs');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      manifest,
      totalChunks: 4,
    });
  });

  it('construit une trame, enregistre la disposition et bascule la source', async () => {
    const { api, calls } = buildApi((call) => {
      if (call.url.includes('/live-sync/frame')) return { body: { frame: {} } };
      if (call.url.includes('/fields/validate')) {
        return { body: { valid: true, normalizedPages: [], errors: [] } };
      }
      return { body: { layout: { valid: true, normalizedPages: [], errors: [] } } };
    });

    await api.buildFrame({
      sessionId: 'session-1',
      routeId: 'route-1',
      metrics: {
        distanceM: 1000,
        elevGainM: 100,
        movingS: 600,
        elapsedS: 700,
        offRoute: false,
        paused: false,
        heartRateBpm: null,
      },
      nowUtcMs: 1_700_000_000_000,
    });
    expect(calls[0].url).toBe('/api/watches/live-sync/frame');
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      sessionId: 'session-1',
      routeId: 'route-1',
      metrics: { heartRateBpm: null },
    });

    await api.setLayout({
      sport: 'rando',
      maxSlotsPerPage: 2,
      pages: [['distance_total_m']],
    });
    expect(calls[1].url).toBe('/api/watches/live-sync');
    expect(JSON.parse(String(calls[1].init?.body))).toMatchObject({
      action: 'set_layout',
    });

    await api.handoff({ sessionId: 'session-1', toSource: 'watch', lastAcceptedSeq: 4 });
    expect(JSON.parse(String(calls[2].init?.body))).toMatchObject({
      action: 'handoff',
      toSource: 'watch',
      lastAcceptedSeq: 4,
    });
  });

  it('traduit une erreur HTTP en WatchesApiError sans inventer de succès', async () => {
    const { api } = buildApi(() => ({
      status: 409,
      body: { error: 'Révision incompatible.', code: 'revision_conflict' },
    }));
    await expect(api.verifyPack('pack-1', 'bad')).rejects.toMatchObject({
      name: 'WatchesApiError',
      status: 409,
      code: 'revision_conflict',
    });
    await expect(api.listPacks()).rejects.toBeInstanceOf(WatchesApiError);
  });
});
