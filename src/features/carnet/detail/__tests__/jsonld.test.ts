import { describe, expect, it } from 'vitest';
import { buildCarnetJsonLd, serializeJsonLd } from '../jsonld';
import { buildCarnetDetail } from '../buildCarnetDetail';
import type { BuildCarnetDetailInput, CarnetRow } from '../types';

const CARNET: CarnetRow = {
  id: 'c1',
  author_id: 'u1',
  title: 'Tour du Mont-Blanc',
  destination: 'France / Italie / Suisse',
  description: 'Dix jours, trois pays.',
  cover_image: 'https://cdn.test/cover.jpg',
  cover_image_alt: null,
  start_date: '2026-09-26',
  end_date: '2026-10-02',
  visibility: 'public',
  verified: true,
  likes_count: 6,
  comments_count: 3,
  distance_km: 106.4,
  denivele_m: 2002,
  groupe_id: null,
  lieu_depart: 'Chamonix',
  lieu_arrivee: 'Chamonix',
};

const DETAIL = buildCarnetDetail({
  carnet: CARNET,
  author: { id: 'u1', full_name: 'Camille Rochat', handle: 'camille', avatar_url: null, trust_score: 94 },
  hikeSession: null,
  etapes: [],
  hebergements: [],
  moments: [],
  kitItems: [],
  viewerId: null,
  liked: false,
  favorited: false,
} satisfies BuildCarnetDetailInput);

describe('serializeJsonLd', () => {
  it('neutralise la fermeture de script et les chevrons', () => {
    const payload = serializeJsonLd({ name: '</script><img src=x onerror=alert(1)>' });
    expect(payload).not.toContain('</script>');
    expect(payload).not.toContain('<img');
    expect(payload).toContain('\\u003c');
  });

  it('reste du JSON valide une fois déséchappé', () => {
    const payload = serializeJsonLd({ a: 1, b: 'x<y' });
    expect(JSON.parse(payload.replace(/\\u003c/g, '<'))).toEqual({ a: 1, b: 'x<y' });
  });

  it('échappe l’esperluette et les séparateurs de ligne Unicode', () => {
    const payload = serializeJsonLd({ url: 'https://cdn.test/a.jpg?x=1&y=2', sep: 'a\u2028b\u2029c' });
    expect(payload).not.toContain('&');
    expect(payload).toContain('\\u0026');
    expect(payload).not.toContain('\u2028');
    expect(payload).not.toContain('\u2029');
    expect(payload).toContain('\\u2028');
    expect(payload).toContain('\\u2029');
  });

  it('ne laisse passer aucune balise dans le payload complet', () => {
    const payload = serializeJsonLd(
      buildCarnetJsonLd(
        buildCarnetDetail({
          carnet: { ...CARNET, title: '</script><svg onload=alert(1)>', description: 'a & b' },
          author: { id: 'u1', full_name: '</script><img src=x>', handle: 'cam&ille', avatar_url: null, trust_score: 1 },
          hikeSession: null,
          etapes: [],
          hebergements: [],
          moments: [],
          kitItems: [],
          viewerId: null,
          liked: false,
          favorited: false,
        }),
        'https://lekitduvoyageur.fr',
      ),
    );
    expect(payload).not.toMatch(/<\/script/i);
    expect(payload).not.toContain('<svg');
    expect(payload).not.toContain('<img');
    expect(payload).not.toContain('&');
  });
});

describe('buildCarnetJsonLd', () => {
  it('décrit le carnet avec son auteur réel et sa couverture', () => {
    const json = buildCarnetJsonLd(DETAIL, 'https://lekitduvoyageur.fr') as any;
    const work = json['@graph'][0];
    expect(work['@type']).toBe('CreativeWork');
    expect(work.name).toBe('Tour du Mont-Blanc');
    expect(work.image).toBe('https://cdn.test/cover.jpg');
    expect(work.author).toMatchObject({ '@type': 'Person', name: 'Camille Rochat' });
    expect(work.url).toBe('https://lekitduvoyageur.fr/carnets/c1');
    expect(work.datePublished).toBe('2026-09-26');
  });

  it('omet l’auteur quand il est inconnu', () => {
    const orphan = buildCarnetDetail({
      carnet: { ...CARNET, author_id: null },
      author: null,
      hikeSession: null,
      etapes: [],
      hebergements: [],
      moments: [],
      kitItems: [],
      viewerId: null,
      liked: false,
      favorited: false,
    });
    const json = buildCarnetJsonLd(orphan, 'https://lekitduvoyageur.fr') as any;
    expect(json['@graph'][0].author).toBeUndefined();
  });

  it('n’expose aucun compteur inventé', () => {
    const json = JSON.stringify(buildCarnetJsonLd(DETAIL, 'https://lekitduvoyageur.fr'));
    expect(json).not.toContain('24');
    expect(json).not.toContain('"8"');
  });
});
