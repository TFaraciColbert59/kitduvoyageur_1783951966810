// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

const buildProfileMock = vi.hoisted(() =>
  vi.fn(async ({ id }: { id: number }) => ({
    id,
    points: [{ d: 0, ele: 1200 }],
    distance_m: 2700,
    gain_m: 12,
    loss_m: 4,
    min_m: 1190,
    max_m: 1210,
    source: 'aws-terrarium' as const,
  })),
);

vi.mock('@/features/explorer-v2/geo/profile', () => ({
  buildProfile: buildProfileMock,
}));

import { useGeoProfile } from '@/features/explorer-v2/workers/useGeoProfile';
import { GEO_PROTOCOL_VERSION } from '@/features/explorer-v2/workers/protocol';
import type { ProfileResult } from '@/features/explorer-v2/geo/profile';

/**
 * Contrat du hook profil altimétrique : vrai worker, corrélation des requêtes,
 * et surtout **dégradation garantie** — un worker qui refuse le message, qui
 * crash (`error`) ou dont le message est illisible (`messageerror`) doit
 * basculer sur le thread principal, jamais laisser la feuille en `loading`.
 */

const TRACK: Array<[number, number]> = [
  [6.87, 45.92],
  [6.88, 45.93],
  [6.89, 45.94],
];

const RESULT: ProfileResult = {
  id: 0,
  points: [{ d: 0, ele: 1200 }],
  distance_m: 2700,
  gain_m: 12,
  loss_m: 4,
  min_m: 1190,
  max_m: 1210,
  source: 'aws-terrarium',
};

class FakeWorker {
  static instances: FakeWorker[] = [];
  listeners = new Set<(event: MessageEvent) => void>();
  errorListeners = new Set<() => void>();
  messageErrorListeners = new Set<() => void>();
  posted: unknown[] = [];
  terminated = false;
  postMessageThrows = false;
  static nextPostThrows = false;
  constructor(
    public url: URL,
    public options?: WorkerOptions,
  ) {
    FakeWorker.instances.push(this);
  }
  addEventListener(type: string, listener: never) {
    if (type === 'message') this.listeners.add(listener);
    else if (type === 'error') this.errorListeners.add(listener);
    else if (type === 'messageerror') this.messageErrorListeners.add(listener);
  }
  removeEventListener(type: string, listener: never) {
    if (type === 'message') this.listeners.delete(listener);
    else if (type === 'error') this.errorListeners.delete(listener);
    else if (type === 'messageerror') this.messageErrorListeners.delete(listener);
  }
  postMessage(data: unknown) {
    if (this.postMessageThrows || FakeWorker.nextPostThrows) {
      FakeWorker.nextPostThrows = false;
      throw new Error('DataCloneError simulé');
    }
    this.posted.push(data);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data: unknown) {
    for (const listener of [...this.listeners]) listener({ data } as MessageEvent);
  }
  emitError() {
    for (const listener of [...this.errorListeners]) listener();
  }
  emitMessageError() {
    for (const listener of [...this.messageErrorListeners]) listener();
  }
}

const originalWorker = globalThis.Worker;

