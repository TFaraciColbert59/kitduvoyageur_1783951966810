/**
 * T17 — suggestions de missions :
 *   (a) déterminisme sans fournisseur IA (priorité de catégorie, départage stable) ;
 *   (b) exclusions : missions actives et distinctions obtenues ;
 *   (c) IA facultative : ne peut que réordonner des identifiants du serveur ;
 *   (d) identifiants hors catalogue / réponses malformées / panne → repli ;
 *   (e) route : 401 sans session, 200 nominal sans aucun montant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn() }));
vi.mock('@/features/progression/server/challengeService', () => ({
  getAvailableMissionModels: vi.fn(),
  getUserMissions: vi.fn(),
}));

import { createClient as createServerClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  getAvailableMissionModels,
  getUserMissions,
} from '@/features/progression/server/challengeService';
import {
  applyAiRanking,
  deterministicSuggestions,
  suggestMissions,
} from '@/features/progression/server/missionSuggestions';
import { GET } from '@/app/api/progression/suggestions/route';

const SESSION_USER = '22222222-2222-4222-8222-222222222222';
const mockedServer = vi.mocked(createServerClient);
const mockedRateLimit = vi.mocked(enforceRateLimit);
const mockedModels = vi.mocked(getAvailableMissionModels);
const mockedMissions = vi.mocked(getUserMissions);

const MODELS = [
  { id: 'mission_community_review', title: 'Avis utile', description: 'D', targetCount: 1, period: 'ever' as const },
  { id: 'mission_prep_departure_checks', title: 'Contrôles', description: 'D', targetCount: 1, period: 'ever' as const },
  { id: 'mission_discovery_first_activity', title: 'Première', description: 'D', targetCount: 1, period: 'ever' as const },
  { id: 'mission_progress_itinerancy', title: 'Itinérance', description: 'D', targetCount: 1, period: 'ever' as const },
];

function emptyMissions() {
  return [] as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedServer.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: SESSION_USER } } }) },
  } as never);
  mockedRateLimit.mockResolvedValue(null as never);
  mockedModels.mockResolvedValue(MODELS);
  mockedMissions.mockResolvedValue(emptyMissions());
});

describe('suggestions de missions', () => {
  it('(a) déterminisme : ordre stable et raisons du catalogue', async () => {
    const first = deterministicSuggestions('u1', MODELS, new Set(), 3);
    const second = deterministicSuggestions('u1', MODELS, new Set(), 3);

    expect(first).toEqual(second);
    expect(first[0].modelId).toBe('mission_discovery_first_activity');
    expect(first.every((suggestion) => suggestion.reason.length > 10)).toBe(true);
    // Aucun champ monétaire dans la réponse.
    expect(Object.keys(first[0])).toEqual(['modelId', 'title', 'description', 'reason']);
  });

  it('(b) exclusions : mission active et distinction obtenue ne sont pas suggérées', async () => {
    mockedMissions.mockResolvedValue([
      { id: 'a1', modelId: 'mission_discovery_first_activity', state: 'active', targetCount: 1, period: 'ever', progress: 0, completedAt: null, createdAt: '' },
      { id: 'a2', modelId: 'mission_prep_departure_checks', state: 'active', targetCount: 1, period: 'ever', progress: 1, completedAt: '2026-10-01T00:00:00.000Z', createdAt: '' },
    ] as never);

    const suggestions = await suggestMissions('u1');

    expect(suggestions.map((s) => s.modelId)).not.toContain('mission_discovery_first_activity');
    expect(suggestions.map((s) => s.modelId)).not.toContain('mission_prep_departure_checks');
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('(c) IA : réordonne des identifiants existants uniquement', async () => {
    const base = deterministicSuggestions('u1', MODELS, new Set(), 3);
    const ranker = vi.fn(async () => [base[2].modelId, base[0].modelId]);

    const ranked = await applyAiRanking(base, ranker);

    expect(ranked[0].modelId).toBe(base[2].modelId);
    expect(ranked[1].modelId).toBe(base[0].modelId);
    expect(ranked).toHaveLength(base.length);
  });

  it('(d1) IA hors catalogue / non-texte → ignorée, repli sûr', async () => {
    const base = deterministicSuggestions('u1', MODELS, new Set(), 3);
    const ranker = vi.fn(async () => ['mission_inexistante', 42, { id: 'mission_x' }] as never);

    const ranked = await applyAiRanking(base, ranker);

    expect(ranked.map((s) => s.modelId)).toEqual(base.map((s) => s.modelId));
  });

  it('(d2) panne IA → sélection déterministe conservée', async () => {
    const base = deterministicSuggestions('u1', MODELS, new Set(), 3);
    const ranker = vi.fn(async () => {
      throw new Error('ai down');
    });

    const ranked = await applyAiRanking(base, ranker);
    expect(ranked.map((s) => s.modelId)).toEqual(base.map((s) => s.modelId));
  });

  it('(e1) route : 401 sans session', async () => {
    mockedServer.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
    } as never);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mockedModels).not.toHaveBeenCalled();
  });

  it('(e2) route : 200 nominal, payload sans montant', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.suggestions)).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/points?|xp|euros?|cents?/i);
    expect(mockedModels).toHaveBeenCalledTimes(1);
  });
});
