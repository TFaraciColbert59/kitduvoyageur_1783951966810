import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OVERPASS_ENDPOINTS,
  OVERPASS_TASK_CAP_MS,
  OverpassBusyError,
  overpassPost,
  resetOverpassQueue,
  serializeOverpass,
} from '../overpass';

/**
 * Plan 1.4, lot AA : la règle Overpass du site en un endroit. Un seul serveur,
 * une requête à la fois par instance. Fetch simulé, aucun réseau réel.
 */
describe('serializeOverpass — une requête à la fois', () => {
  beforeEach(() => resetOverpassQueue());

  it('les tâches lancées ensemble passent une par une, dans l’ordre', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const order: number[] = [];
    const task = (n: number, ms: number) => () =>
      (async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, ms));
        order.push(n);
        inFlight -= 1;
        return n;
      })();
    const out = await Promise.all([serializeOverpass(task(1, 30)), serializeOverpass(task(2, 5)), serializeOverpass(task(3, 1))]);
    expect(out).toEqual([1, 2, 3]);
    expect(order).toEqual([1, 2, 3]);
    expect(maxInFlight).toBe(1);
  });

  it('un échec ne bloque pas la file : la tâche suivante part, l’échec revient à son appelant', async () => {
    const failing = serializeOverpass(async () => {
      throw new Error('serveur muet');
    });
    const next = serializeOverpass(async () => 'suivante');
    await expect(failing).rejects.toThrow('serveur muet');
    await expect(next).resolves.toBe('suivante');
  });

  it('une tâche restée plus que maxWaitMs en file n’est pas envoyée (OverpassBusyError)', async () => {
    const started = vi.fn();
    const slow = serializeOverpass(() => new Promise<void>((r) => setTimeout(r, 60)));
    const impatient = serializeOverpass(
      async () => {
        started();
      },
      { maxWaitMs: 10 }
    );
    await expect(impatient).rejects.toBeInstanceOf(OverpassBusyError);
    await slow;
    expect(started).not.toHaveBeenCalled();
    // Et la file continue ensuite.
    await expect(serializeOverpass(async () => 'ok', { maxWaitMs: 10 })).resolves.toBe('ok');
  });

  it('le délai d’attente ne court que dans la file : une tâche prompte passe même avec maxWaitMs court', async () => {
    await expect(serializeOverpass(async () => 'vite', { maxWaitMs: 1 })).resolves.toBe('vite');
  });

  it('une tâche qui ne finit jamais : l’appelant pressé reçoit OverpassBusyError à temps (constat Codex)', async () => {
    serializeOverpass(() => new Promise<never>(() => undefined));
    const started = vi.fn();
    const t0 = Date.now();
    await expect(
      serializeOverpass(
        async () => {
          started();
        },
        { maxWaitMs: 20 }
      )
    ).rejects.toBeInstanceOf(OverpassBusyError);
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(started).not.toHaveBeenCalled();
  });

  it('une tâche qui ne finit jamais ne retient la file que OVERPASS_TASK_CAP_MS', async () => {
    vi.useFakeTimers();
    try {
      serializeOverpass(() => new Promise<never>(() => undefined));
      const next = vi.fn(async () => 'suite');
      const pending = serializeOverpass(next);
      await vi.advanceTimersByTimeAsync(OVERPASS_TASK_CAP_MS - 1);
      expect(next).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2);
      await expect(pending).resolves.toBe('suite');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('overpassPost — le seul serveur', () => {
  it('private.coffee seulement, POST, requête dans data, User-Agent nommant l’application', async () => {
    expect([...OVERPASS_ENDPOINTS]).toEqual(['https://overpass.private.coffee/api/interpreter']);
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response('{"elements":[]}', { status: 200 });
    }) as unknown as typeof fetch;
    await overpassPost('[out:json];node(1);out;', { fetchImpl });
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe('https://overpass.private.coffee/api/interpreter');
    expect(seen[0].init.method).toBe('POST');
    expect(seen[0].init.body).toBe(`data=${encodeURIComponent('[out:json];node(1);out;')}`);
    const headers = seen[0].init.headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/^kitduvoyageur\/1\.0 \(/);
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('le User-Agent de l’appelant est gardé, le signal aussi', async () => {
    let init: RequestInit | undefined;
    const controller = new AbortController();
    const fetchImpl = (async (_url: string, i: RequestInit) => {
      init = i;
      return new Response('{}');
    }) as unknown as typeof fetch;
    await overpassPost('x', { fetchImpl, userAgent: 'kitduvoyageur/1.0 (test)', signal: controller.signal });
    expect((init?.headers as Record<string, string>)['User-Agent']).toBe('kitduvoyageur/1.0 (test)');
    expect(init?.signal).toBe(controller.signal);
  });
});
