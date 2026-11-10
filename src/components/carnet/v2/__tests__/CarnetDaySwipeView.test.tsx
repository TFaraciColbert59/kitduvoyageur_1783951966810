// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CarnetDaySwipeView } from '../CarnetDaySwipeView';
import type {
  CarnetDay,
  CarnetEtapeDay,
  CarnetMomentItem,
  CarnetNightItem,
} from '@/features/carnet/detail/types';

afterEach(() => cleanup());

const moment = (
  id: string,
  dayNumber: number,
  place: string,
  imageUrl: string | null
): CarnetMomentItem => ({
  id,
  dayNumber,
  time: '09:20',
  caption: null,
  authorName: null,
  place,
  imageUrl,
  title: `Moment ${id}`,
});

const moments: CarnetMomentItem[] = [
  moment('m1', 1, 'La Bérarde', 'https://example.test/j1.jpg'),
  moment('m2', 2, 'Vallouise', null),
];

const day = (n: number, date: string, distanceKm: number, elevationM: number): CarnetDay => ({
  index: n,
  dayNumber: n,
  date,
  distanceKm,
  elevationM,
  durationS: n === 1 ? 4 * 3600 : 7 * 3600 + 600,
  moments: moments.filter((m) => m.dayNumber === n),
  points: [],
});

const days: CarnetDay[] = [day(2, '2026-07-14', 18.4, 1080), day(1, '2026-07-13', 17, 1240)];

const etapes: CarnetEtapeDay[] = [
  {
    id: 'e1',
    dayNumber: 1,
    label: 'JOUR 1',
    from: 'La Bérarde',
    to: 'Refuge du Pigeonnier',
    note: null,
    distanceKm: 17,
    elevationM: 1240,
    durationText: '6 h 40',
    weather: 'Éclaircies · 11 °C',
    overnight: 'Refuge du Pigeonnier',
  },
  {
    id: 'e2',
    dayNumber: 2,
    label: 'JOUR 2',
    from: 'Refuge du Pigeonnier',
    to: 'Vallouise',
    note: null,
    distanceKm: 18.4,
    elevationM: 1080,
    durationText: null,
    weather: null,
    overnight: null,
  },
];

const nights: CarnetNightItem[] = [
  {
    id: 'n1',
    dayNumber: 1,
    name: 'Refuge du Pigeonnier',
    type: 'refuge',
    altitudeM: 2410,
    infos: null,
    lat: null,
    lng: null,
    mapRefugeId: null,
  },
  {
    id: 'n2',
    dayNumber: 2,
    name: 'Gîte des Claux',
    type: 'gite',
    altitudeM: null,
    infos: null,
    lat: null,
    lng: null,
    mapRefugeId: null,
  },
];

function renderView(activeDay: number) {
  const onDayChange = vi.fn();
  const onSelectMoment = vi.fn();
  render(
    <CarnetDaySwipeView
      days={days}
      etapes={etapes}
      activeDay={activeDay}
      onDayChange={onDayChange}
      moments={activeDay === 0 ? moments : moments.filter((m) => m.dayNumber === activeDay)}
      onSelectMoment={onSelectMoment}
      nights={nights}
      coverImage="https://example.test/cover.jpg"
      travellers={3}
      distanceKm={35.4}
      elevationM={2320}
    />
  );
  return { onDayChange, onSelectMoment };
}

describe('CarnetDaySwipeView — vue du jour', () => {
  it('rend le Résumé : en-tête « Tout » et une carte par jour', () => {
    const { onDayChange } = renderView(0);

    // En-tête : badge sombre « Tout », compte réel, totaux réels.
    expect(screen.getByText('Tout')).toBeTruthy();
    expect(screen.getByText('2 jours · 3 voyageurs')).toBeTruthy();
    expect(screen.getByText(/35,4 km/)).toBeTruthy();
    expect(screen.getByText(/2 moments/)).toBeTruthy();

    // Deux jours, donc deux cartes, dans l'ordre des jours.
    const cards = screen.getAllByRole('button', { name: /^Ouvrir le jour/ });
    expect(cards).toHaveLength(2);
    expect(cards[0].getAttribute('aria-label')).toBe(
      'Ouvrir le jour 1 : La Bérarde vers Refuge du Pigeonnier'
    );
    expect(cards[0].textContent).toContain('La Bérarde → Refuge du Pigeonnier');
    expect(cards[0].textContent).toContain('J1 · 13 juil.');
    // L'altitude de la nuit n'apparaît que si elle est réelle.
    expect(cards[0].textContent).toContain('2');
    expect(cards[0].textContent?.match(/2410|2\s?410/)).toBeTruthy();
    expect(cards[1].textContent?.match(/2410|2\s?410/)).toBeNull();

    // La carte est la porte du jour : clic → onDayChange(n) du jour visé.
    fireEvent.click(cards[1]);
    expect(onDayChange).toHaveBeenCalledWith(2);
    expect(onDayChange).toHaveBeenCalledTimes(1);

    // Plus de grille de moments sur le Résumé : les cartes-jour la remplacent.
    expect(screen.queryByRole('group', { name: /Moments du carnet/ })).toBeNull();
  });

  it('rend le jour : en-tête J1 et la grille, sans carte-jour', () => {
    renderView(1);

    expect(screen.getByText('J1')).toBeTruthy();
    expect(screen.getByText('La Bérarde → Refuge du Pigeonnier')).toBeTruthy();
    expect(screen.getByText(/13 juil\./)).toBeTruthy();
    expect(screen.getByText(/6 h 40/)).toBeTruthy();
    expect(screen.getByLabelText('Éclaircies · 11 °C').textContent).toBe('11°');

    // Les cartes-jour ne sont que sur le Résumé ; la grille 3 colonnes reste.
    expect(screen.queryAllByRole('button', { name: /^Ouvrir le jour/ })).toHaveLength(0);
    expect(screen.getByRole('group', { name: /Moments du carnet/ })).toBeTruthy();
  });
});
