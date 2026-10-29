import { describe, expect, it } from 'vitest';
import { countByScope, filterByScope, kindLabel, mapSearchRows, normalizeQuery, paginate } from '../search';
import { SECTION_TABS, sectionIndex } from '../sectionTabs';

describe('mapSearchRows', () => {
  const results = mapSearchRows({
    posts: [{ id: 'p1', content: '  Bivouac au lac Blanc  ', image_url: null, media_urls: ['https://cdn/x.jpg'] }],
    carnets: [{ id: 'c1', title: 'Vercors', cover_image: 'https://cdn/c.jpg' }],
    clubs: [{ id: 'k1', slug: 'cordee', name: 'Cordée', members_count: 12, category: 'Randonnée', cover_image: null }],
    events: [{ id: 'e1', title: 'Lac Blanc', location: 'Chamonix', event_date: '2026-07-01' }],
    members: [{ id: 'm1', full_name: null, handle: 'camille', location: 'Lyon', avatar_url: 'a.jpg' }],
  });

  it('range les types dans l’ordre post, carnet, club, sortie, membre', () => {
    expect(results.map((r) => r.kind)).toEqual(['post', 'carnet', 'club', 'sortie', 'member']);
  });

  it('construit titre, méta, lien et visuel de chaque type', () => {
    expect(results[0]).toMatchObject({ title: 'Bivouac au lac Blanc', href: '/communaute?post=p1', cover: 'https://cdn/x.jpg' });
    expect(results[2]).toMatchObject({ meta: '12 membres · Randonnée', href: '/clubs/cordee' });
    expect(results[3]).toMatchObject({ meta: 'Chamonix · 2026-07-01', href: '/evenements' });
    expect(results[4]).toMatchObject({ title: '@camille', meta: '@camille · Lyon', href: '/profil/m1' });
  });

  it('tolère des listes absentes', () => {
    expect(mapSearchRows({})).toEqual([]);
    expect(mapSearchRows({ posts: null, clubs: null })).toEqual([]);
  });

  it('un club sans slug se rouvre par son id', () => {
    expect(mapSearchRows({ clubs: [{ id: 'k2', name: 'X' }] })[0]?.href).toBe('/clubs/k2');
  });
});

describe('filtres et pages', () => {
  const results = mapSearchRows({
    posts: [{ id: 'p1', content: 'a' }, { id: 'p2', content: 'b' }],
    clubs: [{ id: 'k1', name: 'K' }],
  });

  it('filtre et compte par type', () => {
    expect(filterByScope(results, 'all')).toHaveLength(3);
    expect(filterByScope(results, 'club')).toHaveLength(1);
    expect(countByScope(results, 'post')).toBe(2);
    expect(countByScope(results, 'all')).toBe(3);
  });

  it('découpe en pages de 4 sans perdre d’élément', () => {
    const pages = paginate(Array.from({ length: 10 }, (_, i) => i), 4);
    expect(pages.map((p) => p.length)).toEqual([4, 4, 2]);
    expect(pages.flat()).toHaveLength(10);
    expect(paginate([], 4)).toEqual([]);
  });

  it('refuse une taille de page nulle', () => {
    expect(() => paginate([1], 0)).toThrow(RangeError);
  });

  it('libellés de type', () => {
    expect(kindLabel('member')).toBe('Membres');
  });
});

describe('normalizeQuery', () => {
  it('neutralise les caractères de filtre PostgREST et les jokers ilike', () => {
    expect(normalizeQuery('  lac%blanc,(x)_y  ')).toBe('lac blanc x y');
    expect(normalizeQuery('a\\b')).toBe('a b');
  });
});

describe('volets', () => {
  it('ordre de la capsule : recherche, pour toi, carnets, clubs, sorties', () => {
    expect(SECTION_TABS.map((tab) => tab.id)).toEqual(['recherche', 'pour-toi', 'carnets', 'clubs', 'sorties']);
    expect(sectionIndex('clubs')).toBe(3);
  });
});
