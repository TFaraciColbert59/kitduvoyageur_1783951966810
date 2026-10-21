// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { VitrineSlot } from '../slots/VitrineSlot';

afterEach(cleanup);

const BADGES = [
  {
    id: 'b1',
    name: 'Explorateur',
    rarity: 'Commun',
    earned: true,
    earnedAt: '2026-09-01',
    requirementValue: 10,
    points: 50,
  },
  {
    id: 'b2',
    name: 'Bivouac',
    rarity: 'Rare',
    earned: true,
    earnedAt: '2026-09-20',
    requirementValue: 5,
    points: 100,
  },
  {
    id: 'b3',
    name: 'Cordée',
    rarity: 'Épique',
    earned: true,
    earnedAt: '2026-10-01',
    requirementValue: 3,
    points: 150,
  },
  {
    id: 'b4',
    name: 'Grand Nord',
    rarity: 'Légendaire',
    earned: true,
    earnedAt: '2026-08-01',
    requirementValue: 1,
    points: 300,
  },
  { id: 'b5', name: 'Grand Chelem', rarity: 'Rare', earned: false, requirementValue: 12, points: 500 },
  { id: 'b6', name: 'Marathon', rarity: 'Commun', earned: false, requirementValue: 42, points: 80 },
];

describe('Vitrine — Trophées', () => {
  it('affiche l’étagère de 4 trophées récents et le prochain badge', () => {
    render(<VitrineSlot lens="badges" badges={BADGES} />);

    const shelf = screen.getByRole('list', { name: 'Trophées récents' });
    expect(within(shelf).getAllByTestId('badge-tile')).toHaveLength(4);
    expect(within(shelf).getByText('Cordée')).toBeTruthy();
    expect(within(shelf).getByText('Grand Nord')).toBeTruthy();

    expect(screen.getByRole('heading', { name: 'Prochain badge' })).toBeTruthy();
    expect(screen.getByText('Grand Chelem')).toBeTruthy();
    expect(screen.getByText('4 / 6 trophées')).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: /Trophées débloqués : 4 sur 6/ })
    ).toBeTruthy();
  });

  it('déplie la grille « Tout voir » avec les 6 trophées', () => {
    render(<VitrineSlot lens="badges" badges={BADGES} />);

    expect(screen.queryByRole('list', { name: 'Tous les trophées' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tout voir' }));

    const grid = screen.getByRole('list', { name: 'Tous les trophées' });
    expect(within(grid).getAllByTestId('badge-tile')).toHaveLength(6);
    expect(within(grid).getByText('Grand Chelem')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réduire' })).toBeTruthy();
  });

  it('affiche un état vide explicite sans badge', () => {
    render(<VitrineSlot lens="badges" badges={[]} />);
    expect(screen.getByText('Aucun badge pour le moment.')).toBeTruthy();
  });

  it('lit payload.badges, le contrat de l’hôte', () => {
    render(<VitrineSlot lens="badges" payload={{ badges: BADGES }} />);
    const shelf = screen.getByRole('list', { name: 'Trophées récents' });
    expect(within(shelf).getByText('Explorateur')).toBeTruthy();
    expect(screen.getByText('Grand Chelem')).toBeTruthy();
  });

  it('signale quand tous les trophées sont débloqués', () => {
    render(<VitrineSlot lens="badges" badges={BADGES.filter((badge) => badge.earned)} />);
    expect(screen.getByText('Tous les trophées sont débloqués.')).toBeTruthy();
  });
});
