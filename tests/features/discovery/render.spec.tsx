import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import type { CountryDetail } from '@/lib/countryDetails';
import { getTripadvisorAttribution } from '@/features/discovery/constants';
import { DiscoverySection } from '@/features/discovery/components/DiscoverySection';
import PaysDestinationsView from '@/components/pays/PaysDestinationsView';
import PaysActivitesView from '@/components/pays/PaysActivitesView';
import PaysGastronomieView from '@/components/pays/PaysGastronomieView';
import PaysHebergementsView from '@/components/pays/PaysHebergementsView';
import type { DiscoveryCategory, DiscoveryItem, DiscoveryResponse } from '@/features/discovery/types/discovery.types';

vi.mock('@/features/discovery/hooks/useDiscovery', () => ({ useDiscovery: vi.fn() }));
vi.mock('@/hooks/useCountryPracticalGuide', () => ({
  useCountryPracticalGuide: vi.fn(() => ({ data: undefined, isLoading: false, isError: false })),
}));
vi.mock('@/features/pays/hooks/usePaysRegions', () => ({
  usePaysRegions: vi.fn(() => ({ data: undefined, isLoading: false, isError: false })),
}));
vi.mock('@/features/pays/hooks/usePaysWeather', () => ({
  usePaysWeather: vi.fn(() => ({ data: undefined, isLoading: false, isError: false })),
}));
vi.mock('@/features/pays/hooks/usePaysTrails', () => ({
  usePaysTrails: vi.fn(() => ({ data: undefined, isLoading: false, isError: false })),
}));
import { useDiscovery } from '@/features/discovery/hooks/useDiscovery';

const hook = vi.mocked(useDiscovery);

function makeItem(overrides: Partial<DiscoveryItem> & { type: DiscoveryCategory; name: string }): DiscoveryItem {
  return {
    id: '1',
    provider: 'tripadvisor',
    description: null,
    countryCode: 'IS',
    city: 'Reykjavík',
    address: null,
    latitude: 64.1,
    longitude: -21.9,
    rating: 4.5,
    reviewCount: 120,
    photoUrl: null,
    ratingImageUrl: 'https://static.tacdn.com/bubbles.png',
    tripadvisorUrl: 'https://www.tripadvisor.com/Attraction_Review-g1',
    category: 'Attraction',
    isBookable: false,
    ...overrides,
  };
}

const attraction = makeItem({ type: 'attractions', name: 'Reykjavik Safari' });
const restaurant = makeItem({ type: 'restaurants', name: 'Dill', city: 'Reykjavík' });
const hotel = makeItem({ type: 'hotels', name: 'Hôtel Borg', city: 'Reykjavík' });

function envelope(category: DiscoveryCategory, items: DiscoveryItem[]): DiscoveryResponse {
  return {
    status: items.length > 0 ? 'ok' : 'empty',
    provider: 'tripadvisor',
    category,
    countryCode: 'IS',
    items,
    attribution: getTripadvisorAttribution(),
  };
}

const country = {
  code: 'IS',
  nom: 'Islande',
  destinations: [
    {
      isBig: true,
      image_url: 'https://images.unsplash.com/photo-dest',
      categorie: 'Site majeur',
      titre: 'Jökulsárlón',
      titre_em: 'glaciaire',
      meta_1: 'a',
      meta_2: 'b',
      meta_3: 'c',
    },
  ],
  activites: [
    {
      categorie: 'rand',
      difficulte: 'Facile',
      difficulte_type: 'easy',
      saison: 'Été',
      image_url: 'https://images.unsplash.com/photo-act',
      tag: 'Trek',
      titre: 'Sentier',
      titre_em: '',
      description: 'desc',
      duree: '2 h',
      prix: '€0',
    },
  ],
  gastronomie: [
    {
      numero: 1,
      categorie: 'Poisson',
      nom: 'Plokkfiskur',
      nom_em: '',
      description: 'desc',
      image_url: 'https://images.unsplash.com/photo-food',
    },
  ],
  country_content: undefined,
} as unknown as CountryDetail;

