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
    expect(screen.getByRole('img', { name: 'Couverture de Lac Blanc' })).toBeTruthy();
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
    render(<MemoriesSlot lens="passport" payload={{ stamps: [STAMPS[1]] }} />);
    expect(screen.getByText('1 lieu visité')).toBeTruthy();
  });

  it('affiche un état vide honnête sans lieu validé', () => {
    render(<MemoriesSlot lens="passport" payload={{ stamps: [] }} />);
    expect(screen.getByText('Aucun lieu validé.')).toBeTruthy();
  });
});

describe('Souvenirs — conventions de slot et honnêteté des données', () => {
  it('expose data-state="empty" sur la racine sans sortie', () => {
    render(<MemoriesSlot lens="timeline" payload={{ outings: [] }} />);
    const root = screen.getByTestId('slot-content');
    expect(root.getAttribute('data-state')).toBe('empty');
    expect(root.className).toContain('lkdv-slot-state');
  });

  it('expose data-state="ready" sur la racine avec des sorties', () => {
    render(<MemoriesSlot lens="timeline" payload={{ outings: OUTINGS }} />);
    const root = screen.getByTestId('slot-content');
    expect(root.getAttribute('data-state')).toBe('ready');
    expect(root.className).toContain('lkdv-slot-state');
  });

  it('groupe les sorties selon Europe/Paris, jamais selon UTC', () => {
    render(
      <MemoriesSlot
        lens="timeline"
        payload={{
          outings: [
            {
              id: 'paris-dec',
              title: 'Veille du réveillon',
              startedAt: '2026-12-31T22:30:00.000Z',
            },
            {
              id: 'paris-jan',
              title: 'Bascule de minuit',
              startedAt: '2026-12-31T23:30:00.000Z',
            },
          ],
        }}
      />
    );

    // 22:30Z = 23:30 à Paris le 31 décembre ; 23:30Z = 00:30 à Paris le
    // 1er janvier. Le second cas prouve que le groupement ne suit pas UTC.
    expect(screen.getByText('Décembre 2026')).toBeTruthy();
    expect(screen.getByText('Janvier 2027')).toBeTruthy();
  });

  it('omet chaque métrique absente au lieu d’afficher 0', () => {
    render(
      <MemoriesSlot
        lens="timeline"
        payload={{
          outings: [
            {
              id: 'sans-dplus',
              title: 'Sans dénivelé',
              startedAt: '2026-05-01T08:00:00.000Z',
              km: 7.2,
            },
          ],
        }}
      />
    );

    expect(screen.getByText(/7,2 km/)).toBeTruthy();
    expect(screen.queryByText(/D\+/)).toBeNull();
    expect(screen.queryByText(/0 km/)).toBeNull();
  });

  it('n’affiche pas les zéros du mapper comme des métriques réelles', () => {
    render(
      <MemoriesSlot
        lens="timeline"
        payload={{
          outings: [
            {
              id: 'zeros',
              title: 'Valeurs absentes du mapper',
              startedAt: '2026-05-03T08:00:00.000Z',
              km: 0,
              dplus: 0,
            },
          ],
        }}
      />
    );

    expect(screen.queryByText(/0 km/)).toBeNull();
    expect(screen.queryByText(/0 m D\+/)).toBeNull();
  });

  it('n’affiche aucune ligne de métriques quand km et D+ manquent', () => {
    render(
      <MemoriesSlot
        lens="timeline"
        payload={{
          outings: [
            {
              id: 'sans-metrics',
              title: 'Sortie sans mesure',
              startedAt: '2026-05-02T08:00:00.000Z',
            },
          ],
        }}
      />
    );

    expect(screen.queryByText(/0 km/)).toBeNull();
    expect(screen.queryByText(/m D\+/)).toBeNull();
  });

  it('annonce aux lecteurs d’écran le nombre de sorties filtrées', () => {
    render(<MemoriesSlot lens="timeline" payload={{ outings: OUTINGS }} />);

    expect(screen.getByRole('status').textContent).toContain('2 sorties');
    fireEvent.click(screen.getByRole('button', { name: '2026' }));
    expect(screen.getByRole('status').textContent).toContain('1 sortie');
  });

  it('utilise un titre de carte de niveau 4 sous les sections mensuelles', () => {
    render(<MemoriesSlot lens="timeline" payload={{ outings: OUTINGS }} />);
    expect(screen.getByRole('heading', { level: 4, name: 'Lac Blanc' })).toBeTruthy();
  });
});
