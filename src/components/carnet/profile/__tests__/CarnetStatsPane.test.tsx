// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetStatsPane } from '../panes/CarnetStatsPane';
import type { CarnetDay, CarnetEtapeDay } from '@/features/carnet/detail/types';
import { detail } from './fixtures';

afterEach(() => cleanup());

const DAYS: CarnetEtapeDay[] = [
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
  etapes: DAYS,
  trace: TRACE,
  moments: [
    { id: 'm1', dayNumber: 1, time: '18:30', caption: 'Bivouac au col', authorName: null, place: 'Col', imageUrl: null },
  ],
});

const labels = (root: ParentNode) =>
  [...root.querySelectorAll('.ckp-field-label')].map((node) => node.textContent);
const values = (root: ParentNode) =>
  [...root.querySelectorAll('.ckp-field-value')].map((node) => node.textContent);

describe('CarnetStatsPane — sous-drawer statistiques', () => {
  it('expose les trois sous-onglets en icônes seules, nommés par aria-label', () => {
    render(<CarnetStatsPane detail={RICH} tab="distance" onTabChange={() => {}} />);
    const group = screen.getByRole('group', { name: 'Statistiques du carnet' });
    const buttons = Array.from(group.querySelectorAll('button'));
    /* 31/32 : aucune étiquette texte, trois icônes, 3 × 41,5 + 5 de large. */
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Distance',
      'Dénivelé',
      'Jours',
    ]);
    expect(buttons.every((button) => button.textContent === '')).toBe(true);
    expect(buttons.every((button) => button.querySelector('span'))).toBe(true);
    expect(group.className).toContain('ckp-sub--icons');
    expect(group.querySelector(':scope > .ckp-th')).toBeTruthy();
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

  it('distance : chiffre 40/700, unité accolée, barre, trois sous-valeurs', () => {
    const { container } = render(<CarnetStatsPane detail={RICH} tab="distance" onTabChange={() => {}} />);
    const panel = screen.getByRole('tabpanel', { name: 'Distance' });
    expect(panel.querySelector('.ckp-hero-value')?.textContent).toBe('106,4');
    expect(panel.querySelector('.ckp-hero-unit')?.textContent).toBe('km');
    /* 14 : plus aucun libellé « distance totale ». */
    expect(container.textContent).not.toMatch(/distance totale/i);
    /* 13 : trois sous-valeurs, sans libellé long. */
    const sub = [...panel.querySelectorAll('.ckp-hero-sub span')].map((node) => node.textContent);
    expect(sub).toEqual(['3 étapes', '35,5 km/j', '19 m/km']);
    /* 12 : la barre est une piste avec sa part documentée (2 jours sur 3). */
    expect(panel.querySelector('.ckp-hero-bar')).toBeTruthy();
    expect((panel.querySelector('.ckp-hero-bar i') as HTMLElement).style.width).toBe('66.7%');
  });

  it('distance : lieu, départ, arrivée, allure, cumul, trace, puis les jours', () => {
    const { container } = render(<CarnetStatsPane detail={RICH} tab="distance" onTabChange={() => {}} />);
    const panel = screen.getByRole('tabpanel', { name: 'Distance' });
    const groups = [...panel.querySelectorAll('.ckp-group')];
    /* 20 : trois lignes au plus par groupe. */
    expect(groups.every((group) => group.querySelectorAll('.ckp-field').length <= 3)).toBe(true);
    /* Le lieu et les deux extrémités : les informations retirées de la carte. */
    expect(labels(groups[0])).toEqual(['lieu', 'départ', 'arrivée']);
    expect(values(groups[0])).toEqual(['France / Italie / Suisse', 'Les Houches', 'Courmayeur']);
    expect(groups[0].querySelectorAll('.ckp-field-icon > span')).toHaveLength(3);
    /* Allure et cumul n'existent pas sur le Résumé : tiret, jamais un zéro. */
    expect(labels(groups[1])).toEqual(['allure', 'depuis le départ', 'trace gps']);
    expect(values(groups[1])[0]).toBe('—');
    expect(values(groups[1])[1]).toBe('106,4 km');
    expect(values(groups[1])[2]).toMatch(/^3 pts/);
    expect(groups[1].querySelectorAll('.ckp-field-icon > span')).toHaveLength(1);
    expect(labels(groups[2])).toEqual(['JOUR 1 · 26 sept.', 'JOUR 2 · 27 sept.']);
    expect(values(groups[2])).toEqual(['12,4 km', '14,2 km']);
    /* 22 : aucun chevron dans ces lignes. */
    expect(panel.querySelector('.ckp-field .chevron-right')).toBeNull();
    expect(container.querySelectorAll('.ckp-group')).toHaveLength(3);
  });

  it('distance : aucune donnée inventée quand tout manque', () => {
    const bare = detail({
      etapes: [],
      trace: null,
      distanceKm: null,
      elevationM: null,
      destination: null,
      place: { country: null, region: null, locality: null, lat: null, lng: null },
      summary: { distanceKm: null, elevationM: null, days: 0, moments: 0 },
    });
    const { container } = render(<CarnetStatsPane detail={bare} tab="distance" onTabChange={() => {}} />);
    const panel = screen.getByRole('tabpanel', { name: 'Distance' });
    /* Sans donnée, le héros est une ligne : le tiret seul, pas d'unité, pas de
       piste de barre (une progression à 0 % traverserait toute la largeur). */
    expect(panel.querySelector('.ckp-hero-value')?.textContent).toBe('—');
    expect(panel.querySelector('.ckp-hero-num')?.getAttribute('data-missing')).toBe('true');
    expect(panel.querySelector('.ckp-hero--empty')).toBeTruthy();
    expect(panel.querySelector('.ckp-hero-glyph')).toBeTruthy();
    expect(panel.querySelector('.ckp-hero-unit')).toBeNull();
    expect(panel.querySelector('.ckp-hero-bar')).toBeNull();
    expect(panel.querySelector('.ckp-hero-sub')).toBeNull();
    /* 18 : chaque ligne sans donnée est un tiret, jamais un vide. */
    expect(values(panel).every((value) => value === '—')).toBe(true);
    expect(screen.getByText('distance par jour')).toBeTruthy();
    expect(container.querySelector('.ckp-pane-empty')).toBeNull();
  });

  it('dénivelé : cumul, moyenne, maximum daté, jours documentés', () => {
    const { container } = render(<CarnetStatsPane detail={RICH} tab="elevation" onTabChange={() => {}} />);
    const panel = screen.getByRole('tabpanel', { name: 'Dénivelé' });
    expect(panel.querySelector('.ckp-hero-value')?.textContent).toMatch(/^2.002$/);
    expect(panel.querySelector('.ckp-hero-unit')?.textContent).toBe('m');
    const sub = [...panel.querySelectorAll('.ckp-hero-sub span')].map((node) => node.textContent);
    expect(sub[0]).toMatch(/^875 m D\+$/);
    expect(sub[1]).toMatch(/^1.050 m · JOUR 1/);
    expect(sub[2]).toBe('2 / 3 jours');
    const groups = [...panel.querySelectorAll('.ckp-group')];
    /* Le D+ du jour affiché passe ici : sur le Résumé, le héros porte le total. */
    expect(labels(groups[0])).toEqual(['dénivelé du jour', 'dénivelé par km', 'jours sans dénivelé']);
    expect(values(groups[0])).toEqual(['—', '19 m/km', '1']);
    expect(labels(groups[1])).toEqual(['JOUR 1 · 26 sept.', 'JOUR 2 · 27 sept.']);
    expect(values(groups[1])).toEqual(['1\u202f050 m D+', '700 m D+']);
  });

  it('dénivelé : état vide honnête, sans phrase', () => {
    const { container } = render(
      <CarnetStatsPane
        detail={detail({ etapes: [], elevationM: null, distanceKm: null })}
        tab="elevation"
        onTabChange={() => {}}
      />,
    );
    const panel = screen.getByRole('tabpanel', { name: 'Dénivelé' });
    expect(panel.querySelector('.ckp-hero-value')?.textContent).toBe('—');
    expect(values(panel).every((value) => value === '—' || value === '0')).toBe(true);
    expect(container.textContent).not.toMatch(/renseigné/i);
    /* Aucune aire sans donnée réelle. */
    expect(container.querySelector('.ckp-elev')).toBeNull();
  });

  it('jours : numéro, date, trajet, distance, dénivelé, hébergement et moments', () => {
    const { container } = render(<CarnetStatsPane detail={RICH} tab="days" onTabChange={() => {}} />);
    const panel = screen.getByRole('tabpanel', { name: 'Jours' });
    expect(panel.querySelector('.ckp-hero-value')?.textContent).toBe('3');
    expect(panel.querySelector('.ckp-hero-unit')?.textContent).toBe('jours');
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

  it('distance : porte le départ, l’arrivée, l’allure et le cumul du jour affiché', () => {
    const day: CarnetDay = {
      index: 2,
      date: '2026-09-27',
      distanceKm: 14.2,
      elevationM: 700,
      durationS: 21600,
      moments: [],
      points: [],
    };
    render(
      <CarnetStatsPane
        detail={detail({
          etapes: DAYS,
          days: [
            { index: 1, date: '2026-09-26', distanceKm: 12.4, elevationM: 1050, durationS: 18000, moments: [], points: [] },
            day,
          ],
        })}
        tab="distance"
        day={day}
        onTabChange={() => {}}
      />,
    );
    const panel = screen.getByRole('tabpanel', { name: 'Distance' });
    /* Le jour ne garde que ses lignes : ni lieu, ni trace, ni liste des jours. */
    expect(labels(panel)).toEqual(['départ', 'arrivée', 'allure', 'depuis le départ']);
    /* Départ et arrivée viennent de l'étape déclarée du jour 2. */
    expect(values(panel)).toEqual(['Refuge de Bellachat', 'Col de la Seigne', '25,4 min/km', '26,6 km']);
    /* Le chiffre héros est celui du jour, jamais le total du carnet. */
    expect(panel.querySelector('.ckp-hero-value')?.textContent).toBe('14,2');
    expect(panel.querySelector('.ckp-hero-unit')?.textContent).toBe('km');
    expect([...panel.querySelectorAll('.ckp-hero-sub span')].map((node) => node.textContent)).toEqual([
      'J2',
      '27 sept.',
      '6 h',
    ]);
    expect(panel.textContent).not.toContain('106,4');
    expect(panel.textContent).not.toMatch(/trace gps/i);
    expect(panel.querySelectorAll('.ckp-group')).toHaveLength(2);
  });

  it('distance : une valeur absente du jour reste un tiret, sans repli sur le carnet', () => {
    const day: CarnetDay = {
      index: 4,
      date: null,
      distanceKm: null,
      elevationM: null,
      durationS: null,
      moments: [],
      points: [],
    };
    render(
      <CarnetStatsPane detail={detail({ etapes: DAYS, days: [day] })} tab="distance" day={day} onTabChange={() => {}} />,
    );
    const panel = screen.getByRole('tabpanel', { name: 'Distance' });
    /* 106,4 km et 2 002 m vivent sur le Résumé : jamais en repli d'un jour. */
    expect(panel.querySelector('.ckp-hero-value')?.textContent).toBe('—');
    expect(panel.querySelector('.ckp-hero-num')?.getAttribute('data-missing')).toBe('true');
    /* Même gabarit que le Résumé sans donnée : ni piste de barre, ni
       sous-valeur — J4 vit dans la capsule, la date et la durée dans l'en-tête
       de la carte, donc le héros vide ne les répète pas. */
    expect(panel.querySelector('.ckp-hero-bar')).toBeNull();
    expect(panel.querySelector('.ckp-hero-sub')).toBeNull();
    expect(values(panel)).toEqual(['—', '—', '—', '—']);
    expect(panel.textContent).not.toContain('106,4');
  });

  it('dénivelé : le D+ du jour affiché, lu sur les sorties', () => {
    const day: CarnetDay = {
      index: 2,
      date: '2026-09-27',
      distanceKm: 14.2,
      elevationM: 700,
      durationS: 21600,
      moments: [],
      points: [
        { lat: 45.83, lng: 6.86, at: '2026-09-27T08:00:00Z' },
        { lat: 45.84, lng: 6.87, at: '2026-09-27T09:00:00Z' },
      ],
    };
    render(
      <CarnetStatsPane
        detail={detail({ etapes: DAYS, distanceKm: 106.4, elevationM: 2002, trace: TRACE })}
        tab="elevation"
        day={day}
        onTabChange={() => {}}
      />,
    );
    const panel = screen.getByRole('tabpanel', { name: 'Dénivelé' });
    /* Chiffre héros : le D+ du jour, pas les 2 002 m du carnet. */
    expect(panel.querySelector('.ckp-hero-value')?.textContent).toBe('700');
    expect(panel.querySelector('.ckp-hero-unit')?.textContent).toBe('m');
    expect(labels(panel)).toEqual(['distance du jour', 'points gps']);
    expect(values(panel)).toEqual(['14,2 km', '2 pts']);
    /* Ni profil agrégé, ni moyenne, ni liste des jours. */
    expect(panel.querySelector('.ckp-elev')).toBeNull();
    expect(panel.textContent).not.toMatch(/dénivelé par km|jours sans dénivelé/i);
    expect(panel.querySelectorAll('.ckp-group')).toHaveLength(1);
  });

  it('dénivelé : le jour sans point GPS écrit un tiret, pas le compte du carnet', () => {
    const day: CarnetDay = {
      index: 1,
      date: '2026-09-26',
      distanceKm: null,
      elevationM: null,
      durationS: null,
      moments: [],
      points: [],
    };
    render(<CarnetStatsPane detail={detail({ trace: TRACE })} tab="elevation" day={day} onTabChange={() => {}} />);
    const panel = screen.getByRole('tabpanel', { name: 'Dénivelé' });
    expect(panel.querySelector('.ckp-hero-value')?.textContent).toBe('—');
    expect(values(panel)).toEqual(['—', '—']);
    expect(panel.textContent).not.toContain('2\u202f002');
  });

  it('jours : numéro et date du jour seuls, récit global affiché une fois', () => {
    const day: CarnetDay = {
      index: 2,
      date: '2026-09-27',
      distanceKm: 14.2,
      elevationM: 700,
      durationS: 21600,
      moments: [],
      points: [],
    };
    render(<CarnetStatsPane detail={RICH} tab="days" day={day} onTabChange={() => {}} />);
    const panel = screen.getByRole('tabpanel', { name: 'Jours' });
    /* Plus de plage de dates : la date du jour seule. */
    expect(labels(panel)).toEqual(['jour', 'date']);
    expect(values(panel)).toEqual(['2', '27 sept.']);
    expect(panel.textContent).not.toContain('26 sept. – 2 oct. 2026');
    expect(panel.querySelector('.ckp-hero-value')?.textContent).toBe('2');
    expect(panel.querySelector('.ckp-hero-unit')?.textContent).toBe('jour');
    /* Le récit du carnet : une seule occurrence, ici. */
    expect(panel.querySelectorAll('.ckp-story')).toHaveLength(1);
    expect(panel.querySelector('.ckp-story')?.textContent).toBe('Dix jours, trois pays, deux bivouacs.');
    /* Aucune liste agrégée des jours dans le volet d'un jour. */
    expect(panel.querySelector('.ckp-daylist')).toBeNull();
  });

  it('jours : le récit du jour remplace le récit global', () => {
    const day: CarnetDay = {
      index: 1,
      date: '2026-09-26',
      distanceKm: 12.4,
      elevationM: 1050,
      durationS: 18000,
      moments: [],
      points: [],
    };
    render(
      <CarnetStatsPane
        detail={detail({
          etapes: DAYS.map((etape) =>
            etape.dayNumber === 1 ? { ...etape, note: 'Montée dans le brouillard.' } : etape,
          ),
          days: [day],
        })}
        tab="days"
        day={day}
        onTabChange={() => {}}
      />,
    );
    const panel = screen.getByRole('tabpanel', { name: 'Jours' });
    expect(panel.querySelectorAll('.ckp-story')).toHaveLength(1);
    expect(panel.querySelector('.ckp-story')?.textContent).toBe('Montée dans le brouillard.');
  });

  it('résumé : les drawers gardent les totaux du carnet', () => {
    const { container } = render(<CarnetStatsPane detail={RICH} tab="days" onTabChange={() => {}} />);
    const panel = screen.getByRole('tabpanel', { name: 'Jours' });
    expect(panel.querySelector('.ckp-hero-value')?.textContent).toBe('3');
    expect(labels(panel)).toEqual(['jour', 'date', 'dates']);
    /* Le Résumé garde ses agrégats : jours du carnet et plage de dates. */
    expect(values(panel)).toEqual(['7', '—', '26 sept. – 2 oct. 2026']);
    /* La liste complète des jours reste au Résumé. */
    expect(container.querySelectorAll('.ckp-day')).toHaveLength(3);
  });

  it('répartition : la part documentée pilote la barre, jamais une courbe sans donnée', () => {
    const { container } = render(<CarnetStatsPane detail={RICH} tab="distance" onTabChange={() => {}} />);
    expect(container.querySelectorAll('.ckp-hero-bar i')).toHaveLength(1);
    const full = render(<CarnetStatsPane detail={RICH} tab="days" onTabChange={() => {}} />);
    expect((full.container.querySelector('.ckp-hero-bar i') as HTMLElement).style.width).toBe('100%');
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
    expect(nums.slice(0, 4)).toEqual(['12,4 km', '1\u202f050 m D+', '14,2 km', '700 m D+']);
    expect(container.querySelectorAll('.ckp-day .ckp-day-badge')).toHaveLength(3);
  });

  it('jours : état vide honnête sans étape, aucune phrase', () => {
    const { container } = render(
      <CarnetStatsPane
        detail={detail({
          etapes: [],
          days: [],
          dateRange: null,
          description: null,
          summary: { distanceKm: null, elevationM: null, days: 0, moments: 0 },
        })}
        tab="days"
        onTabChange={() => {}}
      />,
    );
    const panel = screen.getByRole('tabpanel', { name: 'Jours' });
    /* Numéro, date et plage : les informations de la carte, ici en tirets. */
    expect([...panel.querySelectorAll('.ckp-field-label')].map((node) => node.textContent)).toEqual([
      'jour',
      'date',
      'dates',
    ]);
    expect(container.textContent).not.toMatch(/Aucun jour renseigné/);
    expect(values(container).every((value) => value === '—')).toBe(true);
    expect(container.querySelector('.ckp-story')).toBeNull();
  });

  it('le rouleau ne joue qu’une fois, à l’ouverture du volet', () => {
    const { container, rerender } = render(<CarnetStatsPane detail={RICH} tab="distance" onTabChange={() => {}} />);
    expect(container.querySelector('.ckp-roll')?.className).toContain('is-rolling');
    rerender(<CarnetStatsPane detail={RICH} tab="days" onTabChange={() => {}} />);
    /* Le changement de sous-onglet garde le fondu de 180 ms, pas le rouleau. */
    expect(container.querySelector('.ckp-roll')?.className).not.toContain('is-rolling');
    expect(container.querySelector('.ckp-hero')?.getAttribute('data-animate')).toBe('true');
  });
});
