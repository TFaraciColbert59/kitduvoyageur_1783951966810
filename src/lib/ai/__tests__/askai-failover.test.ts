/**
 * AI-P0.4 — `askAI` doit PARCOURIR la chaine, pas la consulter.
 *
 * Complement direct de `provider-failover.test.ts`. Celui-la prouve que la
 * chaine existe et est ordonnee ; celui-ci prouve qu elle est EMPRUNTEE. Les
 * deux etaient necessaires : la chaine pouvait exister, etre correcte, et
 * n etre appelée par personne — c etait precisement l etat mesure le
 * 2026-09-29, ou un deuxieme provider repondant etait configure et jamais
 * sollicite.
 *
 * Aucun appel reseau ici : les providers sont des doublures. Ce qui est teste
 * est l ORDRE DES TENTATIVES et l ATTRIBUTION DE LA PROVENANCE, pas la
 * latence d un vrai modele (celle-la est mesuree par sonde, dans
 * `provider-failover.test.ts`).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AIProvider } from '../providers/types';

const essayes = vi.hoisted(() => [] as string[]);

vi.mock('../providers', () => {
  const muet: AIProvider = {
    name: 'muet',
    isAvailable: () => true,
    complete: async () => {
      throw new Error('delai depasse');
    },
  };
  const bavard: AIProvider = {
    name: 'bavard',
    isAvailable: () => true,
    complete: async () => {
      return 'reponse reelle du second provider';
    },
  };
  const tiers: Record<string, AIProvider[]> = {
    fast: [muet, bavard],
    heavy: [muet, bavard],
  };
  return {
    providerChain: (tier: string) => tiers[tier] ?? [muet],
    modelNameFor: (p: { name: string }, tier: string) => p.name + '/' + tier,
    getProvider: (tier: string) => (tiers[tier] ?? [muet])[0],
  };
});

vi.mock('../responseStore', () => ({
  getCached: async () => null,
  setCached: async () => undefined,
}));

vi.mock('../quota', () => ({ consumeQuota: async () => true }));

import { askAI } from '../askAI';

beforeEach(() => {
  essayes.length = 0;
});

const REQ = {
  feature: 'trail-narrative',
  tier: 'fast' as const,
  system: 'systeme',
  prompt: 'prompt',
  maxTokens: 256,
  cacheTtlSeconds: 0,
};

describe('AI-P0.4 — askAI traverse la chaine de providers', () => {
  it('AI-P0.4a un premier provider muet ne stoppe pas la tentative', async () => {
    const r = await askAI(REQ);
    expect(r.degraded).toBe(false);
    expect(r.provider).toBe('bavard');
  });

  it('AI-P0.4b la reponse attribuee est celle du provider qui a repondu', async () => {
    const r = await askAI(REQ);
    expect(r.text).toBe('reponse reelle du second provider');
    expect(r.model).toBe('bavard/fast');
  });

  it('AI-P0.4c la chaine est parcourue dans l ordre, et l ordre est visible', async () => {
    // Un test qui ne verrait que le resultat passerait meme si la chaine
    // tentait les deux dans le desordre. On note donc chaque tentative.
    const ordre = vi.fn();
    vi.doMock('../providers', () => ({
      providerChain: () => [
        { name: 'un', isAvailable: () => true, complete: async () => { ordre('un'); throw new Error('nope'); } },
        { name: 'deux', isAvailable: () => true, complete: async () => { ordre('deux'); return 'ok'; } },
      ],
      modelNameFor: (p: { name: string }) => p.name,
      getProvider: () => ({ name: 'un' }),
    }));
    vi.resetModules();
    const { askAI: askRecharge } = await import('../askAI');
    const r = await askRecharge(REQ);
    expect(ordre.mock.calls.map((c) => c[0])).toEqual(['un', 'deux']);
    expect(r.provider).toBe('deux');
  });
});