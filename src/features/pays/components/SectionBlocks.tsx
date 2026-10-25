'use client';

import { cn } from '@/lib/utils';
import type { CountryContent } from '@/lib/supabase/types';
import { useSectionContent } from '../hooks/useSectionContent';
import { buildEditorialSectionBlocks } from '../mappers/countryContentToSection';
import { getPaysSection } from '../registry/paysSectionRegistry';
import { EditorialBlockCard } from './EditorialBlockCard';
import { PaysSectionEmpty, PaysSectionNotice, PaysSectionSkeleton } from './PaysContentStates';
import type { PaysSectionId } from '../types';

export interface SectionBlocksProps {
  countryCode?: string;
  sectionId: PaysSectionId;
  /** Données éditoriales Supabase du pays (repli réel si pas de bloc IA). */
  countryContent?: CountryContent | null;
  className?: string;
}

/**
 * Contenu d'une section Pays. Priorité aux blocs IA par pays ; repli sur les
 * données éditoriales Supabase (`countries_content`) ; sinon état vide explicite.
 * Ne rend jamais de contenu inventé.
 */
export function SectionBlocks({ countryCode, sectionId, countryContent, className }: SectionBlocksProps) {
  const { content: aiContent, isLoading, isError } = useSectionContent(countryCode, sectionId);
  const editorialBlocks = buildEditorialSectionBlocks(sectionId, countryContent);
  const blocks = aiContent.hasContent ? aiContent.blocks : editorialBlocks;
  const def = getPaysSection(sectionId);

  if (blocks.length > 0) {
    return (
      <div className={cn('space-y-3', className)}>
        {blocks.map((block, index) => (
          <EditorialBlockCard key={`${block.type}-${index}`} block={block} />
        ))}
      </div>
    );
  }

  if (isLoading) return <PaysSectionSkeleton />;
  if (isError) return <PaysSectionNotice>Contenu momentanément indisponible.</PaysSectionNotice>;
  return <PaysSectionEmpty label={`Contenu en préparation pour « ${def.label} ».`} />;
}
