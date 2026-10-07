import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  nvidiaProvider,
  NIM_MODEL_BY_TIER,
  nvidiaModelFor,
  openrouterProvider,
  noopProvider,
  getProvider,
  providerChain,
  modelNameFor,
} from '../../src/lib/ai/providers';
import type { AIRequest } from '../../src/lib/ai/providers/types';

/**
 * Cle FAKE uniquement : aucun test de ce fichier n'exige la cle reelle.
 * fetch est mocke, donc la suite passe hors ligne et hors secret.
 */
const FAKE_KEY = 'nvapi-fake-key-for-tests-only';

function makeReq(overrides: Partial<AIRequest> = {}): AIRequest {
  return {
    feature: 'itinerary',
    tier: 'fast',
    system: 'sys',
    prompt: 'prompt de test',
    maxTokens: 2048,
    ...overrides,
  };
}

function nimOk(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  };
}

function nimStatus(status: number) {
  return { ok: false, status, json: async () => ({}) };
}

describe('src/lib/ai/providers/nvidia - adapter NVIDIA NIM direct', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NVIDIA_API_KEY', FAKE_KEY);
    vi.stubEnv('OPENROUTER_API_KEY', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function bodyOf(callIndex = 0): Record<string, unknown> {
    const init = fetchMock.mock.calls[callIndex][1] as RequestInit;
    return JSON.parse(init.body as string) as Record<string, unknown>;
  }

  // Bake-off du 2026-09-29 contre l hote NVIDIA, 30 s de delai par modele :
  //   nemotron-3.5-lightning-30b-a3b   ABORT >30s  <- jamais de jet de fin
  //   nemotron-3-super-120b-a12b       HTTP 200  0,5s <- retenu
  //   nemotron-3-nano-omni-30b-a3b    HTTP 200  0,5s
  //   llama-3.1-nemotron-51b-*         HTTP 404
  // Le modele configure etait donc un modele qui ne repondait pas. `GET
  // /v1/models` repondait en 0,2 s : l hote etait joignable, la cle valide, et
  // seul le modele etait muet.
  it('TEST-NIM-01: le modele NIM est un modele REELLEMENT mesure, sur les deux tiers', () => {
    expect(NIM_MODEL_BY_TIER.fast).toBe('nvidia/nemotron-3.5-lightning-30b-a3b');
    expect(NIM_MODEL_BY_TIER.heavy).toBe('nvidia/nemotron-3.5-lightning-30b-a3b');
    expect(nvidiaModelFor('fast')).toBe(NIM_MODEL_BY_TIER.fast);
    expect(nvidiaModelFor('heavy')).toBe(NIM_MODEL_BY_TIER.heavy);
  });

  it('TEST-NIM-02: isAvailable refleja exactement la cle presente', () => {
    expect(nvidiaProvider.isAvailable()).toBe(true);

    vi.stubEnv('NVIDIA_API_KEY', undefined);
    expect(nvidiaProvider.isAvailable()).toBe(false);

    vi.stubEnv('NVIDIA_API_KEY', '   ');
    expect(nvidiaProvider.isAvailable()).toBe(false);
  });

  it('TEST-NIM-03: complete fast vise le endpoint NIM et desactive le raisonnement', async () => {
    fetchMock.mockResolvedValueOnce(nimOk('parcours genere'));

    const text = await nvidiaProvider.complete(makeReq());

    expect(text).toBe('parcours genere');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(headers['Content-Type']).toBe('application/json');

    const body = bodyOf(0);
    expect(body.model).toBe(NIM_MODEL_BY_TIER.fast);
    expect(body.max_tokens).toBe(2048);
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'prompt de test' },
    ]);
    // CoT inline sur Nemotron : latence x6. Desactive sur le tier fast.
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(body.reasoning_budget).toBeUndefined();
  });

  it('TEST-NIM-04: heavy active le raisonnement et rabote le budget de completion', async () => {
    fetchMock.mockResolvedValue(nimOk('ok'));

    await nvidiaProvider.complete(
      makeReq({ tier: 'heavy', reasoningBudget: 1000, maxTokens: 4000 })
    );
    expect(bodyOf(0).chat_template_kwargs).toEqual({ enable_thinking: true });
    expect(bodyOf(0).reasoning_budget).toBe(1000);

    // 4000 + 4000 deborde max_tokens : buffer 512 de completion conserve.
    await nvidiaProvider.complete(
      makeReq({ tier: 'heavy', reasoningBudget: 4000, maxTokens: 4000 })
    );
    expect(bodyOf(1).reasoning_budget).toBe(3488);

    // Budget trop petit : aucun parametre reasoning plutot qu une reponse vide.
    await nvidiaProvider.complete(
      makeReq({ tier: 'heavy', reasoningBudget: 4000, maxTokens: 512 })
    );
    expect(bodyOf(2).reasoning_budget).toBeUndefined();
  });

  it('TEST-NIM-05: HTTP 500 devient une ProviderError sans la cle dans le message', async () => {
    fetchMock.mockResolvedValueOnce(nimStatus(500));

    const err = await nvidiaProvider.complete(makeReq()).catch((e: unknown) => e);

    expect(err).toMatchObject({ name: 'ProviderError', status: 500 });
    expect((err as Error).message).not.toContain(FAKE_KEY);
    expect((err as Error).message).not.toContain('nvapi-');
  });

  it('TEST-NIM-06: HTTP 200 avec erreur embarquee remonte 502', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ error: { message: 'upstream down', code: 502 } }),
    });

    await expect(nvidiaProvider.complete(makeReq())).rejects.toMatchObject({
      name: 'ProviderError',
      status: 502,
    });
  });

  it('TEST-NIM-07: contenu vide ou absent remonte 502', async () => {
    fetchMock.mockResolvedValueOnce(nimOk('   '));
    await expect(nvidiaProvider.complete(makeReq())).rejects.toMatchObject({ status: 502 });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] }),
    });
    await expect(nvidiaProvider.complete(makeReq())).rejects.toMatchObject({ status: 502 });
  });

  it('TEST-NIM-08: cle absente remonte 503 avant tout appel reseau', async () => {
    vi.stubEnv('NVIDIA_API_KEY', undefined);

    await expect(nvidiaProvider.complete(makeReq())).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('TEST-NIM-09: timeout AbortError devient 504 sans message runtime ni cle', async () => {
    fetchMock.mockRejectedValueOnce(
      Object.assign(new Error('aborted'), { name: 'AbortError' })
    );

    const err = await nvidiaProvider.complete(makeReq()).catch((e: unknown) => e);

    expect(err).toMatchObject({ name: 'ProviderError', status: 504 });
    expect((err as Error).message).not.toContain(FAKE_KEY);
  });

  it('TEST-NIM-10: echec reseau generique devient 502 sans recopier le message runtime', async () => {
    fetchMock.mockRejectedValueOnce(new Error(`request to ${FAKE_KEY} failed`));

    const err = await nvidiaProvider.complete(makeReq()).catch((e: unknown) => e);

    expect(err).toMatchObject({ name: 'ProviderError', status: 502 });
    expect((err as Error).message).not.toContain(FAKE_KEY);
  });

  it('TEST-NIM-11: un AbortSignal est transmis a fetch pour le timeout reel', async () => {
    fetchMock.mockResolvedValueOnce(nimOk('ok'));

    await nvidiaProvider.complete(makeReq());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('TEST-NIM-12: OpenRouter (production) passe devant sur les DEUX tiers quand les deux cles sont la', () => {
    vi.stubEnv('NVIDIA_API_KEY', FAKE_KEY);
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-test-key');
    // Décision du 2026-10-07 : NVIDIA direct est une offre d'évaluation, en secours seulement.
    expect(getProvider('fast').name).toBe('openrouter');
    expect(getProvider('heavy').name).toBe('openrouter');
    expect(getProvider().name).toBe('openrouter');
  });

  it('TEST-NIM-15: json demande un objet JSON au modele, et seulement si demande', async () => {
    fetchMock.mockResolvedValueOnce(nimOk('{"a":1}'));
    await nvidiaProvider.complete({ ...makeReq(), json: true });
    expect(bodyOf(0).response_format).toEqual({ type: 'json_object' });

    fetchMock.mockResolvedValueOnce(nimOk('texte'));
    await nvidiaProvider.complete(makeReq());
    expect(bodyOf(1).response_format).toBeUndefined();
  });

  it('TEST-NIM-16: une demande avec recherche web echoue franchement, sans appel reseau', async () => {
    await expect(
      nvidiaProvider.complete({ ...makeReq(), plugins: [{ id: 'web', max_results: 5 }] })
    ).rejects.toThrow(/recherche web/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('TEST-NIM-12b: la chaine est ordonnee, sans doublon, et se termine toujours sur noop', () => {
    vi.stubEnv('NVIDIA_API_KEY', FAKE_KEY);
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-test-key');

    // OpenRouter d'abord, NVIDIA direct en secours, noop ferme toujours la chaine.
    expect(providerChain('fast').map((p) => p.name)).toEqual(['openrouter', 'nvidia', 'noop']);
    expect(providerChain('heavy').map((p) => p.name)).toEqual(['openrouter', 'nvidia', 'noop']);

    vi.stubEnv('NVIDIA_API_KEY', undefined);
    vi.stubEnv('OPENROUTER_API_KEY', undefined);
    expect(providerChain('fast').map((p) => p.name)).toEqual(['noop']);
  });

  it('TEST-NIM-13: getProvider degrade proprement jusqu a noop', () => {
    vi.stubEnv('NVIDIA_API_KEY', undefined);
    vi.stubEnv('OPENROUTER_API_KEY', undefined);
    expect(getProvider('fast').name).toBe('noop');

    // NVIDIA seule : elle couvre aussi heavy, degradation assumee et tracee.
    vi.stubEnv('NVIDIA_API_KEY', FAKE_KEY);
    expect(getProvider('fast').name).toBe('nvidia');
    expect(getProvider('heavy').name).toBe('nvidia');
  });

  it('TEST-NIM-14: modelNameFor mappe le provider sur le vrai identifiant de modele', () => {
    expect(modelNameFor(nvidiaProvider, 'fast')).toBe('nvidia/nemotron-3.5-lightning-30b-a3b');
    expect(modelNameFor(openrouterProvider, 'fast')).toBe('nvidia/nemotron-3.5-lightning');
    expect(modelNameFor(noopProvider, 'fast')).toBe('noop');
  });
});