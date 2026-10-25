import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { EditorialBlockCard } from '@/features/pays/components/EditorialBlockCard';
import {
  PaysSectionEmpty,
  PaysSectionNotice,
  PaysSectionSkeleton,
} from '@/features/pays/components/PaysContentStates';
import type { SectionBlock } from '@/features/pays/types';

const block: SectionBlock = {
  type: 'vue_ensemble',
  contentMd: 'Un pays **riche**.\n\nDeuxième paragraphe.',
  contentJson: null,
  sources: [{ title: 'Source officielle', url: 'https://example.com/source' }],
  generatedAt: '2026-03-01T00:00:00.000Z',
  reviewedAt: null,
  staleAfter: null,
};

describe('EditorialBlockCard', () => {
  it('rend le libellé, le gras markdown, la fraîcheur et les sources', () => {
    const html = renderToStaticMarkup(<EditorialBlockCard block={block} />);
    expect(html).toContain('Vue d’ensemble');
    expect(html).toContain('<strong');
    expect(html).toContain('riche');
    expect(html).toContain('03/2026');
    expect(html).toContain('https://example.com/source');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('n’affiche pas de fraîcheur ni de sources si absentes', () => {
    const html = renderToStaticMarkup(
      <EditorialBlockCard block={{ ...block, generatedAt: null, sources: [] }} />
    );
    expect(html).not.toContain('03/2026');
    expect(html).not.toContain('href=');
  });
});

describe('États de section Pays', () => {
  it('skeleton', () => {
    expect(renderToStaticMarkup(<PaysSectionSkeleton />)).toContain('animate-pulse');
  });
  it('état vide explicite', () => {
    expect(renderToStaticMarkup(<PaysSectionEmpty label="Contenu en préparation." />)).toContain(
      'Contenu en préparation.'
    );
  });
  it('notice discrète', () => {
    expect(renderToStaticMarkup(<PaysSectionNotice>Indisponible.</PaysSectionNotice>)).toContain(
      'Indisponible.'
    );
  });
});
