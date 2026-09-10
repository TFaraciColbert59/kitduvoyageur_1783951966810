import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TripKitView } from '@/features/trips/components/TripKitView';
import type { TripFull } from '@/features/trips/types/trip.types';
import type { TripKitAnalysis } from '@/features/trips/types/kit.types';

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href, className }: any) =>
    React.createElement('a', { href, className }, children),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

describe('TripKitView Component (Apple HIG & Core Business Monetization)', () => {
  const dummyTrip: TripFull = {
    id: 'trip-1',
    slug: 'islande-traversee-2026',
    title: 'Traversée des Hautes Terres d’Islande',
    description: 'Trek engagé en autonomie complète.',
    destination_country_code: 'IS',
    destination_name: 'Landmannalaugar',
    start_date: '2026-08-01',
    end_date: '2026-08-08',
    status: 'planned',
    visibility: 'public',
    difficulty: 'hard',
    primary_activity: 'trekking',
    estimated_budget: 1200,
    budget_currency: 'EUR',
    cover_image_url: null,
    user_id: 'user-1',
    group_id: null,
    share_token: null,
    metadata: null,
    created_at: '2026-09-05T00:00:00Z',
    updated_at: '2026-09-05T00:00:00Z',
    user_role: 'owner',
    permissions: {
      canEdit: true,
      canDelete: true,
      canInvite: true,
      canManageBudget: true,
      canViewDocuments: true,
    },
    collaborators: [],
    steps: [],
    items: [
      {
        id: 'item-1',
        trip_id: 'trip-1',
        item_name: 'Sac de couchage -10°C',
        category: 'sleep',
        quantity: 1,
        weight_grams: 950,
        is_packed: true,
        status: 'packed',
        packed_by: null,
        inventory_item_id: null,
        affiliate_link_id: null,
        is_vital: true,
        created_at: '',
        updated_at: '',
      },
    ],
    expenses: [],
    documents: [],
    pois: [],
    safety_checkpoints: [],
    notes: [],
  };

  const dummyAnalysis: TripKitAnalysis = {
    totalItemsCount: 1,
    packedItemsCount: 1,
    vitalItemsCount: 1,
    packedVitalCount: 1,
    completionPercent: 100,
    totalWeightGrams: 2000,
    baseWeightGrams: 2000,
    wornWeightGrams: 0,
    consumableWeightGrams: 0,
    weightCategory: 'ultralight',
    maxAltitudeM: 1100,
    seasonContext: 'Mois 8',
    climateWarnings: ['Islande : Météo hautement imprévisible, vents violents et gués froids.'],
    vitalGaps: [
      {
        id: 'rec-rain-poncho',
        key: 'rain-poncho',
        name: 'Poncho Imperméable Pluie',
        category: 'clothing',
        priority: 'vital',
        reason: 'Protection immédiate contre les averses torrentielles en Islande.',
        weightGrams: 150,
        shopProduct: {
          id: 'p-poncho',
          slug: 'poncho-impermeable-pluie-categorie-bigbuy',
          name: 'Poncho Imperméable Pluie',
          brand: 'BigBuy Outdoor',
          price_eur: 12.0,
          weight_g: 150,
          category_main: 'Vêtements / Protection',
        },
      },
    ],
    recommendedGaps: [],
    gearGaps: [],
    unweighedItemsCount: 0,
  };

  it('ne rend plus les cartes stats (poids / score / contexte retirées)', () => {
    const html = renderToStaticMarkup(
      React.createElement(TripKitView, { trip: dummyTrip, analysis: dummyAnalysis })
    );

    expect(html).not.toContain('Score');
    expect(html).not.toContain('Poids de base');
    expect(html).not.toContain('Durée de l’autonomie');
  });

  it('renders terrain climate warning banner', () => {
    const html = renderToStaticMarkup(
      React.createElement(TripKitView, { trip: dummyTrip, analysis: dummyAnalysis })
    );

    expect(html).toContain('Conditions de terrain identifiées pour votre expédition');
    expect(html).toContain('Islande : Météo hautement imprévisible');
  });

  it('fusionne la boutique dans « Sac & inventaire » avec bouton boîte-flèche unique', () => {
    const html = renderToStaticMarkup(
      React.createElement(TripKitView, {
        trip: dummyTrip,
        analysis: dummyAnalysis,
        availableProducts: [dummyAnalysis.vitalGaps[0].shopProduct!],
      })
    );

    expect(html).toContain('À ajouter');
    expect(html).toContain('Poncho Imperméable Pluie');
    expect(html).toContain('12 €');
    expect(html).toContain('150 g');
    expect(html).toContain('Ajouter Poncho Imperméable Pluie à mon matériel');
    expect(html).not.toContain('au panier');
    expect(html).not.toContain('Il manque dans votre sac');
  });

  it('inventaire possédé hors sac : bouton + et stock discret pour un consommable', () => {
    const html = renderToStaticMarkup(
      React.createElement(TripKitView, {
        trip: dummyTrip,
        analysis: dummyAnalysis,
        inventoryItems: [
          {
            id: 'inv-eau',
            name: 'Bouteille d’eau filtrante',
            brand: 'Katadyn',
            category: 'Eau & Filtres',
            weight_g: 200,
            price_cents: 2800,
            condition: 'bon',
            photo_url: null,
            is_lent: false,
            purchase_date: null,
            maintenance_due_at: null,
            expiry_date: null,
            tags: null,
            quantity: 3,
          },
        ],
      })
    );

    expect(html).toContain('Ajouter Bouteille d’eau filtrante au sac');
    expect(html).toContain('×3 en stock');
  });

  it('renders trip items checklist with packed state and remove button', () => {
    const html = renderToStaticMarkup(
      React.createElement(TripKitView, { trip: dummyTrip, analysis: dummyAnalysis })
    );

    expect(html).toContain('Sac &amp; inventaire du voyage');
    expect(html).toContain('Sac de couchage -10°C');
    expect(html).toContain('emballé');
    expect(html).toContain('950 g');
    expect(html).toContain('aria-label="Retirer du sac"');
  });
});
