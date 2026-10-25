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
        single: vi.fn().mockImplementation(() =>
          Promise.resolve({
            data: {
              id: 'test-block-uuid',
              ...lastUpsertPayload,
            },
            error: null,
          })
        ),
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
    limit: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'kit-uuid-1',
          slug: 'kit-minimaliste',
          nom: 'Kit Minimaliste Weekend',
          prix_cents: 71700,
          poids_total_g: 3500,
          activite: 'Randonnée',
          saison: 'Été',
          kit_items: [{ nom: 'Tente MSR', essentiel: true }],
        },
      ],
      error: null,
    }),
  });

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'ai_jobs') {
        return { insert: insertMock, update: updateMock };
      }
      if (table === 'country_content_blocks') {
        return {
          select: selectMock,
          upsert: upsertMock,
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'block-123', reviewed_at: '2026-09-04T12:00:00Z', needs_human_review: false },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'kits') {
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
  CONTENT_BLOCK_TYPES,
  BLOCK_TIERS,
  BLOCK_FRESHNESS_DAYS,
  FAQItemSchema,
  ItineraireItemSchema,
  KitRecommendationItemSchema,
} from '../../src/lib/ai/country-content/contentBlocksTypes';
import {
  buildContentPrompt,
  parseContentBlockResponse,
  generateContentBlock,
} from '../../src/lib/ai/country-content/generateContentBlock';
import {
  generateSafetyCriticalBlock,
  reviewContentBlock,
} from '../../src/lib/ai/country-content/generateSafetyCriticalBlock';
import { generateCountryKitRecommendation } from '../../src/lib/ai/country-content/recommendCountryKits';

