// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoriesSlot } from '../slots/MemoriesSlot';

afterEach(cleanup);

const OUTINGS = [
  {
    id: 'o1',
    title: 'Lac Blanc',
    mass: 'Mont-Blanc',
    date: '12 juil.',
    startedAt: '2026-07-12T08:00:00.000Z',
    km: 12.5,
    dplus: 800,
    proven: true,
    photos: ['https://images.test/lac-blanc.jpg'],
    status: 'done',
  },
  {
    id: 'o2',
    title: 'Traversée du Vercors',
    mass: 'Vercors',
    date: '3 juin',
    startedAt: '2025-06-03T08:00:00.000Z',
    km: 34,
    dplus: 1450,
    proven: false,
    photos: [],
    status: 'done',
  },
];

const STAMPS = [
  { id: 's1', name: 'Néouvielle', kind: 'massif', outings: 2, verified: true },
  { id: 's2', name: 'Vercors', kind: 'massif', outings: 1, verified: false },
];

describe('Souvenirs — timeline', () => {
  it('affiche les sorties réelles fournies par le bootstrap', () => {
    render(<MemoriesSlot lens="timeline" payload={{ outings: OUTINGS }} />);

    expect(screen.getByText('Lac Blanc')).toBeTruthy();
    expect(screen.getByText(/12,5 km/)).toBeTruthy();
    expect(screen.getByText(/800 m D\+/)).toBeTruthy();
    expect(screen.getByText('Mont-Blanc · 12 juil.')).toBeTruthy();
    expect(screen.getByLabelText('Trace GPS vérifiée')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'Couverture de Lac Blanc' })
    ).toBeTruthy();
  });

  it('filtre les sorties par année', () => {
    render(<MemoriesSlot lens="timeline" payload={{ outings: OUTINGS }} />);

    expect(screen.getByText('Traversée du Vercors')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '2026' }));

    expect(screen.getByText('Lac Blanc')).toBeTruthy();
    expect(screen.queryByText('Traversée du Vercors')).toBeNull();
  });

  it('accepte aussi les listes passées directement (compatibilité brief)', () => {
    render(<MemoriesSlot lens="timeline" outings={OUTINGS} />);
    expect(screen.getByText('Lac Blanc')).toBeTruthy();
  });

  it('affiche un état vide honnête sans sortie', () => {
    render(<MemoriesSlot lens="timeline" payload={{ outings: [] }} />);
    expect(screen.getByText('Aucune sortie enregistrée.')).toBeTruthy();
  });
});

describe('Souvenirs — passeport', () => {
  it('affiche les tampons réels et le nombre de lieux visités', () => {
    render(<MemoriesSlot lens="passport" payload={{ stamps: STAMPS }} />);

    expect(screen.getByText('Néouvielle')).toBeTruthy();
    expect(screen.getByText('2 sorties')).toBeTruthy();
    expect(screen.getByText('Vercors')).toBeTruthy();
    expect(screen.getByText('2 lieux visités')).toBeTruthy();
    expect(screen.getByLabelText('Lieu vérifié')).toBeTruthy();
  });

  it('accorde le compteur au singulier', () => {
    render(
      <MemoriesSlot
        lens="passport"
        payload={{ stamps: [STAMPS[1]] }}
      />
    );
    expect(screen.getByText('1 lieu visité')).toBeTruthy();
  });

  it('affiche un état vide honnête sans lieu validé', () => {
    render(<MemoriesSlot lens="passport" payload={{ stamps: [] }} />);
    expect(screen.getByText('Aucun lieu validé.')).toBeTruthy();
  });
});
