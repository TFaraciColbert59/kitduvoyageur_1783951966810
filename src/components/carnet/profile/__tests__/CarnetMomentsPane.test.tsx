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
  caption: 'Dîner face au couchant',
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

function withDays() {
  return detail({
    days: [DAY_ONE, DAY_TWO],
    moments: [M1, M2, M3, M4, M5],
  });
}

/** Une carte par moment : heure, lieu et légende, dans l'ordre du DOM. */
const cards = (container: HTMLElement) =>
  [...container.querySelectorAll('.ckp-moment-card')].map((card) => [
    card.querySelector('.ckp-moment-time')?.textContent,
    card.querySelector('.ckp-moment-place')?.textContent,
    card.querySelector('.ckp-moment-caption')?.textContent ?? null,
  ]);

describe('CarnetMomentsPane — cartes de moment', () => {
  it('peint une carte par moment, groupée par jour quand plusieurs jours se suivent', () => {
    const { container } = render(<CarnetMomentsPane detail={withDays()} day={null} />);
    const sections = [...container.querySelectorAll('.ckp-moment-day')];
    expect(sections).toHaveLength(2);
    /* Le repère du jour vit dans sa propre pastille, jamais à même le verre. */
    const pills = [...container.querySelectorAll('.ckp-moment-daypill')].map((pill) => pill.textContent);
    expect(pills).toEqual(['J126 sept.1 moment', 'J227 sept.4 moments']);
    expect(sections[0].querySelectorAll('.ckp-moment-card')).toHaveLength(1);
    expect(sections[1].querySelectorAll('.ckp-moment-card')).toHaveLength(4);
    expect(cards(container)).toEqual([
      ['07:40', 'Corrençon-en-Vercors', 'Lever de soleil'],
      ['—', '—', null],
      ['19:05', 'Refuge de Bellachat', 'Dîner face au couchant'],
      ['20:15', 'Refuge de Bellachat', 'Dîner face au couchant'],
      ['21:30', 'Refuge de Bellachat', 'Dîner face au couchant'],
    ]);
  });

  it('ne garde que les moments du jour affiché, sans repère de jour', () => {
    const { container } = render(<CarnetMomentsPane detail={withDays()} day={DAY_TWO} />);
    expect(container.querySelectorAll('.ckp-moment-daypill')).toHaveLength(0);
    expect(container.querySelectorAll('.ckp-moment-card')).toHaveLength(2);
    expect(cards(container)).toEqual([
      ['—', '—', null],
      ['19:05', 'Refuge de Bellachat', 'Dîner face au couchant'],
    ]);
  });

  it('met l’heure en pastille, le lieu sur un voile et la légende dans la carte', () => {
    const { container } = render(<CarnetMomentsPane detail={withDays()} day={null} />);
    const card = container.querySelector('.ckp-moment-card') as HTMLElement;
    const photo = card.querySelector('.ckp-moment-photo') as HTMLElement;
    /* Photo 4:3, rayon 14 porté par la carte. */
    expect(photo).toBeTruthy();
    expect(card.querySelector('.ckp-moment-photo img')?.getAttribute('src')).toBe('https://cdn.test/1.jpg');
    /* L'heure et le lieu sont dans la photo ; la légende est sous elle. */
    expect(photo.querySelector('.ckp-moment-time')?.textContent).toBe('07:40');
    expect(photo.querySelector('.ckp-moment-place')?.textContent).toBe('Corrençon-en-Vercors');
    expect(card.querySelector('figcaption.ckp-moment-caption')?.textContent).toBe('Lever de soleil');
    /* Aucun texte nu : la ligne de champ héritée de la liste a disparu. */
    expect(container.querySelector('.ckp-field')).toBeNull();
  });

  it('écrit un tiret pour une heure ou un lieu absent, en teinte de tiret', () => {
    const { container } = render(<CarnetMomentsPane detail={withDays()} day={DAY_TWO} />);
    const [first] = [...container.querySelectorAll('.ckp-moment-card')];
    expect(first.querySelector('.ckp-moment-time')?.textContent).toBe('—');
    const place = first.querySelector('.ckp-moment-place') as HTMLElement;
    expect(place.textContent).toBe('—');
    expect(place.getAttribute('data-missing')).toBe('true');
    /* Le lieu absent n'emprunte pas l'encre d'un lieu réel. */
    const [, second] = [...container.querySelectorAll('.ckp-moment-card')];
    expect(second.querySelector('.ckp-moment-place')?.getAttribute('data-missing')).toBeNull();
  });

  it('garde la carte d’un moment sans photo : glyphe et lieu dans la surface', () => {
    const { container } = render(<CarnetMomentsPane detail={withDays()} day={DAY_TWO} />);
    const [, second] = [...container.querySelectorAll('.ckp-moment-card')];
    expect(second.getAttribute('data-nophoto')).toBe('true');
    expect(second.querySelector('.ckp-moment-glyph')).toBeTruthy();
    expect(second.querySelector('.ckp-moment-photo img')).toBeNull();
    /* La grille ne se décale pas : la carte garde sa surface 4:3. */
    expect(second.querySelector('.ckp-moment-photo')).toBeTruthy();
  });

  it('sans aucun moment : un glyphe et un tiret, aucun texte, aucune carte', () => {
    const { container } = render(<CarnetMomentsPane detail={detail({ moments: [] })} day={null} />);
    const empty = container.querySelector('.ckp-empty-state');
    expect(empty).toBeTruthy();
    expect(empty?.querySelector('.ckp-empty-glyph > span')).toBeTruthy();
    expect(empty?.querySelector('.ckp-empty-dash')?.textContent).toBe('—');
    expect(empty?.textContent).toBe('—');
    expect(container.querySelectorAll('.ckp-moment-card')).toHaveLength(0);
  });

  it('ne réinvente aucune donnée : heure, lieu et légende sont ceux du moment', () => {
    const { container } = render(<CarnetMomentsPane detail={withDays()} day={DAY_ONE} />);
    expect(cards(container)).toEqual([['07:40', 'Corrençon-en-Vercors', 'Lever de soleil']]);
    expect(container.querySelector('.ckp-pane-moments')).toBeTruthy();
    /* Aucune liste héritée de la carte sous la grille. */
    expect(container.querySelector('.ckp-dayinfo-moments')).toBeNull();
    expect(container.querySelector('.ckp-dayinfo-moment')).toBeNull();
  });
});