describe('src/lib/ai/country-content — Système Multi-Tiers Pages Pays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TEST-BLOCKS-01: Les 13 types de blocs, tiers et durées de fraîcheur sont exactement conformes à la spécification', () => {
    expect(CONTENT_BLOCK_TYPES.length).toBe(13);

    // Tier 1 — Safety-Critical
    expect(BLOCK_TIERS.formalites).toBe(1);
    expect(BLOCK_TIERS.securite_alertes).toBe(1);
    expect(BLOCK_FRESHNESS_DAYS.securite_alertes).toBe(7); // Cron 7 jours
    expect(BLOCK_FRESHNESS_DAYS.formalites).toBe(30);

    // Tier 2 — Factuel utile
    expect(BLOCK_TIERS.transport).toBe(2);
    expect(BLOCK_TIERS.budget).toBe(2);
    expect(BLOCK_TIERS.sante).toBe(2);
    expect(BLOCK_TIERS.etiquette).toBe(2);
    expect(BLOCK_FRESHNESS_DAYS.transport).toBe(90);

    // Tier 3 — Éditorial & Inspirationnel
    expect(BLOCK_TIERS.vue_ensemble).toBe(3);
    expect(BLOCK_TIERS.meilleure_periode_activite).toBe(3);
    expect(BLOCK_TIERS.itineraires_suggeres).toBe(3);
    expect(BLOCK_TIERS.spots_incontournables).toBe(3);
    expect(BLOCK_TIERS.niveau_difficulte).toBe(3);
    expect(BLOCK_TIERS.faq).toBe(3);

    // Tier 4 — Recommandations Kits
    expect(BLOCK_TIERS.recommandations_kit).toBe(4);
    expect(BLOCK_FRESHNESS_DAYS.recommandations_kit).toBe(30);
  });

  it('TEST-BLOCKS-02: Les schémas Zod valident les structures de données complexes', () => {
    const validFaq = { question: 'Peut-on bivouaquer librement ?', reponse: 'Le bivouac est réglementé dans les parcs nationaux.' };
    expect(FAQItemSchema.safeParse(validFaq).success).toBe(true);

    const validItineraire = {
      nom: 'Rota Vicentina',
      duree_jours: 4,
      denivele_positif_m: 850,
      difficulte: 'Modéré',
      description: 'Superbe randonnée côtière le long des falaises de l Alentejo et de l Algarve.',
      etapes: ['Porto Covo à Vila Nova de Milfontes', 'Vila Nova à Almograve'],
    };
    expect(ItineraireItemSchema.safeParse(validItineraire).success).toBe(true);

    const validKit = {
      kit_id: 'kit-uuid-1',
      kit_slug: 'kit-minimaliste',
      kit_nom: 'Kit Minimaliste Weekend',
      prix_eur: 717,
      poids_g: 3500,
      argumentaire: 'Parfait pour les sentiers côtiers portugais avec portage ultra-léger.',
      equipements_clefs: ['Tente MSR', 'Duvet Spark'],
    };
    expect(KitRecommendationItemSchema.safeParse(validKit).success).toBe(true);
  });

  it('TEST-BLOCKS-03: parseContentBlockResponse parse le JSON valide et extrait sources et markdown', () => {
    const jsonStr = JSON.stringify({
      content_md: 'Le réseau ferroviaire portugais (CP) dessert efficacement les principales lignes côtières.',
      content_json: null,
      sources: [{ title: 'Comboios de Portugal', url: 'https://www.cp.pt' }],
    });

    const parsed = parseContentBlockResponse(jsonStr, 'transport');
    expect(parsed).not.toBeNull();
    expect(parsed?.content_md).toContain('réseau ferroviaire');
    expect(parsed?.sources.length).toBe(1);
    expect(parsed?.sources[0].title).toBe('Comboios de Portugal');
    expect(parsed?.sources[0].url).toBe('https://www.cp.pt');
  });

  it('TEST-BLOCKS-04: Tier 1 génère avec needs_human_review = true et reviewed_at = null', async () => {
    askAIMock.mockResolvedValueOnce({
      text: JSON.stringify({
        content_md: 'Pour les ressortissants de l UE, une carte nationale d identité ou un passeport en cours de validité est requis.',
        content_json: null,
        sources: [{ title: 'France Diplomatie', url: 'https://www.diplomatie.gouv.fr' }],
      }),
      model: 'nvidia/nemotron-3.5-lightning:free',
      degraded: false,
      cached: false,
      provider: 'openrouter',
    });

    const result = await generateSafetyCriticalBlock('PT', 'formalites', { force: true });

    expect(result.country_code).toBe('PT');
    expect(result.tier).toBe(1);
    expect(result.needs_human_review).toBe(true);
    expect(result.reviewed_at).toBeNull();
    expect(askAIMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 'fast',
        plugins: expect.arrayContaining([{ id: 'web', max_results: 5 }]),
      })
    );
  });

  it('TEST-BLOCKS-05: reviewContentBlock débloque un bloc en posant reviewed_at et reviewed_by', async () => {
    const res = await reviewContentBlock('block-123', 'admin-marie');
    expect(res.success).toBe(true);
    expect(res.block?.reviewed_at).toBeDefined();
    expect(res.block?.needs_human_review).toBe(false);
  });

  it('TEST-BLOCKS-06: Tier 4 n autorise JAMAIS de kits hallucinés absents du catalogue réel', async () => {
    // L'IA tente de recommander un kit fictif inventé
    askAIMock.mockResolvedValueOnce({
      text: JSON.stringify({
        content_md: 'Équipement recommandé pour les montagnes et vallées.',
        content_json: [
          {
            kit_id: 'fake-id',
            kit_slug: 'kit-fictif-invente',
            kit_nom: 'Kit Fictif Halluciné',
            prix_eur: 299,
            poids_g: 2000,
            argumentaire: 'Kit fictif qui n existe pas dans notre catalogue.',
            equipements_clefs: ['Faux réchaud'],
          },
        ],
      }),
      model: 'nvidia/nemotron-3.5-lightning:free',
      degraded: false,
      cached: false,
      provider: 'openrouter',
    });

    const result = await generateCountryKitRecommendation('PT', { force: true });

    expect(result.tier).toBe(4);
    // Le filtre de validation a rejeté le faux kit et pris le kit réel du catalogue
    const kits = result.content_json as any[];
    expect(kits.length).toBeGreaterThan(0);
    expect(kits[0].kit_slug).toBe('kit-minimaliste');
    expect(kits[0].kit_nom).toBe('Kit Minimaliste Weekend');
  });
});
