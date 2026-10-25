import { describe, it, expect, vi, beforeEach } from 'vitest';

const { askAIMock, supabaseMock } = vi.hoisted(() => {
  const insertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'test-job-uuid' }, error: null }),
    }),
  });

  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });

  let lastUpsertPayload: any = null;
  const upsertMock = vi.fn((payload) => {
    lastUpsertPayload = payload;
    return {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockImplementation(() => Promise.resolve({
          data: {
            id: 'test-guide-uuid',
            ...lastUpsertPayload,
          },
          error: null,
        })),
      }),
    };
  });

  const selectMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: { name: 'Portugal' }, error: null }),
    }),
  });

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'ai_jobs') {
        return { insert: insertMock, update: updateMock };
      }
      if (table === 'country_practical_guides') {
        return { select: selectMock, upsert: upsertMock };
      }
      if (table === 'countries_geo') {
        return { select: selectMock };
      }
      return { select: selectMock, insert: insertMock, update: updateMock, upsert: upsertMock };
    }),
  };

  return {
    askAIMock: vi.fn(),
    supabaseMock: client,
  };
});

vi.mock('@/lib/ai/askAI', () => ({
  askAI: askAIMock,
}));

vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: () => supabaseMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseMock),
}));

import {
  PRACTICAL_SECTIONS,
  SECTION_FRESHNESS_DAYS,
  buildSectionPrompt,
  parseSectionResponse,
  generateSectionGuide,
  generateCountryFullGuide,
} from '../../src/lib/ai/jobs/generateCountryGuide';

describe('src/lib/ai/jobs/generateCountryGuide — Guides pratiques par section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TEST-CG-PRACTICAL-01: les 6 sections cibles et leurs durées de fraîcheur sont exactes', () => {
    expect(PRACTICAL_SECTIONS).toEqual([
      'formalites',
      'transport',
      'budget',
      'sante',
      'securite',
      'meilleure_saison',
    ]);

    expect(SECTION_FRESHNESS_DAYS.formalites).toBe(30);
    expect(SECTION_FRESHNESS_DAYS.securite).toBe(30);
    expect(SECTION_FRESHNESS_DAYS.transport).toBe(90);
    expect(SECTION_FRESHNESS_DAYS.budget).toBe(90);
    expect(SECTION_FRESHNESS_DAYS.sante).toBe(90);
    expect(SECTION_FRESHNESS_DAYS.meilleure_saison).toBe(365);
  });

  it('TEST-CG-PRACTICAL-02: buildSectionPrompt construit un prompt exigeant du JSON strict', () => {
    const { system, prompt } = buildSectionPrompt('formalites', 'Portugal', 'PT', 2026);
    expect(system).toContain('Portugal (PT)');
    expect(system).toContain('2026');
    expect(system).toContain('JSON strict');
    expect(system).toContain('sources');
    expect(prompt).toContain('Portugal (PT)');
    expect(prompt).toContain('Formalités d\'entrée & Visa');
  });

  it('TEST-CG-PRACTICAL-03: parseSectionResponse extrait le JSON propre et les blocs markdown code fences', () => {
    const rawDirect = JSON.stringify({
      content_md: 'Pour entrer au Portugal, une carte d identité ou un passeport en cours de validité suffit pour les citoyens de l UE.',
      sources: [
        { title: 'Diplomatie France', url: 'https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/conseils-par-pays-destination/portugal/' },
      ],
    });

    const parsedDirect = parseSectionResponse(rawDirect);
    expect(parsedDirect).not.toBeNull();
    expect(parsedDirect?.content_md).toContain('Portugal');
    expect(parsedDirect?.sources.length).toBe(1);

    const rawMarkdownFenced = `Voici les informations demandées :\n\`\`\`json\n${rawDirect}\n\`\`\`\nBon voyage !`;
    const parsedFenced = parseSectionResponse(rawMarkdownFenced);
    expect(parsedFenced).not.toBeNull();
    expect(parsedFenced?.content_md).toContain('Portugal');
    expect(parsedFenced?.sources[0].title).toBe('Diplomatie France');
  });

  it('TEST-CG-PRACTICAL-04: parseSectionResponse retourne null sur contenu invalide sans throw', () => {
    expect(parseSectionResponse('')).toBeNull();
    expect(parseSectionResponse('pas de json du tout')).toBeNull();
    expect(parseSectionResponse('{"content_md": "trop court"}')).toBeNull();
    expect(parseSectionResponse('{ invalid json without content_md')).toBeNull();
  });

  it('TEST-CG-PRACTICAL-04B: parseSectionResponse répare les guillemets simples ou extrait par regex', () => {
    // Cas de guillemets simples ou guillemet non fermé sur URL
    const malformed = `{"content_md": "Consignes de sécurité importantes pour les randonnées en montagne et zones côtières.", "sources": [{"title": 'Source Test', "url": "https://example.com/test/'}]}`;
    const parsed = parseSectionResponse(malformed);
    expect(parsed).not.toBeNull();
    expect(parsed?.content_md).toContain('Consignes de sécurité');
  });

  it('TEST-CG-PRACTICAL-05: generateSectionGuide utilise askAI en mode fast et gère le fallback', async () => {
    askAIMock.mockResolvedValueOnce({
      text: JSON.stringify({
        content_md: 'Le réseau ferroviaire Comboios de Portugal (CP) relie facilement Lisbonne et Porto.',
        sources: [{ title: 'CP Portugal', url: 'https://www.cp.pt' }],
      }),
      model: 'nvidia/nemotron-3.5-lightning:free',
      degraded: false,
      cached: false,
      provider: 'openrouter',
    });

    const result = await generateSectionGuide('PT', 'transport', { force: true });

    expect(askAIMock).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'country-practical-guide',
        tier: 'fast',
      })
    );

    expect(result.country_code).toBe('PT');
    expect(result.section).toBe('transport');
    expect(result.degraded).toBe(false);
    expect(result.content_md).toContain('Comboios de Portugal');
  });

  it('TEST-CG-PRACTICAL-06: generateCountryFullGuide génère toutes les 6 sections', async () => {
    askAIMock.mockResolvedValue({
      text: JSON.stringify({
        content_md: 'Contenu valide de test pour la section avec plus de vingt caractères indispensables.',
        sources: [{ title: 'Source officielle', url: 'https://www.service-public.fr' }],
      }),
      model: 'nvidia/nemotron-3.5-lightning:free',
      degraded: false,
      cached: false,
      provider: 'openrouter',
    });

    const full = await generateCountryFullGuide('PT', { force: true });

    expect(full.country_code).toBe('PT');
    expect(Object.keys(full.results).length).toBe(6);
    expect(full.successCount).toBe(6);
    expect(full.degradedCount).toBe(0);
  });

  it('TEST-CG-PRACTICAL-07: route GET /api/ai/country-guide/[code] valide les entrées', async () => {
    const { GET } = await import('../../src/app/api/ai/country-guide/[code]/route');
    const invalidRes = await GET({} as any, { params: Promise.resolve({ code: 'X' }) });
    expect(invalidRes.status).toBe(400);

    const validRes = await GET({} as any, { params: Promise.resolve({ code: 'PT' }) });
    expect(validRes.status).toBe(200);
    const body = await validRes.json();
    expect(body.country_code).toBe('PT');
  });
});
