// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetStatsPane } from '../panes/CarnetStatsPane';
import type { CarnetDay } from '@/features/carnet/detail/types';
import { detail } from './fixtures';

afterEach(() => cleanup());

const DAYS: CarnetDay[] = [
  {
    id: 'd1',
    dayNumber: 1,
    label: 'JOUR 1 · 26 sept.',
    from: 'Les Houches',
    to: 'Refuge de Bellachat',
    note: null,
    distanceKm: 12.4,
    elevationM: 1050,
    durationText: '5 h',
    weather: null,
    overnight: 'Refuge de Bellachat',
  },
  {
    id: 'd2',
    dayNumber: 2,
    label: 'JOUR 2 · 27 sept.',
    from: 'Refuge de Bellachat',
    to: 'Col de la Seigne',
    note: null,
    distanceKm: 14.2,
    elevationM: 700,
    durationText: '6 h',
    weather: null,
    overnight: 'Refuge des Mottets',
  },
  {
    id: 'd3',
    dayNumber: 3,
    label: 'JOUR 3 · 28 sept.',
    from: 'Col de la Seigne',
    to: 'Courmayeur',
    note: null,
    distanceKm: null,
    elevationM: null,
    durationText: null,
    weather: null,
    overnight: null,
  },
];

const TRACE = {
  type: 'LineString',
  coordinates: [
    [6.86, 45.83],
    [6.87, 45.84],
    [6.88, 45.85],
  ],
};

const RICH = detail({
  days: DAYS,
  trace: TRACE,
  moments: [
    { id: 'm1', dayNumber: 1, time: '18:30', caption: 'Bivouac au col', authorName: null, place: 'Col', imageUrl: null },
  ],
});

