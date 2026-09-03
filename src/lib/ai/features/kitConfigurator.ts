import { z } from 'zod';
import type { RealShopProduct, KitAnalysis } from '../configuratorCore';

/**
 * Feature « kit-configurator » — rapport de kit connecté (Chantier B).
 * tier heavy, SANS cache (kit = personnel), quota serré : rare par nature.
 * Le moteur déterministe (configuratorCore.analyzeKit) décide ce qui manque ;
 * l'IA explique et propose des alternatives RÉELLES issues du catalogue —
 * elle ne fabrique rien (règle "never fabricate", validée par Zod + sanitize).
 */

export const KIT_CONFIGURATOR_SPEC = {
  tier: 'heavy' as const,
  maxReasoningBudget: 4000,
  cacheTtlSeconds: 0, // kit = personnel : pas de cache
  maxPerUserPerDay: 10,
};

// ── Validation du body de la route (Zod, jamais de confiance en l'input) ────
export const kitSessionParamsSchema = z.object({
  destination: z.string().min(1).max(200),
  country: z.string().min(1).max(100),
  startDate: z.string().max(40),
  endDate: z.string().max(40),
  season: z.string().min(1).max(60),
  activity: z.string().min(1).max(100),
  level: z.string().min(1).max(60),
  maxWeightG: z.number().int().min(0).max(100_000),
  budgetEur: z.number().min(0).max(100_000),
  bodyWeightKg: z.number().min(0).max(300).optional(),
  climate: z.string().max(200).optional(),
});

export const kitReportBodySchema = z.object({
  sessionParams: kitSessionParamsSchema,
  selectedItems: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        brand: z.string(),
        slug: z.string(),
        category: z.string(),
        weight_g: z.number(),
        price_eur: z.number(),
        description: z.string(),
        image: z.string(),
        image_alt: z.string(),
      })
    )
    .min(1)
    .max(100),
});

// ── Schéma de SORTIE IA (shape exacte attendue par la route) ────────────────
const alternativeRefSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  brand: z.string(),
  price_eur: z.number(),
  reason: z.string().min(1),
});

export const kitAIOutputSchema = z.object({
  justifications: z.record(z.string(), z.string()).default({}),
  alternatives: z
    .record(z.string(), z.object({ eco: alternativeRefSchema.optional(), premium: alternativeRefSchema.optional() }).default({}))
    .default({}),
  consumables: z
    .array(
      z.object({
        name: z.string().min(1),
        category: z.string(),
        reason: z.string(),
        estimated_price_eur: z.number(),
      })
    )
    .default([]),
  bring_yourself: z
    .array(z.object({ item: z.string().min(1), guide: z.string(), affiliate_hint: z.string() }))
    .default([]),
  carbon_kg_estimate: z.number().nullable().default(null),
  destination_context: z.object({
    weather_summary: z.string(),
    security_level: z.string(),
    security_notes: z.string(),
    country_page_code: z.string(),
  }),
});

export type KitAIOutput = z.output<typeof kitAIOutputSchema>;
export type KitSessionParams = z.output<typeof kitSessionParamsSchema>;

// ── Prompt : injecte l'analyse déterministe + catalogue réel ────────────────
export function buildKitPrompt(params: {
  sessionParams: KitSessionParams;
  selectedItems: { id: string; name: string; brand: string; category: string; weight_g: number; price_eur: number }[];
  sourceable: RealShopProduct[];
  analysis: KitAnalysis;
}): { system: string; prompt: string } {
  const { sessionParams: s, selectedItems, sourceable, analysis } = params;

  const system =
    'Tu es un expert équipement outdoor. Tu génères des rapports de kit personnalisés en JSON strict.\n' +
    "Les manques et alertes ont DÉJÀ été calculés par un moteur déterministe : tu n'inventes RIEN.\n" +
    "Tu EXPLIQUES et proposes des alternatives UNIQUEMENT parmi les produits du catalogue fourni.\n" +
    'Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans commentaires.';

  const prompt = `Génère un rapport de kit pour ce voyage :
- Destination : ${s.destination} (${s.country})
- Dates : ${s.startDate} → ${s.endDate}
- Saison : ${s.season}
- Activité : ${s.activity}
- Niveau : ${s.level}
- Budget max : ${s.budgetEur}€
- Poids max : ${(s.maxWeightG / 1000).toFixed(1)}kg
${s.bodyWeightKg ? `- Poids corporel : ${s.bodyWeightKg}kg` : ''}
${s.climate ? `- Climat : ${s.climate}` : ''}

ANALYSE DÉTERMINISTE (fait par le code — source de vérité, ne pas réinventer) :
${JSON.stringify(
  {
    manques_detectes: analysis.missingItems.map((m) => ({ id: m.id, name: m.name, essentiality: m.essentiality, reason: m.reason })),
    alertes_inadequation: analysis.inadequateAlerts,
    poids_total_kg: analysis.totalWeightKg,
    score_preparation: analysis.preparationScore,
  },
  null,
  2
)}

Articles sélectionnés :
${JSON.stringify(selectedItems, null, 2)}

Catalogue disponible (sourceable) — TOUTE alternative DOIT référencer le "id" EXACT d'un de ces produits ; il est INTERDIT de fabriquer ou inventer un produit :
${JSON.stringify(
  sourceable.slice(0, 30).map((p) => ({ id: p.id, name: p.name, brand: p.brand, category: p.category, weight_g: p.weightGrams, price_eur: p.priceEur })),
  null,
  2
)}

Retourne ce JSON exact :
{
  "justifications": { "<item_id>": "phrase de justification IA pour ce voyage précis (1-2 phrases)" },
  "alternatives": {
    "<item_id>": {
      "eco": { "id": "<id_catalogue>", "name": "...", "brand": "...", "price_eur": 0, "reason": "..." },
      "premium": { "id": "<id_catalogue>", "name": "...", "brand": "...", "price_eur": 0, "reason": "..." }
    }
  },
  "consumables": [
    { "name": "...", "category": "...", "reason": "...", "estimated_price_eur": 0 }
  ],
  "bring_yourself": [
    { "item": "...", "guide": "...", "affiliate_hint": "..." }
  ],
  "carbon_kg_estimate": 0,
  "destination_context": {
    "weather_summary": "...",
    "security_level": "faible|modéré|élevé",
    "security_notes": "...",
    "country_page_code": "${s.country.toLowerCase().replace(/\s+/g, '-')}"
  }
}`;

  return { system, prompt };
}

