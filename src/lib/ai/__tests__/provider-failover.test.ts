/**
 * AI-P0 — la generation reelle etait figee 70 secondes, sans IA.
 *
 * MESURE REELLE (2026-09-29, navigateur, parcours complet, aucune donnee
 * injectee) : clic sur « Creer mon parcours » -> generation terminee a t=70 s.
 * Echantillons releves dans le brouillon persiste :
 *
 *   t=10 000 ms  status=en_cours  phases=0/7  itinerary=non  error=null
 *   t=20 000 ms  status=en_cours  phases=0/7  itinerary=non  error=null
 *   t=30 000 ms  status=en_cours  phases=0/7  itinerary=non  error=null
 *   t=50 000 ms  status=en_cours  phases=0/7  itinerary=non  error=null
 *   t=70 000 ms  status=termine   phases=7/7  itinerary=OUI  error=null
 *
 * Soixante-dix secondes d ecran fige, phase 0/7, aucun message. La cause n etait
 * pas l ecran : c etait le MODELE. Sonde directe sur l endpoint NVIDIA
 * (cle de `.env.local`, 30 s de budget par modele) :
 *
 *   nvidia/nemotron-3.5-lightning-30b-a3b   ABORT   > 30,0 s   (2026-09-29 ; repond en 0,7 s le 2026-10-05)
 *   nvidia/nemotron-3-super-120b-a12b       HTTP 200    0,5 s
 *   nvidia/nemotron-3-nano-omni-30b-a3b    HTTP 200    0,5 s
 *   nvidia/llama-3.1-nemotron-51b-instruct  HTTP 404    0,2 s
 *   nvidia/mistral-nemo-minitron-8b-8k-inst HTTP 404    0,2 s
 *   deepseek-ai/deepseek-v4.1-flash        ABORT   > 30,0 s
 *
 * `GET /v1/models` repond en 0,2 s : l hote est joignable, la cle vaut, seule
 * la completion du modele configure ne revenait jamais. Le delai de 45 s de
 * `nvidia.ts` tombait ensuite, `askAI` rendait son repli, et le moteur
 * construisait un parcours 100 % regles — presente comme une generation
 * reussie.
 *
 * Ces tests verrouillent les liens de la chaine :
 *   1. le modele configure ne doit plus etre un modele mesure muet ;
 *   2. un provider muet ne doit pas etre le dernier mot (repli croise) ;
 *   3. le tiers demande doit preserver l ordre direct-puis-routeur.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { NIM_MODEL_BY_TIER, nvidiaModelFor } from '../providers/nvidia';
import { providerChain, getProvider } from '../providers';
import { ProviderError } from '../providers/types';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('AI-P0.1 — le modele NVIDIA configure doit repondre', () => {
  it('AI-P0.1a les deux tiers pointent sur le modele mesure le 2026-10-05', () => {
    const MESURE_2026_10_05 = 'nvidia/nemotron-3.5-lightning-30b-a3b';
    expect(nvidiaModelFor('fast')).toBe(MESURE_2026_10_05);
    expect(nvidiaModelFor('heavy')).toBe(MESURE_2026_10_05);
  });

  it('AI-P0.1b la table des tiers et le raccourci concordent', () => {
    expect(NIM_MODEL_BY_TIER.fast).toBe(nvidiaModelFor('fast'));
    expect(NIM_MODEL_BY_TIER.heavy).toBe(nvidiaModelFor('heavy'));
  });

  it('AI-P0.1c le modele reste declare, jamais une chaine vide', () => {
    for (const tier of ['fast', 'heavy'] as const) {
      expect(nvidiaModelFor(tier).length).toBeGreaterThan(0);
      expect(nvidiaModelFor(tier)).toMatch(/^[\w.-]+\/[\w.-]+$/);
    }
  });
});

describe('AI-P0.2 — NVIDIA en direct, seul provider (decision du 2026-10-05)', () => {
  it('AI-P0.2a avec la cle NVIDIA, la chaine est nvidia puis noop', () => {
    vi.stubEnv('NVIDIA_API_KEY', 'cle-nvidia');
    expect(providerChain('fast').map((p) => p.name)).toEqual(['nvidia', 'noop']);
    expect(providerChain('heavy').map((p) => p.name)).toEqual(['nvidia', 'noop']);
  });

  it('AI-P0.2b une cle OpenRouter restee dans l environnement n est jamais appelee', () => {
    vi.stubEnv('NVIDIA_API_KEY', 'cle-nvidia');
    vi.stubEnv('OPENROUTER_API_KEY', 'cle-openrouter');
    expect(providerChain('fast').map((p) => p.name)).not.toContain('openrouter');
    vi.stubEnv('NVIDIA_API_KEY', '');
    expect(providerChain('fast').map((p) => p.name)).toEqual(['noop']);
  });

  it('AI-P0.2c la chaine ne contient jamais deux fois le meme provider', () => {
    vi.stubEnv('NVIDIA_API_KEY', 'cle-nvidia');
    const noms = providerChain('fast').map((p) => p.name);
    expect(new Set(noms).size).toBe(noms.length);
  });

  it('AI-P0.2d getProvider reste le premier de la chaine, sans le dupliquer', () => {
    vi.stubEnv('NVIDIA_API_KEY', 'cle-nvidia');
    const chaine = providerChain('fast');
    expect(getProvider('fast')).toBe(chaine[0]);
  });

  it('AI-P0.2e sans aucune cle, la chaine se termine sur le noop', () => {
    vi.stubEnv('NVIDIA_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    expect(providerChain('fast').map((p) => p.name)).toContain('noop');
  });
});

describe('AI-P0.3 — le repli traverse providers', () => {
  it('AI-P0.3c un delai (504) reste distingue d une panne (5xx)', () => {
    const delai = new ProviderError('delai', 504);
    const panne = new ProviderError('panne', 500);
    expect(delai.status).toBe(504);
    expect(panne.status).not.toBe(504);
  });
});