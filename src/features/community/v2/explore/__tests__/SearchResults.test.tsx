// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchHitVM } from '../../shared/types';
import { SearchResults, visibleSearchHits } from '../search/SearchResults';

afterEach(cleanup);

function hit(overrides: Partial<SearchHitVM> = {}): SearchHitVM {
  return {
    kind: 'carnet',
    id: 'c1',
    title: 'Lac Blanc au lever du jour',
    subtitle: 'Chamonix',
    cover: null,
    href: '/carnets/c1',
    score: 0.4,
    lat: null,
    lng: null,
    distanceKm: null,
    startsAt: null,
    excerpt: null,
    ...overrides,
  };
}

describe('visibleSearchHits', () => {
  it('regroupe dans l’ordre et plafonne à 3 par groupe en « Tout »', () => {
    const results = [
      hit({ kind: 'carnet', id: 'c1' }),
      hit({ kind: 'carnet', id: 'c2' }),
      hit({ kind: 'carnet', id: 'c3' }),
      hit({ kind: 'carnet', id: 'c4' }),
      hit({ kind: 'club', id: 'k1', title: 'La Cordée' }),
    ];
    const visible = visibleSearchHits(results, 'all');
    expect(visible).toHaveLength(4);
    expect(visible[0]?.kind).toBe('carnet');
    expect(visible[3]?.kind).toBe('club');
  });

  it('filtre sur un seul type quand un scope est choisi', () => {
    const results = [hit({ kind: 'carnet', id: 'c1' }), hit({ kind: 'club', id: 'k1' })];
    expect(visibleSearchHits(results, 'clubs').map((entry) => entry.id)).toEqual(['k1']);
    expect(visibleSearchHits(results, 'sorties')).toEqual([]);
  });
});

describe('SearchResults', () => {
  it('affiche les groupes avec compteur et « Voir tout »', () => {
    const onSeeAll = vi.fn();
    const results = [
      hit({ kind: 'carnet', id: 'c1' }),
      hit({ kind: 'carnet', id: 'c2' }),
      hit({ kind: 'carnet', id: 'c3' }),
      hit({ kind: 'carnet', id: 'c4' }),
      hit({ kind: 'club', id: 'k1', title: 'La Cordée du Vercors' }),
    ];
    render(
      <SearchResults
        results={results}
        terms={['chamonix']}
        scope="all"
        activeIndex={-1}
        rowIdFor={(index) => `row-${index}`}
        onSeeAll={onSeeAll}
      />,
    );
    expect(screen.getByText('Carnets')).toBeTruthy();
    expect(screen.getByText('Clubs')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Voir tout : Carnets, 4 résultats/ }));
    expect(onSeeAll).toHaveBeenCalledWith('carnet');
    const rows = screen.getAllByRole('link', { name: /Carnet : Lac Blanc au lever du jour/ });
    expect(rows[0]?.getAttribute('href')).toBe('/carnets/c1');
  });

  it('surligne le terme recherché sans injecter de HTML', () => {
    const { container } = render(
      <SearchResults
        results={[hit({ id: 'c1', title: 'Chamonix côté lac' })]}
        terms={['chamonix']}
        scope="all"
        activeIndex={-1}
        rowIdFor={(index) => `row-${index}`}
        onSeeAll={() => {}}
      />,
    );
    const marks = Array.from(container.querySelectorAll('mark'));
    expect(marks.map((mark) => mark.textContent)).toContain('Chamonix');
  });

  it('met en avant la ligne active au clavier et expose un lien par résultat', () => {
    render(
      <SearchResults
        results={[hit({ id: 'c1' }), hit({ id: 'c2', title: 'Traversée du Vercors', href: '/carnets/c2' })]}
        terms={[]}
        scope="all"
        activeIndex={1}
        rowIdFor={(index) => `row-${index}`}
        onSeeAll={() => {}}
      />,
    );
    const active = document.getElementById('row-1');
    expect(active?.className).toContain('is-kb');
    expect(active?.getAttribute('href')).toBe('/carnets/c2');
  });

  it('affiche les résultats d’un seul type en scope filtré', () => {
    render(
      <SearchResults
        results={[hit({ kind: 'sortie', id: 's1', title: 'Lac Blanc au lever du jour', href: '/sorties/s1' })]}
        terms={[]}
        scope="sorties"
        activeIndex={-1}
        rowIdFor={(index) => `row-${index}`}
        onSeeAll={() => {}}
      />,
    );
    expect(screen.getByRole('link', { name: /Sortie : Lac Blanc/ }).getAttribute('href')).toBe('/sorties/s1');
    expect(screen.queryByRole('button', { name: /Voir tout/ })).toBeNull();
  });
});
