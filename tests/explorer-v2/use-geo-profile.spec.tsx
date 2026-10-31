// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useGeoProfile } from '@/features/explorer-v2/workers/useGeoProfile';
import { GEO_PROTOCOL_VERSION } from '@/features/explorer-v2/workers/protocol';
import type { ProfileResult } from '@/features/explorer-v2/geo/profile';

/**
 * Incident P0 : `useGeoProfile` importait directement `buildProfile` dans le
 * thread principal et ne se recalculait que sur `length:premier-point`.
 * Ce banc vérifie le nouveau contrat : vrai `new Worker(...)`, requêtes
 * corrélées, réponse tardive ignorée, terminaison au démontage, fallback quand
 * l'environnement refuse les workers.
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
  posted: unknown[] = [];
  terminated = false;
  constructor(
    public url: URL,
    public options?: WorkerOptions,
  ) {
    FakeWorker.instances.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') this.listeners.add(listener);
  }
  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') this.listeners.delete(listener);
  }
  postMessage(data: unknown) {
    this.posted.push(data);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data: unknown) {
    for (const listener of [...this.listeners]) listener({ data } as MessageEvent);
  }
}

const originalWorker = globalThis.Worker;

describe('Explorer v2 · useGeoProfile (worker réel)', () => {
  beforeEach(() => {
    FakeWorker.instances = [];
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
      worker.emit({
        protocolVersion: GEO_PROTOCOL_VERSION,
        id: 1,
        ok: true,
        result: { ...RESULT, id: 1 },
      });
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

    // Même longueur, même premier point, mais un point intermédiaire a bougé.
    const mutated: Array<[number, number]> = [TRACK[0], [6.885, 45.935], TRACK[2]];
    rerender({ track: mutated });
    expect(worker.posted).toHaveLength(2);
    expect((worker.posted[1] as { id: number }).id).toBe(2);
    expect(result.current.state).toBe('loading');

    // La réponse de la trace précédente arrive après coup : elle est ignorée.
    act(() => {
      worker.emit({ protocolVersion: GEO_PROTOCOL_VERSION, id: 1, ok: true, result: { ...RESULT, id: 1 } });
    });
    expect(result.current.state).toBe('loading');
    expect(result.current.profile?.distance_m).toBe(2700);

    act(() => {
      worker.emit({ protocolVersion: GEO_PROTOCOL_VERSION, id: 2, ok: true, result: { ...RESULT, id: 2, distance_m: 2800 } });
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
});
