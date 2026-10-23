// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { VitrineSlot } from '../slots/VitrineSlot';

afterEach(cleanup);

const STATS = {
  km: 351,
  dplus: 20200,
  outings: 10,
  nights: 4,
  massifs: 3,
  countries: 2,
  yearMonths: [],
  bestMonth: 'Août',
  longestOuting: 58,
};

describe('Vitrine — Stats', () => {
  it('affiche les stats réelles sans carte interne', () => {
    render(<VitrineSlot lens="stats" stats={STATS} />);
    expect(screen.getByText('351 km')).toBeTruthy();
    expect(screen.queryByTestId('slot-map')).toBeNull();
  });

  it('rend la carte héro 3 colonnes, les 3 tuiles et les 12 barres', () => {
    render(<VitrineSlot lens="stats" stats={STATS} />);

    const hero = screen.getByRole('region', { name: 'Statistiques clés' });
    expect(within(hero).getByText('351 km')).toBeTruthy();
    expect(within(hero).getByText('20,2 k m')).toBeTruthy();
    expect(within(hero).getByText('10')).toBeTruthy();
    expect(within(hero).getByText('Distance')).toBeTruthy();
    expect(within(hero).getByText('Dénivelé positif')).toBeTruthy();
    expect(within(hero).getByText('Sorties')).toBeTruthy();

    const tiles = screen.getByRole('list', { name: 'Repères de la vitrine' });
    expect(within(tiles).getByText('4')).toBeTruthy();
    expect(within(tiles).getByText('Nuits')).toBeTruthy();
    expect(within(tiles).getByText('3')).toBeTruthy();
    expect(within(tiles).getByText('Massifs')).toBeTruthy();
    expect(within(tiles).getByText('2')).toBeTruthy();
    expect(within(tiles).getByText('Pays')).toBeTruthy();

    expect(screen.getByRole('heading', { name: 'Cette année' })).toBeTruthy();
    expect(screen.getAllByTestId('vitrine-month-bar')).toHaveLength(12);
    // Sans données annuelles, le meilleur mois n'est ni inventé ni affiché.
    expect(screen.queryByText('Août')).toBeNull();
    expect(screen.queryByText('Meilleur mois')).toBeNull();
    expect(screen.getByText('58 km')).toBeTruthy();
  });

  it('affiche — au lieu de 0 pour les champs numériques absents', () => {
    render(<VitrineSlot lens="stats" stats={{ km: 351, outings: 10 }} />);

    const hero = screen.getByRole('region', { name: 'Statistiques clés' });
    expect(within(hero).getByText('351 km')).toBeTruthy();
    expect(within(hero).getByText('10')).toBeTruthy();
    expect(within(hero).getByText('—')).toBeTruthy();

    // Les repères à zéro sont masqués : aucun ne doit être inventé.
    expect(screen.queryByRole('list', { name: 'Repères de la vitrine' })).toBeNull();
  });

  it('garde le meilleur mois quand des données annuelles existent', () => {
    render(
      <VitrineSlot
        lens="stats"
        stats={{ ...STATS, yearMonths: [0, 0, 0, 0, 0, 0, 0, 44, 0, 0, 0, 0] }}
      />
    );
    expect(screen.getByText('Meilleur mois')).toBeTruthy();
    expect(screen.getByText('Août')).toBeTruthy();
  });

  it('affiche les 12 barres réelles quand yearMonths est fourni', () => {
    render(
      <VitrineSlot
        lens="stats"
        stats={{
          ...STATS,
          yearMonths: [2, 0, 12, 30, 70, 90, 120, 44, 18, 5, 0, 0],
          bestMonth: 'Juillet',
        }}
      />
    );
    const bars = screen.getAllByTestId('vitrine-month-bar');
    expect(bars).toHaveLength(12);
    expect(bars[6].getAttribute('aria-label')).toContain('Juillet');
    expect(bars[6].getAttribute('aria-label')).toContain('120');
    expect(screen.getByText('Juillet')).toBeTruthy();
  });

  it('affiche un état vide explicite quand aucune statistique n’est fournie', () => {
    render(<VitrineSlot lens="stats" />);
    expect(screen.getByText('Aucune sortie publiée')).toBeTruthy();
    expect(screen.queryAllByTestId('vitrine-month-bar')).toHaveLength(0);
  });

  it('lit payload.stats, le contrat de l’hôte', () => {
    render(<VitrineSlot lens="stats" payload={{ stats: STATS }} />);
    expect(screen.getByText('351 km')).toBeTruthy();
    expect(screen.getByText('58 km')).toBeTruthy();
  });

  it('n’ajoute ni couronne ni classement dans la vitrine', () => {
    const { container } = render(<VitrineSlot lens="stats" stats={STATS} />);
    expect(container.textContent).not.toMatch(/classement|couronne|podium/i);
    expect(container.querySelector('[data-testid="slot-map"]')).toBeNull();
    expect(container.querySelector('canvas, .map, .mapzone')).toBeNull();
  });
});
