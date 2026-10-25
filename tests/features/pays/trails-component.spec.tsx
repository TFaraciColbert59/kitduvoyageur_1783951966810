import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { PaysTrailsList } from '@/features/pays/components/PaysTrailsList';

vi.mock('@/features/pays/hooks/usePaysTrails', () => ({ usePaysTrails: vi.fn() }));
import { usePaysTrails } from '@/features/pays/hooks/usePaysTrails';

const hook = vi.mocked(usePaysTrails);

describe('PaysTrailsList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche les sentiers réels', () => {
    hook.mockReturnValue({
      data: {
        status: 'ok',
        items: [
          {
            id: 't1',
            name: 'Laugavegur',
            distanceKm: 55,
            durationHours: null,
            difficulty: 'Difficile',
            elevationGain: 1200,
            latitude: 64,
            longitude: -19,
          },
        ],
      },
      isLoading: false,
      isError: false,
    } as never);
    const html = renderToStaticMarkup(<PaysTrailsList countryCode="IS" />);
    expect(html).toContain('Laugavegur');
    expect(html).toContain('55 km');
    expect(html).toContain('Difficile');
  });

  it('ne rend rien si vide ou erreur', () => {
    hook.mockReturnValue({ data: { status: 'empty', items: [] }, isLoading: false, isError: false } as never);
    expect(renderToStaticMarkup(<PaysTrailsList countryCode="IS" />)).toBe('');
    hook.mockReturnValue({ data: undefined, isLoading: false, isError: true } as never);
    expect(renderToStaticMarkup(<PaysTrailsList countryCode="IS" />)).toBe('');
  });
});
