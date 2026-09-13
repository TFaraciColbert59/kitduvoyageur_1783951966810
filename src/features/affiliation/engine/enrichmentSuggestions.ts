/**
 * Suggestions de réservation LLM (`trips.metadata.enrichment_suggestions`) —
 * lecture défensive + résolution vers les liens actifs du voyage.
 *
 * Règle dure : aucune rangée morte. Une suggestion dont la catégorie n'a aucun
 * lien actif correspondant (ou dont la destination ne correspond à aucun
 * candidat, via le résolveur des liens d'étape) est OMISE entièrement.
 */
import type { AffiliateCategory, AffiliateLink } from '../types/affiliate.types';
import {
  resolveAffiliateIntent,
  type StepBookingResolutionContext,
} from './stepBookingLink';

export interface EnrichmentSuggestion {
  category: AffiliateCategory;
  label: string;
  searchTerms: string;
}

export interface ResolvedEnrichmentSuggestion extends EnrichmentSuggestion {
  slug: string;
  partnerName: string | null;
}

const SUGGESTION_CATEGORIES: readonly AffiliateCategory[] = [
  'flight',
  'hotel',
  'activity',
  'insurance',
  'esim',
];

/** Borne miroir de `MAX_ENRICHMENT_SUGGESTIONS` (12) — jamais plus de rangées. */
const MAX_SUGGESTIONS = 12;

function isSuggestionCategory(value: unknown): value is AffiliateCategory {
  return typeof value === 'string' && SUGGESTION_CATEGORIES.includes(value as AffiliateCategory);
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > max) return null;
  return trimmed;
}

/**
 * Lit `metadata.enrichment_suggestions` (écrit par le service d'enrichissement)
 * sans jamais lever : toute entrée malformée est ignorée, le lot est borné à 12.
 */
export function parseEnrichmentSuggestions(metadata: unknown): EnrichmentSuggestion[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  const raw = (metadata as Record<string, unknown>).enrichment_suggestions;
  if (!Array.isArray(raw)) return [];

  const out: EnrichmentSuggestion[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const category = row.category;
    const label = cleanText(row.label, 200);
    const searchTerms = cleanText(row.searchTerms, 120);
    if (!isSuggestionCategory(category) || label === null || searchTerms === null) continue;
    out.push({ category, label, searchTerms });
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

/**
 * Résout chaque suggestion vers le lien actif correspondant (même résolveur
 * destination-avant-catégorie que les étapes). Aucun lien → suggestion omise.
 */
export function resolveEnrichmentSuggestions(
  suggestions: readonly EnrichmentSuggestion[],
  candidates: readonly AffiliateLink[],
  context: StepBookingResolutionContext
): ResolvedEnrichmentSuggestion[] {
  const out: ResolvedEnrichmentSuggestion[] = [];
  for (const suggestion of suggestions) {
    const resolved = resolveAffiliateIntent(suggestion, candidates, context);
    if (resolved) out.push(resolved);
  }
  return out;
}
