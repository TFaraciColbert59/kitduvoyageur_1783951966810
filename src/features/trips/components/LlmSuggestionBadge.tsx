import { cn } from '@/lib/utils';

export interface LlmSuggestionBadgeProps {
  className?: string;
}

/**
 * Badge discret de provenance « Suggestion IA » — une seule pastille par rangée
 * écrite par le job d'enrichissement (étapes, moments, POI, kit). Vocabulaire
 * existant `glass-pill`, aucune nouvelle couleur.
 */
export function LlmSuggestionBadge({ className }: LlmSuggestionBadgeProps) {
  return (
    <span
      data-llm-badge=""
      className={cn(
        'glass-pill shrink-0 !px-1.5 !py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]',
        className
      )}
    >
      Suggestion IA
    </span>
  );
}

export default LlmSuggestionBadge;
