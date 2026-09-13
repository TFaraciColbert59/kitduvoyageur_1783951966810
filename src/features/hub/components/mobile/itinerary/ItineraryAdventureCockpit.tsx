'use client';

/**
 * Task 7 — Cockpit aventure discret en tête de la section Itinéraire.
 *
 * Réutilise le montage A10 (`AdventureIntelligenceHub`) alimenté par les mêmes
 * données réelles `getAdventureIntelligence` : statut, ≤3 indicateurs,
 * décisions, liens rapides (l'itinéraire courant est retiré) et état offline.
 * Mode compact — les conditions terrain restent au montage plein de la racine.
 */
import AdventureIntelligenceHub, {
  type AdventureIntelligenceHubProps,
} from '@/features/adventure-intelligence/ui/AdventureIntelligenceHub';

export interface ItineraryAdventureCockpitProps {
  /** Entrée cockpit réelle (sans `offline` : résolu côté client). */
  cockpit: AdventureIntelligenceHubProps['cockpit'];
  /** Liens rapides réels du registre hub — section courante exclue. */
  sections?: AdventureIntelligenceHubProps['sections'];
  sectionHrefs?: AdventureIntelligenceHubProps['sectionHrefs'];
  className?: string;
}

export function ItineraryAdventureCockpit({
  cockpit,
  sections = [],
  sectionHrefs = {},
  className = '',
}: ItineraryAdventureCockpitProps) {
  const quickLinks = sections.filter((section) => section.id !== 'itinerary');

  return (
    <section
      data-testid="itinerary-adventure-cockpit"
      aria-label="Cockpit aventure"
      className={`min-w-0 ${className}`}
    >
      <AdventureIntelligenceHub
        compact
        cockpit={cockpit}
        sections={quickLinks}
        sectionHrefs={sectionHrefs}
      />
    </section>
  );
}

export default ItineraryAdventureCockpit;
