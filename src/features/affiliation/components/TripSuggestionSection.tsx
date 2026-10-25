'use client';

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { Card } from '@/components/ui';
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
    <Card
      as="section"
      data-testid="trip-suggestion-section"
      aria-label="Suggestions de réservation"
      className={`p-[var(--space-4)] ${className}`}
    >
      <p className="flex items-center gap-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-medium uppercase tracking-[var(--tracking-caps)] text-[color:var(--lkv-text-secondary)]">
        <Sparkles size={12} aria-hidden="true" />
        Suggestions de réservation
      </p>
      <ul className="mt-[var(--space-2)] space-y-[var(--space-2)]">
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
    </Card>
  );
}

export default TripSuggestionSection;
