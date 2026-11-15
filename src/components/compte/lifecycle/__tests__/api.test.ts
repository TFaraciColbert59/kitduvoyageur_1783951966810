import { describe, expect, it, vi } from 'vitest';
import { createLifecycleApi, LifecycleApiError, type LifecycleApi } from '../api';
import type { LifecycleActivityRecord } from '@/features/activity/lifecycle';
import { makeRecord } from './fixtures';

type Call = { url: string; init?: RequestInit };

function buildApi(respond: (call: Call) => { status?: number; body: unknown }): {
  api: LifecycleApi;
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
  return { api: createLifecycleApi(fetchImpl, '/api/activities/lifecycle'), calls };
}

describe('A02 — client API du cycle de vie', () => {
  it('encode la recherche, la corbeille et le numéro de requête', async () => {
    const { api, calls } = buildApi(() => ({
      body: { items: [], totalMatched: 0, expiredDeletedCount: 0, requestSeq: 7 },
    }));
    await api.list({ q: 'vélo  Vercors', trash: true, requestSeq: 7, limit: 20 });
    const url = calls[0].url;
    expect(url).toContain('/api/activities/lifecycle?');
    expect(url).toContain('q=v%C3%A9lo++Vercors');
    expect(url).toContain('trash=1');
    expect(url).toContain('requestSeq=7');
    expect(url).toContain('limit=20');
  });

  it('déballe la fiche détaillée et transmet la révision attendue', async () => {
    const record = makeRecord();
    const { api, calls } = buildApi((call) =>
      call.init?.method === 'PATCH'
        ? { body: { record, sportChanged: false, projectionEvent: null } }
        : { body: { record } }
    );

    const detail = await api.get(record.id);
    expect(detail.id).toBe(record.id);

    await api.updateMetadata(record.id, { title: 'Nouveau titre' }, record.revision);
    const patchCall = calls[1];
    expect(patchCall.init?.method).toBe('PATCH');
    expect(JSON.parse(String(patchCall.init?.body))).toEqual({
      title: 'Nouveau titre',
      expectedRevision: record.revision,
    });
  });

  it('marque explicitement un aperçu de recadrage', async () => {
    const { api, calls } = buildApi(() => ({
      body: { preview: { ok: true }, record: null },
    }));
    await api.previewCrop('abc', { startIndex: 1, endIndex: 3 });
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body).toMatchObject({ startIndex: 1, endIndex: 3, previewOnly: true });
  });

  it('utilise les verbes et corps attendus pour chaque action', async () => {
    const record = makeRecord();
    const { api, calls } = buildApi(() => ({ body: { record } }));

    await api.correct(record.id, { distanceMethod: 'manual_override', manualDistanceM: 5000 });
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      kind: 'distance_elevation',
      distanceMethod: 'manual_override',
      manualDistanceM: 5000,
    });

    await api.smoothGps(record.id, 12);
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({
      kind: 'gps_spikes',
      maxPlausibleSpeedMs: 12,
    });

    await api.revertCorrection(record.id);
    expect(calls[2].init?.method).toBe('DELETE');

    await api.trash(record.id);
    expect(JSON.parse(String(calls[3].init?.body))).toEqual({ action: 'delete' });

    await api.restore(record.id);
    expect(JSON.parse(String(calls[4].init?.body))).toEqual({ action: 'restore' });
  });

  it('traduit une erreur 409 en LifecycleApiError avec la révision courante', async () => {
    const { api } = buildApi(() => ({
      status: 409,
      body: {
        error: 'Cette activité a été modifiée entre-temps.',
        code: 'revision_conflict',
        currentRevision: 8,
      },
    }));

    await expect(api.get('abc')).rejects.toMatchObject({
      name: 'LifecycleApiError',
      status: 409,
      code: 'revision_conflict',
      currentRevision: 8,
    });
  });

  it('refuse de fabriquer un succès quand le serveur répond sans corps', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 500 }));
    const api = createLifecycleApi(fetchImpl);
    await expect(api.get('abc')).rejects.toBeInstanceOf(LifecycleApiError);
  });

  it('retourne le record de la fiche, pas l’enveloppe HTTP', async () => {
    const record: LifecycleActivityRecord = makeRecord({ title: 'Enveloppe' });
    const { api } = buildApi(() => ({ body: { record } }));
    const result = await api.get(record.id);
    expect(result.title).toBe('Enveloppe');
  });
});