describe('Explorer v2 · useGeoProfile (worker réel + dégradation)', () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    FakeWorker.nextPostThrows = false;
    buildProfileMock.mockClear();
    buildProfileMock.mockImplementation(async ({ id }: { id: number }) => ({
      id,
      points: [{ d: 0, ele: 1200 }],
      distance_m: 2700,
      gain_m: 12,
      loss_m: 4,
      min_m: 1190,
      max_m: 1210,
      source: 'aws-terrarium' as const,
    }));
    (globalThis as { Worker?: unknown }).Worker = FakeWorker;
  });

  afterEach(() => {
    cleanup();
    (globalThis as { Worker?: unknown }).Worker = originalWorker;
  });

  it('crée un module worker et lui envoie une requête versionnée et corrélée', () => {
    const { result } = renderHook(() => useGeoProfile(TRACK));
    expect(result.current.state).toBe('loading');
    expect(FakeWorker.instances).toHaveLength(1);
    const worker = FakeWorker.instances[0];
    expect(worker.options).toEqual({ type: 'module' });
    expect(worker.posted).toHaveLength(1);
    expect(worker.posted[0]).toMatchObject({
      protocolVersion: GEO_PROTOCOL_VERSION,
      id: 1,
      op: 'profile',
      positions: TRACK,
    });
  });

  it('publie le profil quand la réponse porte le bon id', () => {
    const { result } = renderHook(() => useGeoProfile(TRACK));
    const worker = FakeWorker.instances[0];
    act(() => {
      worker.emit({ protocolVersion: GEO_PROTOCOL_VERSION, id: 1, ok: true, result: { ...RESULT, id: 1 } });
    });
    expect(result.current.state).toBe('ready');
    expect(result.current.profile?.distance_m).toBe(2700);
  });

  it('recalcule sur une mutation interne de la trace et ignore la réponse tardive', () => {
    const { result, rerender } = renderHook(({ track }) => useGeoProfile(track), {
      initialProps: { track: TRACK },
    });
    const worker = FakeWorker.instances[0];
    act(() => {
      worker.emit({ protocolVersion: GEO_PROTOCOL_VERSION, id: 1, ok: true, result: { ...RESULT, id: 1 } });
    });
    expect(result.current.state).toBe('ready');

    const mutated: Array<[number, number]> = [TRACK[0], [6.885, 45.935], TRACK[2]];
    rerender({ track: mutated });
    expect(worker.posted).toHaveLength(2);
    expect((worker.posted[1] as { id: number }).id).toBe(2);
    expect(result.current.state).toBe('loading');

    act(() => {
      worker.emit({ protocolVersion: GEO_PROTOCOL_VERSION, id: 1, ok: true, result: { ...RESULT, id: 1 } });
    });
    expect(result.current.state).toBe('loading');
    expect(result.current.profile?.distance_m).toBe(2700);

    act(() => {
      worker.emit({
        protocolVersion: GEO_PROTOCOL_VERSION,
        id: 2,
        ok: true,
        result: { ...RESULT, id: 2, distance_m: 2800 },
      });
    });
    expect(result.current.state).toBe('ready');
    expect(result.current.profile?.distance_m).toBe(2800);
  });

  it('termine le worker au démontage et ne le recrée pas', () => {
    const { unmount, rerender } = renderHook(() => useGeoProfile(TRACK));
    const worker = FakeWorker.instances[0];
    rerender();
    expect(FakeWorker.instances).toHaveLength(1);
    unmount();
    expect(worker.terminated).toBe(true);
  });

  it('ne calcule rien quand le hook est désactivé', () => {
    const { result } = renderHook(() => useGeoProfile(TRACK, { enabled: false }));
    expect(FakeWorker.instances).toHaveLength(0);
    expect(result.current.state).toBe('idle');
  });

  it('bascule sur le thread principal si postMessage échoue (jamais bloqué en loading)', async () => {
    FakeWorker.nextPostThrows = true;
    const { result } = renderHook(() => useGeoProfile(TRACK));
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(FakeWorker.instances[0].terminated).toBe(true);
    expect(result.current.profile?.distance_m).toBe(2700);
  });

  it('dégrade sur error du worker : fallback calculé côté thread principal', async () => {
    const { result } = renderHook(() => useGeoProfile(TRACK));
    const worker = FakeWorker.instances[0];
    act(() => {
      worker.emitError();
    });
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(buildProfileMock).toHaveBeenCalledTimes(1);
    expect(worker.terminated).toBe(true);
    expect(result.current.profile?.distance_m).toBe(2700);
  });

  it('dégrade sur messageerror du worker', async () => {
    const { result } = renderHook(() => useGeoProfile(TRACK));
    const worker = FakeWorker.instances[0];
    act(() => {
      worker.emitMessageError();
    });
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(worker.terminated).toBe(true);
  });

  it('expose error quand le worker répond ok:false (aucune valeur inventée)', () => {
    const { result } = renderHook(() => useGeoProfile(TRACK));
    const worker = FakeWorker.instances[0];
    act(() => {
      worker.emit({ protocolVersion: GEO_PROTOCOL_VERSION, id: 1, ok: false, error: 'DEM indisponible' });
    });
    expect(result.current.state).toBe('error');
    expect(result.current.profile).toBeNull();
  });

  it('expose error si le fallback échoue aussi', async () => {
    buildProfileMock.mockRejectedValueOnce(new Error('DEM cassé'));
    const { result } = renderHook(() => useGeoProfile(TRACK));
    act(() => {
      FakeWorker.instances[0].emitError();
    });
    await waitFor(() => expect(result.current.state).toBe('error'));
  });
});
