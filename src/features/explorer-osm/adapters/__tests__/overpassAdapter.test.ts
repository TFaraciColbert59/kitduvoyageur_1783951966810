import { beforeEach, describe, expect, it } from 'vitest';
import { resetOverpassQueue } from '@/lib/overpass';
import {
  DEFAULT_OVERPASS_CONFIG,
  OverpassError,
  executeOverpassQuery,
  queryPoisInBbox,
} from '../overpassAdapter';

/**
 * Plan 1.4, lot AA : l'explorateur OSM parle à UN seul serveur Overpass
 * (private.coffee), une requête à la fois, sans repli sur une autre instance.
 * Fetch simulé, aucun réseau réel.
 */
const ENDPOINT = 'https://overpass.private.coffee/api/interpreter';
const json = (body: unknown, status = 200, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': type } });
const asFetch = (f: unknown) => f as typeof fetch;

describe('executeOverpassQuery', () => {
  beforeEach(() => resetOverpassQueue());

  it('un seul serveur, POST, User-Agent de l’application (domaine du site)', async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const out = await executeOverpassQuery('[out:json];node(1);out;', {
      fetchImpl: asFetch(async (url: string, init: RequestInit) => {
        seen.push({ url, init });
        return json({ elements: [{ id: 1 }] });
      }),
    });
    expect(out).toEqual({ elements: [{ id: 1 }] });
    expect(seen.map((s) => s.url)).toEqual([ENDPOINT]);
    expect(seen[0].init.method).toBe('POST');
    const ua = (seen[0].init.headers as Record<string, string>)['User-Agent'];
    expect(ua).toBe(DEFAULT_OVERPASS_CONFIG.userAgent);
    expect(ua).toContain('koosmoweb.fr');
    expect(ua).not.toContain('lekitduvoyageur');
  });

  it('une panne du serveur ne bascule sur aucun autre : une seule requête, l’erreur est typée', async () => {
    const cases: Array<[Response | Error, string]> = [
      [new Response('quota', { status: 429 }), 'RATE_LIMITED'],
      [new Response('timeout', { status: 504 }), 'TIMEOUT'],
      [new Response('boom', { status: 500 }), 'SERVER_ERROR'],
      [new Response('<html>erreur</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }), 'INVALID_RESPONSE'],
      [new Error('offline'), 'NETWORK_ERROR'],
    ];
    for (const [answer, code] of cases) {
      resetOverpassQueue();
      const urls: string[] = [];
      const call = executeOverpassQuery('q', {
        fetchImpl: asFetch(async (url: string) => {
          urls.push(url);
          if (answer instanceof Error) throw answer;
          return answer.clone();
        }),
      });
      await expect(call).rejects.toMatchObject({ name: 'OverpassError', code });
      expect(urls, code).toEqual([ENDPOINT]);
    }
  });

  it('annulée avant de partir ou pendant l’attente dans la file : ABORTED, rien n’est envoyé', async () => {
    let calls = 0;
    const fetchImpl = asFetch(async () => {
      calls += 1;
      return json({ elements: [] });
    });
    const early = new AbortController();
    early.abort();
    await expect(executeOverpassQuery('q', { fetchImpl, signal: early.signal })).rejects.toMatchObject({ code: 'ABORTED' });

    // Annulée pendant qu'une autre requête occupe la file.
    const late = new AbortController();
    const first = executeOverpassQuery('q1', {
      fetchImpl: asFetch(async () => {
        await new Promise((r) => setTimeout(r, 30));
        return json({ elements: [] });
      }),
    });
    const second = executeOverpassQuery('q2', { fetchImpl, signal: late.signal });
    late.abort();
    await expect(second).rejects.toBeInstanceOf(OverpassError);
    await first;
    expect(calls).toBe(0);
  });

  it('un serveur muet après envoi : TIMEOUT à la fin du délai d’exécution, même sans signal de l’appelant (constat Codex)', async () => {
    const fetchImpl = asFetch(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        })
    );
    const t0 = Date.now();
    await expect(
      executeOverpassQuery('q', { fetchImpl, config: { ...DEFAULT_OVERPASS_CONFIG, timeoutSeconds: 0 }, executionMarginMs: 50 })
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(Date.now() - t0).toBeLessThan(2_000);
    // Et la file repart aussitôt.
    await expect(executeOverpassQuery('q2', { fetchImpl: asFetch(async () => json({ elements: [] })) })).resolves.toEqual({ elements: [] });
  });

  it('deux requêtes lancées ensemble ne se chevauchent jamais', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl = asFetch(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 15));
      inFlight -= 1;
      return json({ elements: [] });
    });
    const bbox = { south: 45.8, west: 6.8, north: 45.95, east: 6.95 };
    await Promise.all([
      executeOverpassQuery('a', { fetchImpl }),
      queryPoisInBbox(bbox, ['water'], 10, { fetchImpl } as never),
      executeOverpassQuery('c', { fetchImpl }),
    ]);
    expect(maxInFlight).toBe(1);
  });
});

describe('configuration', () => {
  it('ne porte plus d’adresse de serveur : aucune instance choisie par la configuration', () => {
    expect(Object.keys(DEFAULT_OVERPASS_CONFIG).sort()).toEqual(['maxSizeBytes', 'timeoutSeconds', 'userAgent']);
  });
});
