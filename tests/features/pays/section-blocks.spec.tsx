import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import type { SectionContent } from '@/features/pays/types';

vi.mock('@/features/pays/hooks/useSectionContent', () => ({ useSectionContent: vi.fn() }));
import { useSectionContent } from '@/features/pays/hooks/useSectionContent';
import { SectionBlocks } from '@/features/pays/components/SectionBlocks';

const hook = vi.mocked(useSectionContent);

const content: SectionContent = {
  sectionId: 'culture',
  blocks: [
    {
      type: 'etiquette',
      contentMd: 'On se déchausse en entrant.',
      contentJson: null,
      sources: [],
      generatedAt: null,
      reviewedAt: null,
      staleAfter: null,
    },
  ],
  hasContent: true,
};

function setState(state: { content?: SectionContent; isLoading?: boolean; isError?: boolean }) {
  hook.mockReturnValue({
    content: state.content ?? { sectionId: 'culture', blocks: [], hasContent: false },
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
  } as ReturnType<typeof useSectionContent>);
}

describe('SectionBlocks (états)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chargement → skeleton', () => {
    setState({ isLoading: true });
    expect(renderToStaticMarkup(<SectionBlocks countryCode="IS" sectionId="culture" />)).toContain(
      'animate-pulse'
    );
  });

  it('erreur → notice discrète', () => {
    setState({ isError: true });
    expect(renderToStaticMarkup(<SectionBlocks countryCode="IS" sectionId="culture" />)).toContain(
      'momentanément indisponible'
    );
  });

  it('vide → état explicite nommant la section', () => {
    setState({ content: { sectionId: 'culture', blocks: [], hasContent: false } });
    const html = renderToStaticMarkup(<SectionBlocks countryCode="IS" sectionId="culture" />);
    expect(html).toContain('Contenu en préparation');
    expect(html).toContain('Culture');
  });

  it('contenu → cartes de blocs', () => {
    setState({ content });
    const html = renderToStaticMarkup(<SectionBlocks countryCode="IS" sectionId="culture" />);
    expect(html).toContain('Usages');
    expect(html).toContain('On se déchausse');
  });
});
