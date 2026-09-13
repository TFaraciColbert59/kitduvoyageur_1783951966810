'use client';

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useTripAffiliate } from './TripAffiliateProvider';
import { StepBookingLinkCta } from './StepBookingLinkCta';
import {
  resolveEnrichmentSuggestions,
  type EnrichmentSuggestion,
} from '../engine/enrichmentSuggestions';

export interface TripSuggestionSectionProps {
  /** Suggestions réelles du job d'enrichissement (`metadata.enrichment_suggestions`). */
  suggestions: readonly EnrichmentSuggestion[];
  destinationName?: string | null;
  tripId: string;
  className?: string;
}

/**
 * Bloc compact « Suggestions de réservation » — suggestions LLM rendues via la
 * machinerie T8 (catégorie → lien actif, destination-aware). Une suggestion
 * sans lien actif correspondant est OMISE : jamais de rangée morte.
 */
export function TripSuggestionSection({
  suggestions,
  destinationName = '',
  tripId,
  className = '',
}: TripSuggestionSectionProps) {
  const { links } = useTripAffiliate();
  const resolved = useMemo(
    () =>
      resolveEnrichmentSuggestions(suggestions, links, {
        destinationName: destinationName ?? '',
      }),
    [suggestions, links, destinationName]
  );

  if (resolved.length === 0) return null;

  return (
    <section
      data-testid="trip-suggestion-section"
      aria-label="Suggestions de réservation"
      className={`glass rounded-[var(--lkv-radius-lg)] border border-white/60 p-3.5 ${className}`}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
        <Sparkles size={12} aria-hidden="true" />
        Suggestions de réservation
      </p>
      <ul className="mt-2 space-y-2">
        {resolved.map((suggestion) => (
          <li key={`${suggestion.category}:${suggestion.label}`}>
            <StepBookingLinkCta
              booking={suggestion}
              slug={suggestion.slug}
              partnerName={suggestion.partnerName}
              tripId={tripId}
              subtitle={suggestion.searchTerms}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default TripSuggestionSection;
