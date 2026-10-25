'use client';

import { useCountryPracticalGuide } from '@/hooks/useCountryPracticalGuide';
import { buildSectionContent } from '../mappers/contentBlockToSection';
import type { PaysSectionId } from '../types';

/**
 * Contenu IA d'une section Pays (blocs `country_content_blocks`).
 * Réutilise le hook existant (React Query dédoublonne l'appel entre sections).
 * Aucun appel réseau supplémentaire, aucun contenu inventé.
 */
export function useSectionContent(
  countryCode: string | undefined,
  sectionId: PaysSectionId = 'presentation'
) {
  const query = useCountryPracticalGuide(countryCode);
  const content = buildSectionContent(sectionId, query.data?.blocks);
  return {
    content,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