describe('CarnetStatsPane — sous-drawer statistiques', () => {
  it('expose les trois sous-onglets dans l’ordre Distance, Dénivelé, Jours', () => {
    render(<CarnetStatsPane detail={RICH} tab="distance" onTabChange={() => {}} />);
    const group = screen.getByRole('group', { name: 'Statistiques du carnet' });
    const labels = Array.from(group.querySelectorAll('button')).map((button) => button.textContent);
    expect(labels).toEqual(['Distance', 'Dénivelé', 'Jours']);
    expect(screen.getByRole('button', { name: 'Distance' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Jours' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('remonte le sous-onglet choisi', () => {
    const onTabChange = vi.fn();
    render(<CarnetStatsPane detail={RICH} tab="distance" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dénivelé' }));
    expect(onTabChange).toHaveBeenCalledWith('elevation');
    fireEvent.click(screen.getByRole('button', { name: 'Jours' }));
    expect(onTabChange).toHaveBeenLastCalledWith('days');
  });

  it('distance : totales, étapes, moyenne, D+/km, départ, arrivée, trace', () => {
    const { container } = render(<CarnetStatsPane detail={RICH} tab="distance" onTabChange={() => {}} />);
    const panel = screen.getByRole('tabpanel', { name: 'Distance' });
    /* Chiffre 34/700 et unité 13/500 : deux nœuds, une seule ligne. */
    expect(panel.querySelector('.ckp-stat-hero b')?.textContent).toBe('106,4');
    expect(panel.querySelector('.ckp-stat-hero .ckp-stat-unit')?.textContent).toBe('km');
    expect(panel.querySelector('.ckp-stat-context')?.textContent).toBe('distance totale');
    expect(panel.textContent).toContain('3 étapes');
    expect(panel.textContent).toContain('35,5 km');
    expect(panel.textContent).toContain('19 m/km');
    expect(panel.textContent).toContain('Les Houches');
    expect(panel.textContent).toContain('Courmayeur');
    expect(panel.textContent).toMatch(/3 points/);
    /* Distance par jour : seulement les jours réellement renseignés. */
    const rows = container.querySelectorAll('.ckp-stat-block .ckp-stat-row');
    expect(Array.from(rows).map((row) => row.textContent)).toEqual([
      'JOUR 1 · 26 sept.12,4 km',
      'JOUR 2 · 27 sept.14,2 km',
    ]);
  });

  it('distance : aucune donnée inventée quand tout manque', () => {
    const bare = detail({ days: [], trace: null, distanceKm: null, elevationM: null });
    const { container } = render(<CarnetStatsPane detail={bare} tab="distance" onTabChange={() => {}} />);
    const panel = screen.getByRole('tabpanel', { name: 'Distance' });
    expect(panel.querySelector('.ckp-stat-hero b')?.textContent).toBe('—');
    expect(panel.textContent).toContain('0 étape');
    expect(panel.textContent).toContain('Trace GPS—');
    expect(panel.textContent).toContain('Distances par étape non renseignées.');
    expect(container.querySelector('.ckp-stat-block')).toBeNull();
  });

  it('dénivelé : cumul, moyenne, maximum et liste par jour', () => {
    const { container } = render(<CarnetStatsPane detail={RICH} tab="elevation" onTabChange={() => {}} />);
    const panel = screen.getByRole('tabpanel', { name: 'Dénivelé' });
    expect(panel.querySelector('.ckp-stat-hero b')?.textContent).toMatch(/^2.002$/);
    expect(panel.querySelector('.ckp-stat-hero .ckp-stat-unit')?.textContent).toBe('m');
    expect(panel.textContent).toMatch(/875 m D\+/);
    expect(panel.textContent).toMatch(/1.050 m D\+ · JOUR 1/);
    expect(panel.textContent).toContain('19 m/km');
    const rows = container.querySelectorAll('.ckp-stat-block .ckp-stat-row');
    expect(Array.from(rows).map((row) => row.textContent)).toEqual([
      'JOUR 1 · 26 sept.1\u202f050 m D+',
      'JOUR 2 · 27 sept.700 m D+',
    ]);
  });

  it('dénivelé : état vide honnête sans valeur', () => {
    const bare = detail({ days: [], elevationM: null, distanceKm: null });
    render(<CarnetStatsPane detail={bare} tab="elevation" onTabChange={() => {}} />);
    expect(screen.getByText('Dénivelé non renseigné.')).toBeTruthy();
  });

  it('jours : numéro, date, trajet, distance, dénivelé, hébergement et moments', () => {
    const { container } = render(<CarnetStatsPane detail={RICH} tab="days" onTabChange={() => {}} />);
    const panel = screen.getByRole('tabpanel', { name: 'Jours' });
    expect(panel.querySelector('.ckp-stat-hero b')?.textContent).toBe('3');
    expect(panel.querySelector('.ckp-stat-hero .ckp-stat-unit')?.textContent).toBe('jours');
    expect(panel.textContent).toContain('JOUR 1 · 26 sept.');
    expect(panel.textContent).toContain('Les Houches → Refuge de Bellachat');
    expect(panel.textContent).toContain('12,4 km');
    expect(panel.textContent).toMatch(/1.050 m D\+/);
    expect(panel.textContent).toContain('Nuit · Refuge de Bellachat');
    expect(panel.textContent).toContain('18:30 · Col');
    expect(panel.textContent).toContain('Bivouac au col');
    expect(container.querySelectorAll('.ckp-day')).toHaveLength(3);
    expect(panel.querySelectorAll('.ckp-moment-list li')).toHaveLength(1);
  });

  it('répartition : trois segments réels sous le chiffre, aucun sans donnée', () => {
    const { container } = render(<CarnetStatsPane detail={RICH} tab="distance" onTabChange={() => {}} />);
    const segments = [...container.querySelectorAll('.ckp-split i')];
    expect(segments).toHaveLength(3);
    expect(segments.map((segment) => (segment as HTMLElement).style.opacity)).toEqual(['1', '0.7', '0.45']);
    const bare = render(
      <CarnetStatsPane
        detail={detail({ days: [], trace: null, distanceKm: null, elevationM: null })}
        tab="distance"
        onTabChange={() => {}}
      />,
    );
    expect(bare.container.querySelector('.ckp-split')).toBeNull();
  });

  it('dénivelé : aire de 72 px, point culminant, trois repères, barres sans chiffres', () => {
    const { container } = render(<CarnetStatsPane detail={RICH} tab="elevation" onTabChange={() => {}} />);
    const svg = container.querySelector('.ckp-elev svg') as SVGElement;
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('viewBox')).toBe('0 0 374 72');
    /* Aire + trait, aucun axe ni quadrillage. */
    expect(container.querySelectorAll('.ckp-elev svg path')).toHaveLength(2);
    expect(container.querySelector('.ckp-elev svg path[fill="rgba(23,64,44,.12)"]')).toBeTruthy();
    expect(container.querySelectorAll('.ckp-elev-axis span')).toHaveLength(3);
    expect(container.querySelector('.ckp-elev-summit b')?.textContent).toMatch(/^1.050 m$/);
    const bars = [...container.querySelectorAll('.ckp-elev-bars i')];
    expect(bars).toHaveLength(3);
    /* 3 jours, dont un sans distance : sa barre garde sa place, sans se peindre. */
    expect(bars.filter((bar) => bar.getAttribute('data-empty') === 'true')).toHaveLength(1);
  });

  it('jours : ligne de 56 px, pastille 22, deux colonnes de chiffres', () => {
    const { container } = render(<CarnetStatsPane detail={RICH} tab="days" onTabChange={() => {}} />);
    const head = container.querySelector('.ckp-day .ckp-day-head') as HTMLElement;
    expect(head).toBeTruthy();
    const nums = [...container.querySelectorAll('.ckp-day .ckp-day-nums b')].map((n) => n.textContent);
    expect(nums.slice(0, 4)).toEqual(['12,4 km', '1 050 m D+', '14,2 km', '700 m D+']);
    expect(container.querySelectorAll('.ckp-day .ckp-day-badge')).toHaveLength(3);
  });

  it('jours : état vide honnête sans étape', () => {
    render(<CarnetStatsPane detail={detail({ days: [] })} tab="days" onTabChange={() => {}} />);
    expect(screen.getByText('Aucun jour renseigné.')).toBeTruthy();
  });
});
