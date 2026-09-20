import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';

export interface LlmSuggestionBadgeProps {
  className?: string;
}

/**
 * Badge discret de provenance « Suggestion IA » — une seule pastille par rangée
 * écrite par le job d'enrichissement (étapes, moments, POI, kit). Contrat
 * `Badge` canonique, aucune nouvelle couleur.
 */
export function LlmSuggestionBadge({ className }: LlmSuggestionBadgeProps) {
  return (
    <span data-llm-badge="" className={cn('inline-flex shrink-0', className)}>
      <Badge tone="stone" className="uppercase tracking-[0.08em]">
        Suggestion IA
      </Badge>
    </span>
  );
}

export default LlmSuggestionBadge;
