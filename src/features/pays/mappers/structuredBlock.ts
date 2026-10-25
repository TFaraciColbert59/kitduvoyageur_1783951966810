// src/features/pays/mappers/structuredBlock.ts
// Parse `content_json` des blocs IA via les schémas Zod existants pour un
// rendu riche (spots, itinéraires, difficulté, périodes). Retourne `null` si
// aucune donnée structurée valide (repli markdown).
import {
  DifficulteItemSchema,
  ItineraireItemSchema,
  PeriodeActiviteItemSchema,
  SpotItemSchema,
  type DifficulteItem,
  type ItineraireItem,
  type PeriodeActiviteItem,
  type SpotItem,
} from '@/lib/ai/country-content/contentBlocksTypes';
import type { SectionBlock } from '../types';

export type StructuredBlock =
  | { kind: 'spots'; items: SpotItem[] }
  | { kind: 'itineraires'; items: ItineraireItem[] }
  | { kind: 'difficulte'; items: DifficulteItem[] }
  | { kind: 'periode'; items: PeriodeActiviteItem[] };

export function parseStructuredBlock(block: SectionBlock): StructuredBlock | null {
  const json = block.contentJson;
  if (!Array.isArray(json) || json.length === 0) return null;

  switch (block.type) {
    case 'spots_incontournables': {
      const parsed = SpotItemSchema.array().safeParse(json);
      return parsed.success && parsed.data.length > 0
        ? { kind: 'spots', items: parsed.data }
        : null;
    }
    case 'itineraires_suggeres': {
      const parsed = ItineraireItemSchema.array().safeParse(json);
      return parsed.success && parsed.data.length > 0
        ? { kind: 'itineraires', items: parsed.data }
        : null;
    }
    case 'niveau_difficulte': {
      const parsed = DifficulteItemSchema.array().safeParse(json);
      return parsed.success && parsed.data.length > 0
        ? { kind: 'difficulte', items: parsed.data }
        : null;
    }
    case 'meilleure_periode_activite': {
      const parsed = PeriodeActiviteItemSchema.array().safeParse(json);
      return parsed.success && parsed.data.length > 0
        ? { kind: 'periode', items: parsed.data }
        : null;
    }
    default:
      return null;
  }
}