function respondByCategory() {
  hook.mockImplementation((params: { category: DiscoveryCategory }) => {
    const items =
      params.category === 'attractions'
        ? [attraction]
        : params.category === 'restaurants'
          ? [restaurant]
          : [hotel];
    return {
      data: envelope(params.category, items),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  respondByCategory();
});

describe('Rendu des quatre sections Pays (données dynamiques uniquement)', () => {
  it('Destinations : cartes dynamiques, AUCUN éditorial statique', () => {
    const html = renderToStaticMarkup(<PaysDestinationsView country={country} />);
    expect(html).toContain('Reykjavik Safari');
    expect(html).toContain('Voir sur Tripadvisor');
    expect(html).not.toContain('Jökulsárlón'); // statique supprimé
  });

  it('Activités : cartes dynamiques, AUCUN éditorial statique', () => {
    const html = renderToStaticMarkup(<PaysActivitesView country={country} />);
    expect(html).toContain('Reykjavik Safari');
    expect(html).toContain('Voir sur Tripadvisor');
    expect(html).not.toContain('Sentier');
  });

  it('Gastronomie : cartes dynamiques, AUCUN éditorial statique', () => {
    const html = renderToStaticMarkup(<PaysGastronomieView country={country} />);
    expect(html).toContain('Dill');
    expect(html).not.toContain('Plokkfiskur');
  });

  it('Hébergements : cartes dynamiques (ou en-tête seul si provider ne couvre pas)', () => {
    const html = renderToStaticMarkup(<PaysHebergementsView country={country} />);
    expect(html).toContain('Hôtel Borg');
    expect(html).toContain('Voir sur Tripadvisor');
  });
});

describe('États UI de DiscoverySection (fixtures, aucun réseau)', () => {
  const render = (state: Record<string, unknown>) => {
    hook.mockReturnValue({ refetch: vi.fn(), isLoading: false, isError: false, ...state } as never);
    return renderToStaticMarkup(
      <DiscoverySection countryCode="IS" category="attractions" limit={6} title="Attractions" />
    );
  };

  it('1. chargement → skeleton', () => {
    expect(render({ isLoading: true })).toContain('animate-pulse');
  });

  it('2. résultats → cartes', () => {
    const html = render({ data: envelope('attractions', [attraction]) });
    expect(html).toContain('Reykjavik Safari');
    expect(html).toContain('Voir sur Tripadvisor');
  });

  it('3. aucun résultat → état vide', () => {
    expect(render({ data: envelope('attractions', []) })).toContain('Aucun résultat');
  });

  it('4. erreur 401 → avis discret, éditorial non bloqué', () => {
    const html = render({ data: { ...envelope('attractions', []), status: 'error', reason: 'auth' } });
    expect(html).toContain('momentanément indisponible');
  });

  it('5. erreur 403/package → avis discret', () => {
    const html = render({ data: { ...envelope('attractions', []), status: 'error', reason: 'auth' } });
    expect(html).toContain('momentanément indisponible');
  });

  it('6. quota 429 → avis quota', () => {
    const html = render({ data: { ...envelope('attractions', []), status: 'quota', reason: 'quota' } });
    expect(html).toContain('quota atteint');
  });

  it('7. réseau/timeout → avis discret', () => {
    const html = render({ data: { ...envelope('attractions', []), status: 'error', reason: 'timeout' } });
    expect(html).toContain('momentanément indisponible');
  });

  it('8. image absente → placeholder, pas de fausse image', () => {
    const html = render({ data: envelope('attractions', [makeItem({ type: 'attractions', name: 'Sans image', photoUrl: null })]) });
    expect(html).toContain('Sans photo');
    expect(html).not.toContain('unsplash');
  });

  it('9. note absente → jamais 0/5 ni 0 avis', () => {
    const html = render({
      data: envelope('attractions', [
        makeItem({ type: 'attractions', name: 'Sans note', rating: null, reviewCount: null, ratingImageUrl: null }),
      ]),
    });
    expect(html).toContain('Pas encore de note');
    expect(html).not.toContain('0/5');
    expect(html).not.toContain('0 avis');
  });

  it('10. URL Tripadvisor absente → aucun lien factice', () => {
    const html = render({
      data: envelope('attractions', [makeItem({ type: 'attractions', name: 'Sans lien', tripadvisorUrl: null })]),
    });
    expect(html).not.toContain('Voir sur Tripadvisor');
  });

  it('bonus. API non configurée → bloc silencieux (éditorial intact)', () => {
    const html = render({ data: { ...envelope('attractions', []), status: 'unconfigured', reason: 'missing_config' } });
    expect(html).toBe('');
  });
});
