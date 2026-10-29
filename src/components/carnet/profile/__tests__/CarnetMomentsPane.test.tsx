// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CarnetMomentsPane } from '../panes/CarnetMomentsPane';
import { detail } from './fixtures';
import type { CarnetDay, CarnetMomentItem } from '@/features/carnet/detail/types';

afterEach(() => cleanup());

const M1: CarnetMomentItem = {
  id: 'm1',
  dayNumber: 1,
  time: '07:40',
  caption: 'Lever de soleil',
  place: 'Corrençon-en-Vercors',
  imageUrl: 'https://cdn.test/1.jpg',
};
const M2: CarnetMomentItem = {
  id: 'm2',
  dayNumber: 2,
  time: null,
  caption: null,
  place: null,
  imageUrl: 'https://cdn.test/2.jpg',
};
const M3: CarnetMomentItem = {
  id: 'm3',
  dayNumber: 2,
  time: '19:05',
  caption: null,
  place: 'Refuge de Bellachat',
  imageUrl: null,
};
const M4: CarnetMomentItem = { ...M3, id: 'm4', time: '20:15' };
const M5: CarnetMomentItem = { ...M3, id: 'm5', time: '21:30' };

const DAY_ONE: CarnetDay = {
  index: 1,
  date: '2026-09-26',
  distanceKm: 18.4,
  elevationM: 620,
  durationS: 21600,
  moments: [M1],
  points: [],
};
const DAY_TWO: CarnetDay = {
  index: 2,
  date: '2026-09-27',
  distanceKm: 12,
  elevationM: 300,
  durationS: null,
  moments: [M2, M3],
  points: [],
};
const DAY_THREE: CarnetDay = {
  index: 3,
  date: '2026-09-28',
  distanceKm: null,
  elevationM: null,
  durationS: null,
  moments: [],
  points: [],
};

function withDays() {
  return detail({
    days: [DAY_ONE, DAY_TWO, DAY_THREE],
    moments: [M1, M2, M3, M4, M5],
  });
}

const rows = (container: HTMLElement) =>
  [...container.querySelectorAll('.ckp-field')].map((row) => [
    row.querySelector('.ckp-field-label')?.textContent,
    row.querySelector('.ckp-field-value')?.textContent,
  ]);

describe('CarnetMomentsPane — liste des moments dans le drawer', () => {
  it('liste les moments du Résumé avec leur jour, leur heure et leur lieu', () => {
    const { container } = render(<CarnetMomentsPane detail={withDays()} day={null} />);
    expect(rows(container)).toEqual([
      ['J1 · 07:40', 'Corrençon-en-Vercors'],
      ['J2 · —', '—'],
      ['J2 · 19:05', 'Refuge de Bellachat'],
      ['J2 · 20:15', 'Refuge de Bellachat'],
      ['J2 · 21:30', 'Refuge de Bellachat'],
    ]);
  });

  it('ne montre que les moments du jour quand un jour est affiché, sans préfixe', () => {
    const { container } = render(<CarnetMomentsPane detail={withDays()} day={DAY_TWO} />);
    expect(rows(container)).toEqual([
      ['—', '—'],
      ['19:05', 'Refuge de Bellachat'],
    ]);
  });

  it('écrit un tiret pour une heure ou un lieu absent, sans le peindre comme une donnée', () => {
    const { container } = render(<CarnetMomentsPane detail={withDays()} day={DAY_TWO} />);
    const [first] = [...container.querySelectorAll('.ckp-field')];
    expect(first.querySelector('.ckp-field-label')?.textContent).toBe('—');
    /* Le lieu absent prend `is-missing` : la valeur garde sa colonne et sa
       teinte de tiret, elle n'emprunte pas l'encre d'un lieu réel. */
    expect(first.classList.contains('is-missing')).toBe(true);
    expect(first.querySelector('.ckp-field-value')?.textContent).toBe('—');
    const [, second] = [...container.querySelectorAll('.ckp-field')];
    expect(second.classList.contains('is-missing')).toBe(false);
  });

  it('peint la ligne de liste du système : 48 px, valeur à droite, ellipse au milieu', () => {
    const { container } = render(<CarnetMomentsPane detail={withDays()} day={null} />);
    const field = container.querySelector('.ckp-field') as HTMLElement;
    expect(field).toBeTruthy();
    expect(field.className).toContain('ckp-field--wide');
    expect(field.className).toContain('ckp-field--mid');
    /* Aucune liste compacte héritée de la carte sous la grille. */
    expect(container.querySelector('.ckp-dayinfo-moments')).toBeNull();
    expect(container.querySelector('.ckp-dayinfo-moment')).toBeNull();
  });

  it('groupe les moments trois par trois, 20 px entre les groupes', () => {
    const { container } = render(<CarnetMomentsPane detail={withDays()} day={null} />);
    const groups = [...container.querySelectorAll('.ckp-group')];
    expect(groups.map((group) => group.querySelectorAll('.ckp-field').length)).toEqual([3, 2]);
    expect(container.querySelector('.ckp-pane-moments')).toBeTruthy();
  });

  it('sans aucun moment : un glyphe et un tiret, aucun texte', () => {
    const { container } = render(
      <CarnetMomentsPane detail={detail({ moments: [] })} day={null} />,
    );
    const empty = container.querySelector('.ckp-empty-state');
    expect(empty).toBeTruthy();
    expect(empty?.querySelector('.ckp-empty-glyph > span')).toBeTruthy();
    expect(empty?.querySelector('.ckp-empty-dash')?.textContent).toBe('—');
    expect(empty?.textContent).toBe('—');
    expect(container.querySelectorAll('.ckp-field')).toHaveLength(0);
  });

  it('ne réinvente aucune donnée : l’heure et le lieu viennent des moments réels', () => {
    const { container } = render(<CarnetMomentsPane detail={withDays()} day={DAY_ONE} />);
    expect(rows(container)).toEqual([['07:40', 'Corrençon-en-Vercors']]);
    /* Le titre du moment ne fuit pas dans la ligne : heure à gauche, lieu à droite. */
    expect(container.textContent).not.toContain('Lever de soleil');
  });
});
