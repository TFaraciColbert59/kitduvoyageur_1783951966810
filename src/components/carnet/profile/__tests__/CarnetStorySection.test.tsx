// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CarnetStorySection } from '../CarnetStorySection';
import type { CarnetDay, CarnetDetail } from '@/features/carnet/detail/types';

afterEach(() => cleanup());

const DAY: CarnetDay = {
  id: 'd1',
  dayNumber: 3,
  label: 'JOUR 3 · 28 sept.',
  from: 'Les Contamines',
  to: 'Les Chapieux',
  note: 'Le col du Bonhomme sous la brume.',
  distanceKm: 18.2,
  elevationM: 1350,
  durationText: '7h30',
  weather: 'brume · 9 °C',
  overnight: 'Refuge de la Nova',
};

function detail(overrides: Partial<CarnetDetail> = {}): CarnetDetail {
  return {
    id: 'c1',
    title: 'Tour du Mont-Blanc',
    destination: null,
    description: 'Dix jours, trois pays, deux bivouacs.',
    coverImage: null,
    coverImageAlt: null,
    startDate: null,
    endDate: null,
    dateRange: null,
    visibility: 'public',
    isPublic: true,
    verified: false,
    isOwner: false,
    author: null,
    stats: [],
    engagement: { likes: 0, comments: 0, views: 0, liked: false, favorited: false },
    moments: [],
    photoMoments: [],
    days: [DAY],
    kit: { totalWeightG: null, items: [] },
    trace: null,
    distanceKm: null,
    elevationM: null,
    ...overrides,
  };
}

describe('CarnetStorySection — récit et étapes', () => {
  it('rend le récit complet et la timeline réelle', () => {
    render(<CarnetStorySection detail={detail()} />);
    expect(screen.getByRole('heading', { level: 2, name: /Récit/ })).toBeTruthy();
    expect(screen.getByText('Dix jours, trois pays, deux bivouacs.')).toBeTruthy();
    expect(screen.getByText('Les Contamines → Les Chapieux')).toBeTruthy();
    expect(screen.getByText('18,2 km')).toBeTruthy();
    expect(screen.getByText('1 350 m D+')).toBeTruthy();
    expect(screen.getByText('7h30')).toBeTruthy();
    expect(screen.getByText(/Refuge de la Nova/)).toBeTruthy();
  });

  it('n’affiche aucune étape inventée quand la liste est vide', () => {
    const { container } = render(<CarnetStorySection detail={detail({ days: [] })} />);
    expect(container.querySelectorAll('.ckp-day')).toHaveLength(0);
  });

  it('affiche l’état vide honnête sans récit ni étape', () => {
    render(<CarnetStorySection detail={detail({ description: null, days: [] })} />);
    expect(screen.getByText('Aucun récit pour l’instant.')).toBeTruthy();
  });

  it('propose au propriétaire de compléter son carnet', () => {
    render(<CarnetStorySection detail={detail({ description: null, days: [], isOwner: true })} />);
    expect(screen.getByRole('link', { name: /Modifier le carnet/ })).toBeTruthy();
  });

  it('n’affiche aucune météo quand la donnée manque', () => {
    render(
      <CarnetStorySection
        detail={detail({ days: [{ ...DAY, weather: null, overnight: null, note: null }] })}
      />,
    );
    expect(screen.queryByText(/°C/)).toBeNull();
  });
});
