import { describe, it, expect } from 'vitest';
import type { BlockGuideData } from '@/hooks/useCountryPracticalGuide';
import {
  buildSectionContent,
  toSectionBlock,
} from '@/features/pays/mappers/contentBlockToSection';

function makeBlock(overrides: Partial<BlockGuideData> = {}): BlockGuideData {
  return {
    block_type: 'vue_ensemble',
    tier: 3,
    content_md: 'Un pays **riche**.\n\nDeuxième paragraphe.',
    content_json: null,
    sources: [{ title: 'Source officielle', url: 'https://example.com/source' }],
    model_used: 'test-model',
    generated_at: '2026-03-01T00:00:00.000Z',
    stale_after: '2027-03-01T00:00:00.000Z',
    reviewed_at: null,
    ...overrides,
  } as BlockGuideData;
}

describe('Mapper blocs IA → sections', () => {
  it('normalise un bloc et écarte les sources sans URL', () => {
    const block = toSectionBlock(
      'vue_ensemble',
      makeBlock({
        sources: [
          { title: 'Bon', url: 'https://example.com' },
          { title: 'Cassé', url: '' },
        ],
      })
    );
    expect(block.type).toBe('vue_ensemble');
    expect(block.contentMd).toContain('riche');
    expect(block.sources).toHaveLength(1);
    expect(block.sources[0].url).toBe('https://example.com');
    expect(block.generatedAt).toBe('2026-03-01T00:00:00.000Z');
  });

  it('ne conserve que les blocs déclarés par le registre (ordre du registre)', () => {
    const content = buildSectionContent('activites', {
      vue_ensemble: makeBlock({ block_type: 'vue_ensemble' }),
      itineraires_suggeres: makeBlock({ block_type: 'itineraires_suggeres', content_md: 'Itinéraires.' }),
      niveau_difficulte: makeBlock({ block_type: 'niveau_difficulte', content_md: 'Niveau.' }),
    });
    expect(content.blocks.map((block) => block.type)).toEqual([
      'itineraires_suggeres',
      'niveau_difficulte',
    ]);
    expect(content.hasContent).toBe(true);
  });

  it('hasContent=false sans bloc disponible (jamais de contenu inventé)', () => {
    expect(buildSectionContent('culture', null).hasContent).toBe(false);
    expect(buildSectionContent('culture', {}).blocks).toHaveLength(0);
  });

  it('écarte les blocs vides', () => {
    const content = buildSectionContent('culture', {
      etiquette: makeBlock({ block_type: 'etiquette', content_md: '   ', content_json: null }),
    });
    expect(content.hasContent).toBe(false);
  });
});
