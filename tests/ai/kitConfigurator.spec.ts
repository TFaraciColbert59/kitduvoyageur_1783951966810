import { describe, it, expect } from 'vitest';

import {
  kitReportBodySchema,
  kitAIOutputSchema,
  sanitizeAIKitOutput,
  buildKitPrompt,
  buildDeterministicFallback,
} from '../../src/lib/ai/features/kitConfigurator';
import type { RealShopProduct, KitAnalysis } from '../../src/lib/ai/configuratorCore';

const CATALOG: RealShopProduct[] = [
  { id: 'p1', slug: 'p1', name: 'Sac à dos Trek 60L', brand: 'LKDV', category: 'Sacs à dos', priceEur: 180, weightGrams: 1500, image: '', stock: 5 },
  { id: 'p2', slug: 'p2', name: 'Duvet Mountain 800', brand: 'LKDV', category: 'Couchage', priceEur: 250, weightGrams: 1200, image: '', stock: 3 },
];

const SESSION = {
  destination: 'Chamonix',
  country: 'France',
  startDate: '2026-09-10',
  endDate: '2026-09-15',
  season: 'automne',
  activity: 'randonnée',
  level: 'intermédiaire',
  maxWeightG: 12000,
  budgetEur: 900,
};

const ANALYSIS: KitAnalysis = {
  missingItems: [
    { id: 'p1', slug: 'p1', name: 'Sac à dos Trek 60L', brand: 'LKDV', category: 'Sacs à dos', priceEur: 180, weightGrams: 1500, image: '', essentiality: 'indispensable', reason: 'Portage' },
  ],
  inadequateAlerts: [
    { item: 'Système de couchage', issue: 'Froid', recommendation: 'Duvet 800 Cuin', severity: 'danger' },
  ],
  totalOwnedWeightKg: 4.2,
  totalWeightKg: 5.7,
  totalMissingPriceEur: 180,
  preparationScore: 60,
};

const VALID_AI_OUTPUT = {
  justifications: { p1: 'Parfait pour 5 jours en autonomie.' },
  alternatives: {
    p1: {
      eco: { id: 'p2', name: 'Duvet Mountain 800', brand: 'LKDV', price_eur: 250, reason: 'Alternative warm' },
      premium: { id: 'p1', name: 'Sac à dos Trek 60L', brand: 'LKDV', price_eur: 180, reason: 'Meilleur report de charge' },
    },
  },
  consumables: [{ name: 'Barres énergétiques', category: 'Alimentation', reason: 'Effort', estimated_price_eur: 15 }],
  bring_yourself: [{ item: 'Lunettes de soleil', guide: 'Catégorie 4', affiliate_hint: '' }],
  carbon_kg_estimate: 1.8,
  destination_context: {
    weather_summary: 'Frais en altitude',
    security_level: 'faible',
    security_notes: 'RAS',
    country_page_code: 'france',
  },
};

describe('src/lib/ai/features/kitConfigurator — enrichissement IA du kit', () => {
  it('TEST-KCF-01: schema Zod du body → accepte un body valide, rejette un body invalide', () => {
    const body = {
      sessionParams: SESSION,
      selectedItems: [{ id: 'p1', name: 'Sac', brand: 'LKDV', slug: 'p1', category: 'Sacs à dos', weight_g: 1500, price_eur: 180, description: '', image: '', image_alt: '' }],
    };
    expect(kitReportBodySchema.safeParse(body).success).toBe(true);

    const bad = { sessionParams: { ...SESSION, budgetEur: 'beaucoup' }, selectedItems: body.selectedItems };
    expect(kitReportBodySchema.safeParse(bad).success).toBe(false);

    expect(kitReportBodySchema.safeParse({ sessionParams: SESSION }).success).toBe(false);
  });

  it('TEST-KCF-02: kitAIOutputSchema valide la shape attendue, rejette le bruit', () => {
    expect(kitAIOutputSchema.safeParse(VALID_AI_OUTPUT).success).toBe(true);
    expect(kitAIOutputSchema.safeParse({ justifications: 'pas un objet' }).success).toBe(false);
    expect(kitAIOutputSchema.safeParse({ ...VALID_AI_OUTPUT, carbon_kg_estimate: 'beaucoup' }).success).toBe(false);
  });

  it('TEST-KCF-03: sanitize — alternative avec ID RÉEL conservée, ID fabriqué SUPPRIMÉ', () => {
    const fabricated = {
      ...VALID_AI_OUTPUT,
      alternatives: {
        p1: {
          eco: { id: 'produit-invente', name: 'Sac Dream 3000', brand: 'Ghost', price_eur: 1, reason: 'fabrication IA' },
          premium: { id: 'p2', name: 'Duvet Mountain 800', brand: 'LKDV', price_eur: 250, reason: 'réel' },
        },
      },
    };
    const parsed = kitAIOutputSchema.parse(fabricated);
    const result = sanitizeAIKitOutput(parsed, CATALOG);

    expect(result.data.alternatives?.p1?.eco).toBeUndefined();
    expect(result.data.alternatives?.p1?.premium?.id).toBe('p2');
    expect(result.fabricatedDropped).toBe(1);
  });

  it('TEST-KCF-04: sanitize — match par name+brand exact quand l\'ID manque, sinon drop', () => {
    const noId = {
      ...VALID_AI_OUTPUT,
      alternatives: {
        p1: {
          eco: { name: 'Sac à dos Trek 60L', brand: 'LKDV', price_eur: 180, reason: 'réel sans id' },
          premium: { name: 'Jamais vu ce produit', brand: 'Nulle part', price_eur: 5, reason: 'fantôme' },
        },
      },
    };
    const parsed = kitAIOutputSchema.parse(noId);
    const result = sanitizeAIKitOutput(parsed, CATALOG);

    expect(result.data.alternatives?.p1?.eco?.id).toBe('p1');
    expect(result.data.alternatives?.p1?.premium).toBeUndefined();
    expect(result.fabricatedDropped).toBe(1);
  });

  it('TEST-KCF-05: buildKitPrompt — injecte analyse déterministe + catalogue + consigne anti-fabrication', () => {
    const { system, prompt } = buildKitPrompt({
      sessionParams: SESSION,
      selectedItems: [{ id: 'p1', name: 'Sac à dos Trek 60L', brand: 'LKDV', category: 'Sacs à dos', weight_g: 1500, price_eur: 180 }],
      sourceable: CATALOG,
      analysis: ANALYSIS,
    });

    expect(system).toMatch(/JSON strict/);
    expect(prompt).toContain('Chamonix');
    expect(prompt).toContain('ANALYSE DÉTERMINISTE');
    expect(prompt).toContain('Sac à dos Trek 60L');
    expect(prompt).toContain('"id"');
    expect(prompt).toMatch(/ne (dois|doit) (pas )?(jamais )?fabriqu|inventer/i);
  });

  it('TEST-KCF-06: buildDeterministicFallback — shape valide, listes déterministes, jamais vide', () => {
    const fallback = buildDeterministicFallback(SESSION, ANALYSIS);
    const parsed = kitAIOutputSchema.safeParse(fallback);

    expect(parsed.success).toBe(true);
    expect(fallback.alternatives).toEqual({});
    expect(fallback.justifications).toEqual({});
    expect(fallback.bring_yourself.length).toBeGreaterThan(0);
    expect(fallback.destination_context.country_page_code).toBe('france');
    expect(fallback.carbon_kg_estimate).toBeNull();
  });
});
