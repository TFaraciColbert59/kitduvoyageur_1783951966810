import { z } from 'zod';

export const CONTENT_BLOCK_TYPES = [
  // Tier 1 — Safety-Critical
  'formalites',
  'securite_alertes',
  // Tier 2 — Factuel utile
  'transport',
  'budget',
  'sante',
  'etiquette',
  // Tier 3 — Éditorial & Inspirationnel
  'vue_ensemble',
  'meilleure_periode_activite',
  'itineraires_suggeres',
  'spots_incontournables',
  'niveau_difficulte',
  'faq',
  // Tier 4 — Matériel & Kits
  'recommandations_kit',
] as const;

export type ContentBlockType = (typeof CONTENT_BLOCK_TYPES)[number];
export type ContentTier = 1 | 2 | 3 | 4;

export const BLOCK_TIERS: Record<ContentBlockType, ContentTier> = {
  formalites: 1,
  securite_alertes: 1,
  transport: 2,
  budget: 2,
  sante: 2,
  etiquette: 2,
  vue_ensemble: 3,
  meilleure_periode_activite: 3,
  itineraires_suggeres: 3,
  spots_incontournables: 3,
  niveau_difficulte: 3,
  faq: 3,
  recommandations_kit: 4,
};

export const BLOCK_FRESHNESS_DAYS: Record<ContentBlockType, number> = {
  formalites: 30,
  securite_alertes: 7, // Cron dédié 7 jours
  transport: 90,
  budget: 90,
  sante: 90,
  etiquette: 90,
  vue_ensemble: 365,
  meilleure_periode_activite: 365,
  itineraires_suggeres: 180,
  spots_incontournables: 180,
  niveau_difficulte: 365,
  faq: 180,
  recommandations_kit: 30,
};

export interface ContentSource {
  title: string;
  url: string;
}

export interface ContentBlockRecord {
  id?: string;
  country_code: string;
  block_type: ContentBlockType;
  tier: ContentTier;
  content_md: string;
  content_json: Record<string, unknown> | Array<unknown> | null;
  sources: ContentSource[];
  model_used: string;
  generated_at: string;
  stale_after: string;
  degraded: boolean;
  needs_human_review: boolean;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

// ── Schémas Zod pour blocs structurés ────────────────────────────────────────

export const FAQItemSchema = z.object({
  question: z.string().min(3),
  reponse: z.string().min(5),
});
export type FAQItem = z.infer<typeof FAQItemSchema>;

export const ItineraireItemSchema = z.object({
  nom: z.string().min(2),
  duree_jours: z.coerce.number().min(1),
  denivele_positif_m: z.coerce.number().optional(),
  difficulte: z.string().default('Modéré'),
  description: z.string().min(10),
  etapes: z.union([z.array(z.string()), z.string().transform((s) => [s])]).optional().default([]),
});
export type ItineraireItem = z.infer<typeof ItineraireItemSchema>;

export const PeriodeActiviteItemSchema = z.object({
  activite: z.string().min(2),
  mois_favorables: z.string().min(2),
  conditions: z.string().min(3),
  points_vigilance: z.string().optional().default(''),
});
export type PeriodeActiviteItem = z.infer<typeof PeriodeActiviteItemSchema>;

export const SpotItemSchema = z.object({
  nom: z.string().min(2),
  localisation: z.string().min(2),
  type_outdoor: z.string().optional().default('Spot sauvage'),
  description: z.string().min(5),
});
export type SpotItem = z.infer<typeof SpotItemSchema>;

export const DifficulteItemSchema = z.object({
  activite: z.string().min(2),
  niveau: z.string().default('Modéré'),
  facteurs: z.string().min(3),
  conseils: z.string().min(3),
});
export type DifficulteItem = z.infer<typeof DifficulteItemSchema>;

export const KitRecommendationItemSchema = z.object({
  kit_id: z.string().min(1),
  kit_slug: z.string().min(1),
  kit_nom: z.string().min(1),
  prix_eur: z.number().min(0),
  poids_g: z.number().min(0),
  argumentaire: z.string().min(15),
  equipements_clefs: z.array(z.string()).min(1),
});
export type KitRecommendationItem = z.infer<typeof KitRecommendationItemSchema>;
