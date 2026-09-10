import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { TripadvisorAttribution } from '@/features/discovery/components/TripadvisorAttribution';
import { TripRatingBadge } from '@/features/discovery/components/TripRatingBadge';
import { DiscoveryCard } from '@/features/discovery/components/DiscoveryCard';
import { DiscoveryEmpty, DiscoveryNotice } from '@/features/discovery/components/DiscoveryStates';
import { TRIPADVISOR_ATTRIBUTION_LABEL } from '@/features/discovery/constants';
import type { DiscoveryItem } from '@/features/discovery/types/discovery.types';

const baseItem: DiscoveryItem = {
  id: '42',
  provider: 'tripadvisor',
  type: 'restaurants',
  name: 'Dill',
  description: null,
  countryCode: 'IS',
  city: 'Reykjavík',
  address: null,
  latitude: 64.1466,
  longitude: -21.9426,
  rating: 4.5,
  reviewCount: 120,
  photoUrl: 'https://media-cdn.tripadvisor.com/photo.jpg',
  ratingImageUrl: 'https://static.tacdn.com/bubbles.png',
  tripadvisorUrl: 'https://www.tripadvisor.com/Restaurant_Review-g1',
  category: 'Nouvelle cuisine nordique',
  isBookable: false,
};

describe('attribution Tripadvisor', () => {
  it('sans asset logo validé : attribution TEXTE, aucune URL de logo inventée', () => {
    const html = renderToStaticMarkup(<TripadvisorAttribution />);
    expect(html).toContain(TRIPADVISOR_ATTRIBUTION_LABEL);
    expect(html).toContain('Tripadvisor');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('static.tacdn.com');
    expect(html).toContain('tripadvisor.com');
  });

  it('avec un asset logo autorisé : img ≥ 20px servie directement', () => {
    const html = renderToStaticMarkup(
      <TripadvisorAttribution logoUrl="https://assets.example/official-logo.svg" />
    );
    expect(html).toContain('https://assets.example/official-logo.svg');
    expect(html).toContain('height="20"');
  });
});

describe('notation Tripadvisor officielle', () => {
  it('n’affiche jamais 0/5 ni 0 avis quand la donnée est absente', () => {
    const html = renderToStaticMarkup(
      <TripRatingBadge rating={0} reviewCount={0} ratingImageUrl={null} />
    );
    expect(html).not.toContain('0/5');
    expect(html).not.toContain('0 avis');
    expect(html).toContain('Pas encore de note');
  });

  it('utilise l’image de bulles fournie par l’API sur fond blanc', () => {
    const html = renderToStaticMarkup(
      <TripRatingBadge rating={4.5} reviewCount={120} ratingImageUrl={baseItem.ratingImageUrl} />
    );
    expect(html).toContain('static.tacdn.com/bubbles.png');
    expect(html).toContain('4.5');
    expect(html).toContain('120');
    expect(html).toContain('bg-white');
  });
});

describe('carte d’aperçu Tripadvisor', () => {
  it('affiche le lien Tripadvisor avec rel sécurisé et cible externe', () => {
    const html = renderToStaticMarkup(<DiscoveryCard item={baseItem} />);
    expect(html).toContain('Voir sur Tripadvisor');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it('ne fabrique ni photo ni note lorsque la donnée manque', () => {
    const html = renderToStaticMarkup(
      <DiscoveryCard item={{ ...baseItem, photoUrl: null, rating: null, reviewCount: null, ratingImageUrl: null }} />
    );
    expect(html).toContain('Sans photo');
    expect(html).not.toContain('unsplash');
    expect(html).not.toContain('0/5');
    expect(html).not.toContain('0 avis');
  });
});

describe('états discovery', () => {
  it('affiche un état vide utile et un avis de quota', () => {
    expect(renderToStaticMarkup(<DiscoveryEmpty label="Aucun résultat" />)).toContain('Aucun résultat');
    const quota = renderToStaticMarkup(<DiscoveryNotice tone="warn">Quota atteint</DiscoveryNotice>);
    expect(quota).toContain('Quota atteint');
  });
});
