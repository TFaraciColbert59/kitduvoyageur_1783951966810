// src/features/pays/mappers/contentBlockToSection.ts
// Mappe les blocs IA pays (bruts du hook) vers le modèle normalisé des sections.
import type { BlockGuideData } from '@/hooks/useCountryPracticalGuide';
import type { ContentBlockType } from '@/lib/ai/country-content/contentBlocksTypes';
import { getPaysSection } from '../registry/paysSectionRegistry';
import type { PaysSectionId, SectionBlock, SectionContent } from '../types';

/** Normalise un bloc IA en `SectionBlock` (jamais de contenu inventé). */
export function toSectionBlock(type: ContentBlockType, block: BlockGuideData): SectionBlock {
  return {
    type,
    source: 'ai',
    contentMd: typeof block.content_md === 'string' ? block.content_md.trim() : '',
    contentJson: block.content_json ?? null,
    sources: Array.isArray(block.sources)
      ? block.sources
          .filter((source) => Boolean(source?.url))
          .map((source) => ({ title: source.title || source.url, url: source.url }))
      : [],
    generatedAt: block.generated_at ?? null,
    reviewedAt: block.reviewed_at ?? null,
    staleAfter: block.stale_after ?? null,
  };
}

/**
 * Construit le contenu d'une section à partir des blocs disponibles.
 * Ne conserve que les blocs déclarés par le registre ET réellement présents
 * avec un contenu non vide.
 */
export function buildSectionContent(
  sectionId: PaysSectionId,
  blocks?: Partial<Record<ContentBlockType, BlockGuideData>> | null
): SectionContent {
  const def = getPaysSection(sectionId);
  const available = blocks ?? {};
  const sectionBlocks = def.blockTypes
    .map((type) => (available[type] ? toSectionBlock(type, available[type]!) : null))
    .filter((block): block is SectionBlock => block !== null)
    .filter((block) => block.contentMd.length > 0 || block.contentJson !== null);

  return {
    sectionId,
    blocks: sectionBlocks,
    hasContent: sectionBlocks.length > 0,
  };
}
