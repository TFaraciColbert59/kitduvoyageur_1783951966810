/**
 * Provenance des lignes écrites par le job d'enrichissement LLM
 * (`source='llm_suggestion'` sur trip_steps/trip_pois/trip_items et dans
 * `metadata.source`). Module pur partagé par les rangées desktop/mobile.
 */
export const LLM_SUGGESTION_SOURCE = 'llm_suggestion';

export function isLlmSuggestion(source: unknown, metadata?: unknown): boolean {
  if (source === LLM_SUGGESTION_SOURCE) return true;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return (metadata as Record<string, unknown>).source === LLM_SUGGESTION_SOURCE;
  }
  return false;
}
