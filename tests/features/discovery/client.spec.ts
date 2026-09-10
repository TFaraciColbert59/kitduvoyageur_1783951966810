import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isLegacyTripadvisorConfigured,
  taLocationDetails,
  taSearchLocations,
} from '@/features/discovery/providers/tripadvisor/tripadvisorClient';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('tripadvisor server client', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('échoue en erreur de configuration sans aucun appel réseau si la clé manque', async () => {
    vi.stubEnv('TRIPADVISOR_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      taSearchLocations({ searchQuery: 'Islande', category: 'attractions' })
    ).rejects.toMatchObject({ code: 'config' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoie la clé côté serveur, language=fr, et valide la réponse', async () => {
    vi.stubEnv('TRIPADVISOR_API_KEY', 'server-secret-key');
    vi.stubEnv('TRIPADVISOR_API_BASE_URL', 'https://api.content.tripadvisor.com/api/v1');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ location_id: 1, name: 'Blue Lagoon', address_obj: { city: 'Grindavík' } }],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const items = await taSearchLocations({ searchQuery: 'Islande', category: 'attractions' });

    expect(items).toHaveLength(1);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain('key=server-secret-key');
    expect(calledUrl).toContain('language=fr');
    expect(calledUrl).toContain('category=attractions');
    expect(calledUrl.startsWith('https://')).toBe(true);
  });

  it('mappe les statuts HTTP vers la bonne erreur typée', async () => {
    vi.stubEnv('TRIPADVISOR_API_KEY', 'k');
    const cases: Array<[number, string]> = [
      [400, 'validation'],
      [401, 'auth'],
      [403, 'auth'],
      [404, 'not_found'],
      [429, 'quota'],
      [500, 'upstream'],
      [503, 'upstream'],
    ];

    for (const [status, code] of cases) {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ Message: 'x' }, status));
      vi.stubGlobal('fetch', fetchMock);
      await expect(
        taLocationDetails('123', {})
      ).rejects.toMatchObject({ code });
      vi.unstubAllGlobals();
    }
  });

  it('déclenche une erreur de timeout si la requête dépasse le délai', async () => {
    vi.stubEnv('TRIPADVISOR_API_KEY', 'k');
    vi.stubEnv('TRIPADVISOR_TIMEOUT_MS', '5');
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      })
    );

    await expect(
      taSearchLocations({ searchQuery: 'Islande', category: 'attractions' })
    ).rejects.toMatchObject({ code: 'timeout' });
  });

  it('rejette une réponse invalide (JSON malformé) avec une erreur de validation', async () => {
    vi.stubEnv('TRIPADVISOR_API_KEY', 'k');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('bad json');
        },
      } as unknown as Response)
    );

    await expect(
      taSearchLocations({ searchQuery: 'Islande', category: 'attractions' })
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('ne journalise jamais une URL contenant la clé', async () => {
    vi.stubEnv('TRIPADVISOR_API_KEY', 'super-secret-value');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ Message: 'x' }, 500)));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(
      taSearchLocations({ searchQuery: 'Islande', category: 'attractions' })
    ).rejects.toMatchObject({ code: 'upstream' });

    for (const spy of [errorSpy, warnSpy, logSpy]) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain('super-secret-value');
      }
    }
  });

  it('expose un état de configuration lisible sans valeur de clé', () => {
    vi.stubEnv('TRIPADVISOR_API_KEY', '');
    expect(isLegacyTripadvisorConfigured()).toBe(false);
    vi.stubEnv('TRIPADVISOR_API_KEY', 'real-key');
    expect(isLegacyTripadvisorConfigured()).toBe(true);
  });
});
