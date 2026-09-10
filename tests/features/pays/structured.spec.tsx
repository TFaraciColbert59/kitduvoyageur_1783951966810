import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { parseStructuredBlock } from '@/features/pays/mappers/structuredBlock';
import { StructuredBlockContent } from '@/features/pays/components/StructuredBlockContent';
import { EditorialBlockCard } from '@/features/pays/components/EditorialBlockCard';
import type { SectionBlock } from '@/features/pays/types';

const base: SectionBlock = {
  type: 'spots_incontournables',
  contentMd: 'Markdown de secours.',
  contentJson: null,
  sources: [],
  generatedAt: null,
  reviewedAt: null,
  staleAfter: null,
};

describe('parseStructuredBlock', () => {
  it('parse les spots valides', () => {
    const parsed = parseStructuredBlock({
      ...base,
      contentJson: [
        { nom: 'Vatnajökull', localisation: 'Sud-Est', type_outdoor: 'Glacier', description: 'Plus grande calotte glaciaire.' },
      ],
    });
    expect(parsed?.kind).toBe('spots');
    if (parsed?.kind === 'spots') expect(parsed.items[0].nom).toBe('Vatnajökull');
  });

  it('parse les itinéraires valides', () => {
    const parsed = parseStructuredBlock({
      ...base,
      type: 'itineraires_suggeres',
      contentJson: [{ nom: 'Laugavegur', duree_jours: 4, difficulte: 'Difficile', description: 'Trek volcanique.' }],
    });
    expect(parsed?.kind).toBe('itineraires');
  });

  it('retourne null sur données invalides ou type non structuré', () => {
    expect(parseStructuredBlock({ ...base, contentJson: { bad: true } })).toBeNull();
    expect(parseStructuredBlock({ ...base, contentJson: [{ nom: '' }] })).toBeNull();
    expect(parseStructuredBlock({ ...base, type: 'vue_ensemble', contentJson: [{}] })).toBeNull();
  });
});

describe('Rendu structuré', () => {
  it('StructuredBlockContent rend les spots', () => {
    const html = renderToStaticMarkup(
      <StructuredBlockContent
        block={{
          ...base,
          contentJson: [
            { nom: 'Þingvellir', localisation: 'Sud-Ouest', type_outdoor: 'Parc national', description: 'Faille tectonique.' },
          ],
        }}
      />
    );
    expect(html).toContain('Þingvellir');
    expect(html).toContain('Parc national');
    expect(html).toContain('Faille tectonique');
  });

  it('EditorialBlockCard privilégie le structuré sur le markdown', () => {
    const html = renderToStaticMarkup(
      <EditorialBlockCard
        block={{
          ...base,
          contentMd: 'UNIQUEMENT_MARKDOWN',
          contentJson: [{ nom: 'Spot A', localisation: 'Nord', description: 'Desc A' }],
        }}
      />
    );
    expect(html).toContain('Spot A');
    expect(html).not.toContain('UNIQUEMENT_MARKDOWN');
  });
});
