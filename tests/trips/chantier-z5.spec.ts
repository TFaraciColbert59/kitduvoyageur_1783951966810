import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * CHANTIER Z5 — FINITION (D32–D34)
 *
 * D32 : image de couverture cassée (placeholder gris).
 * Les cartes / héros de voyage doivent retomber sur le placeholder local
 * `no_image.png` dès qu'une URL de couverture échoue (onError), et non
 * afficher une image grise cassée.
 */

const NO_IMAGE = '/assets/images/no_image.png';
let lastProps: any = null;

// Mock AppImage pour capturer le contrat (fallbackSrc, src résolue).
vi.mock('@/components/ui/AppImage', () => ({
  default: (props: any) => {
    lastProps = props;
    return React.createElement('img', {
      src: props.src || NO_IMAGE,
      alt: props.alt,
      'data-fallback': props.fallbackSrc,
    });
  },
}));

describe('CHANTIER Z5 — FINITION (D32 : image de couverture cassée)', () => {
  const mockTrip = {
    id: 't1',
    slug: 'tour-mont-blanc',
    title: 'Tour du Mont-Blanc',
    description: null,
    destination_country_code: 'FR',
    destination_name: 'Alpes',
    primary_activity: 'trekking' as const,
    difficulty: 'hard' as const,
    status: 'draft' as const,
    visibility: 'private' as const,
    cover_image_url: null,
    start_date: null,
    end_date: null,
  };

  beforeEach(() => {
    lastProps = null;
  });

  it('Z-D32.1 : un voyage sans URL passe le placeholder local à AppImage', async () => {
    const { TripCard } = await import('@/features/trips/components/TripCard');
    renderToStaticMarkup(React.createElement(TripCard, { trip: mockTrip }));
    expect(lastProps).not.toBeNull();
    // Fallback configuré vers no_image (jamais d'image grise cassée).
    expect(lastProps.fallbackSrc).toBe(NO_IMAGE);
    // Sans cover_image_url, on ne passe PAS une URL vide à l'image.
    expect(lastProps.src).toBe(NO_IMAGE);
  });

  it('Z-D32.2 : une URL de couverture valide est bien transmise (pas de faux fallback)', async () => {
    const { TripCard } = await import('@/features/trips/components/TripCard');
    renderToStaticMarkup(
      React.createElement(TripCard, {
        trip: { ...mockTrip, cover_image_url: 'https://exemple.fr/couverture.jpg' },
      })
    );
    expect(lastProps).not.toBeNull();
    expect(lastProps.src).toBe('https://exemple.fr/couverture.jpg');
    // Le composant garde le fallback prêt en cas d'échec de chargement (D32).
    expect(lastProps.fallbackSrc).toBe(NO_IMAGE);
  });

  it('Z-D32.3 : TripHero fournit lui aussi un fallback local (jamais gris cassé)', async () => {
    const { TripHero } = await import('@/features/trips/components/TripHero');
    const tripFull = {
      ...mockTrip,
      description: '',
      cover_image_url: null,
      visibility: 'private' as const,
      budget_currency: 'EUR' as const,
      estimated_budget: null,
      user_id: 'u1',
      group_id: null,
      share_token: null,
      metadata: null,
      created_at: '',
      updated_at: '',
      collaborators: [],
      steps: [],
      items: [],
      expenses: [],
      documents: [],
      pois: [],
      safety_checkpoints: [],
      notes: [],
      permissions: {
        canEdit: false,
        canDelete: false,
        canInvite: false,
        canManageBudget: false,
        canViewDocuments: false,
      },
    };
    renderToStaticMarkup(
      React.createElement(TripHero, { trip: tripFull })
    );
    expect(lastProps).not.toBeNull();
    expect(lastProps.fallbackSrc).toBe(NO_IMAGE);
  });
});