// ── Sanitize : "never fabricate" appliqué à la sortie IA ────────────────────
function matchCatalogProduct(ref: { id?: string; name: string; brand: string }, catalog: RealShopProduct[]): RealShopProduct | null {
  const norm = (v: string) => v.trim().toLowerCase();
  if (ref.id) {
    const byId = catalog.find((p) => p.id === ref.id);
    if (byId) return byId;
  }
  return (
    catalog.find((p) => norm(p.name) === norm(ref.name) && norm(p.brand) === norm(ref.brand)) ?? null
  );
}

export function sanitizeAIKitOutput(
  parsed: KitAIOutput,
  catalog: RealShopProduct[]
): { data: KitAIOutput; fabricatedDropped: number } {
  let fabricatedDropped = 0;

  const alternatives: KitAIOutput['alternatives'] = {};
  for (const [itemId, slots] of Object.entries(parsed.alternatives ?? {})) {
    const cleanSlots: { eco?: { id: string; name: string; brand: string; price_eur: number; reason: string }; premium?: { id: string; name: string; brand: string; price_eur: number; reason: string } } = {};

    for (const slot of ['eco', 'premium'] as const) {
      const ref = slots?.[slot];
      if (!ref) continue;
      const real = matchCatalogProduct(ref, catalog);
      if (real) {
        cleanSlots[slot] = { id: real.id, name: real.name, brand: real.brand, price_eur: real.priceEur, reason: ref.reason };
      } else {
        fabricatedDropped += 1;
      }
    }

    if (cleanSlots.eco || cleanSlots.premium) {
      alternatives[itemId] = cleanSlots;
    }
  }

  return { data: { ...parsed, alternatives }, fabricatedDropped };
}

// ── Fallback déterministe : listes du moteur, sans narrative IA ─────────────
export function buildDeterministicFallback(
  sessionParams: KitSessionParams,
  analysis: KitAnalysis
): KitAIOutput {
  return {
    justifications: {},
    alternatives: {},
    consumables: [],
    bring_yourself: [
      { item: 'Chaussures de randonnée', guide: 'Choisir selon le terrain et la durée', affiliate_hint: '' },
      { item: 'Vêtements techniques', guide: 'Adapter aux conditions climatiques', affiliate_hint: '' },
    ],
    carbon_kg_estimate: null,
    destination_context: {
      weather_summary:
        analysis.missingItems.length > 0
          ? `Conditions à prévoir pour ${sessionParams.destination} en ${sessionParams.season}`
          : `Équipement complet pour ${sessionParams.destination} en ${sessionParams.season}`,
      security_level: 'modéré',
      security_notes: 'Consultez la fiche pays pour les informations de sécurité actualisées.',
      country_page_code: sessionParams.country.toLowerCase().replace(/\s+/g, '-'),
    },
  };
}

export async function fallbackResponse(): Promise<{ text: string; model: string; degraded: boolean; cached: boolean; provider: string }> {
  return {
    text: "Rapport de kit généré sans les justifications détaillées de l'assistant IA " +
      '(service momentanément indisponible). Les listes d\'équipement, manques et ' +
      'alertes restent fiables : elles proviennent du moteur déterministe.',
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
