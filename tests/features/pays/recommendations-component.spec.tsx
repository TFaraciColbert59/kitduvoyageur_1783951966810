import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

vi.mock('@/features/pays/hooks/usePaysRecommendations', () => ({ usePaysRecommendations: vi.fn() }));
import { usePaysRecommendations } from '@/features/pays/hooks/usePaysRecommendations';
import { PaysRecommendations } from '@/features/pays/components/PaysRecommendations';

const hook = vi.mocked(usePaysRecommendations);

describe('PaysRecommendations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche synthèse + recommandations réelles', () => {
    hook.mockReturnValue({
      data: {
        status: 'ok',
        synthesis: 'Visez juin à septembre pour ce profil.',
        synthesisProvider: 'ai',
        recommendations: [
          { kind: 'itineraire', title: 'Laugavegur', reason: 'Adapté à un profil intermédiaire.', meta: '4 j · Difficile' },
          { kind: 'spot', title: 'Vatnajökull', reason: 'Incontournable repéré.', meta: 'Glacier' },
        ],
      },
      isLoading: false,
      isError: false,
    } as never);

    const html = renderToStaticMarkup(<PaysRecommendations countryCode="IS" />);
    expect(html).toContain('Recommandé pour vous');
    expect(html).toContain('Visez juin à septembre');
    expect(html).toContain('Laugavegur');
    expect(html).toContain('Vatnajökull');
    expect(html).toContain('4 j · Difficile');
  });

  it('état vide explicite', () => {
    hook.mockReturnValue({
      data: { status: 'empty', synthesis: null, synthesisProvider: 'none', recommendations: [] },
      isLoading: false,
      isError: false,
    } as never);
    const html = renderToStaticMarkup(<PaysRecommendations countryCode="IS" />);
    expect(html).toContain('Aucune recommandation');
  });

  it('erreur discrète', () => {
    hook.mockReturnValue({ data: undefined, isLoading: false, isError: true } as never);
    const html = renderToStaticMarkup(<PaysRecommendations countryCode="IS" />);
    expect(html).toContain('indisponibles');
  });

  it('expose des sélecteurs accessibles (aria-pressed)', () => {
    hook.mockReturnValue({ data: undefined, isLoading: true, isError: false } as never);
    const html = renderToStaticMarkup(<PaysRecommendations countryCode="IS" />);
    expect(html).toContain('aria-pressed');
    expect(html).toContain('Niveau');
    expect(html).toContain('Durée');
  });
});
