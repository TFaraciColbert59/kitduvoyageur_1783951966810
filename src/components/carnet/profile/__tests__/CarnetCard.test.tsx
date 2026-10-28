// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetCard } from '../CarnetCard';
import { DETAIL, detail } from './fixtures';

afterEach(() => cleanup());

const noop = () => {};

/** `Intl` groupe les milliers avec une espace fine insécable : on la ramène à
    une espace ordinaire pour comparer le texte affiché. */
const norm = (value: string | null | undefined) => (value ?? '').replace(/[\u00a0\u202f]/g, ' ');

const TRACE = {
  type: 'LineString',
  coordinates: [
    [6.86, 45.83],
    [6.87, 45.84],
  ],
};

function base(overrides: Partial<React.ComponentProps<typeof CarnetCard>> = {}) {
  return {
    detail: detail({
      photoMoments: [
        { id: 'm1', dayNumber: 3, time: '18:30', caption: 'Bivouac', authorName: null, place: 'Col', imageUrl: 'https://cdn.test/1.jpg' },
        { id: 'm2', dayNumber: 4, time: null, caption: null, authorName: null, place: null, imageUrl: 'https://cdn.test/2.jpg' },
      ],
    }),
    page: 'posts' as const,
    onPageChange: noop,
    canWrite: false,
    onRequireAuth: noop,
    onOpenCarnet: noop,
    onOpenStat: noop,
    onOpenComments: noop,
    onOpenLikes: noop,
    onOpenPost: noop,
    onDownloadGpx: noop,
    ...overrides,
  };
}

describe('CarnetCard — carte du carnet', () => {
  it('ouvre le carnet au clic sur le mini tracé', () => {
    const onOpenCarnet = vi.fn();
    render(<CarnetCard {...base({ onOpenCarnet, detail: detail({ trace: TRACE }) })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le carnet' }));
    expect(onOpenCarnet).toHaveBeenCalledOnce();
  });

  it('remplace la photo de couverture par un mini tracé', () => {
    const { container } = render(<CarnetCard {...base({ detail: detail({ trace: TRACE }) })} />);
    expect(container.querySelector('.ckp-head img')).toBeNull();
    const trace = container.querySelector('.ckp-cover--trace');
    expect(trace).toBeTruthy();
    expect(trace?.querySelector('polyline')?.getAttribute('points')).toBeTruthy();
  });

  it('garde les initiales quand il n’y a pas de trace', () => {
    const { container } = render(<CarnetCard {...base({ detail: detail({ trace: null }) })} />);
    expect(container.querySelector('.ckp-cover--initial')?.textContent).toBe('F');
  });

  it('ouvre le sous-drawer statistiques sur le bon volet depuis chaque statistique', () => {
    const onOpenStat = vi.fn();
    render(<CarnetCard {...base({ onOpenStat })} />);
    fireEvent.click(screen.getByRole('button', { name: 'DISTANCE 106,4 km' }));
    expect(onOpenStat).toHaveBeenLastCalledWith('distance');
    fireEvent.click(screen.getByRole('button', { name: /^DÉNIVELÉ \+ 2\s002 m$/ }));
    expect(onOpenStat).toHaveBeenLastCalledWith('elevation');
    fireEvent.click(screen.getByRole('button', { name: 'JOURS 7' }));
    expect(onOpenStat).toHaveBeenLastCalledWith('days');
    expect(onOpenStat).toHaveBeenCalledTimes(3);
  });

  it('ne garde que la capsule des jours dans le pied', () => {
    const { container } = render(<CarnetCard {...base()} />);
    /* ♥ et 💬 ont quitté la carte : plus aucun bouton rond dans le pied. */
    expect(container.querySelector('.ckp-action')).toBeNull();
    expect(container.querySelector('.ckp-actions')).toBeNull();
    const capsule = container.querySelector('.ckp-card-foot .ckp-capsule');
    expect(capsule).toBeTruthy();
    const segments = capsule?.querySelectorAll('.ckp-tabs button') ?? [];
    /* Carnet sans jour : une seule page, le Résumé. */
    expect(segments).toHaveLength(1);
    expect([...segments].map((node) => node.getAttribute('aria-label'))).toEqual(['Résumé']);
  });

  it('ne garde plus Enregistrer dans la capsule : l’action vit dans le menu ···', () => {
    const { container } = render(<CarnetCard {...base()} />);
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
    expect(container.querySelector('.ckp-card-foot [data-icon="bookmark"]')).toBeNull();
  });

  it('ne garde ni ··· ni Gérer dans la capsule : le menu vit dans la barre du haut', () => {
    const { container } = render(<CarnetCard {...base({ detail: detail({ isOwner: true }) })} />);
    expect(container.querySelector('.ckp-more-anchor')).toBeNull();
    expect(container.querySelector('.pmi-options-menu')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Plus d’options' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gérer' })).toBeNull();
  });

  it('ne porte qu’une capsule dans le pied, sans autre bouton', () => {
    const { container } = render(<CarnetCard {...base()} />);
    const foot = container.querySelector('.ckp-card-foot');
    expect(container.querySelectorAll('.ckp-card-foot')).toHaveLength(1);
    // Conteneur simple : aucun rôle de sélecteur sur la capsule.
    expect(foot?.getAttribute('role')).toBeNull();
    expect([...(foot?.children ?? [])].map((el) => el.className)).toEqual(['ckp-capsule']);
    expect(foot?.querySelector('.ckp-capsule .ckp-th')?.getAttribute('aria-hidden')).toBe('true');
    // Le sélecteur vit dans la capsule, pas ailleurs dans la carte.
    expect(container.querySelectorAll('.ckp-card > .ckp-tabs')).toHaveLength(0);
    expect(container.querySelectorAll('.ckp-tabs')).toHaveLength(1);
    expect(foot?.querySelectorAll('.ckp-tabs button[role="tab"]')).toHaveLength(1);
  });

  it('expose un segment par page de jour, libellé court et nom complet', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    const tabs = container.querySelector('.ckp-tabs');
    expect(tabs?.getAttribute('aria-label')).toBe('Jours du carnet');
    expect(container.querySelector('.ckp-th')).toBeTruthy();
    const segments = screen.getAllByRole('tab');
    expect(segments).toHaveLength(4);
    expect(segments.map((node) => node.getAttribute('aria-label'))).toEqual([
      'Résumé',
      'Jour 1',
      'Jour 2',
      'Jour 3',
    ]);
    expect(segments.map((node) => node.textContent)).toEqual(['R', 'J1', 'J2', 'J3']);
    expect(screen.getByRole('tab', { name: 'Résumé' }).getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('.ckp-pages')).toBeTruthy();
  });

  it('change de jour au clic sur un segment, sans toucher au carrousel', () => {
    const onPageChange = vi.fn();
    const { container } = render(<CarnetCard {...withDays({ onPageChange })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Jour 2' }));
    expect(norm(dayLabel(container))).toBe('Jour 2 · 27 sept.');
    expect(onPageChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Résumé' }));
    expect(dayLabel(container)).toBe('Résumé');
  });

  it('ne rend plus ♥ ni 💬 dans la carte : leurs pages vivent dans le carrousel', () => {
    const { container } = render(<CarnetCard {...base()} />);
    expect(screen.queryByRole('button', { name: /^J’aime/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Commenter/ })).toBeNull();
    expect(container.querySelector('.ckp-card-foot [data-icon="heart"]')).toBeNull();
    expect(container.querySelector('.ckp-card-foot [data-icon="message-square"]')).toBeNull();
    /* Le contenu réel des deux pages est toujours rendu par le carrousel. */
    const likes = render(<CarnetCard {...base({ page: 'likes', likesPage: <p>réactions</p> })} />);
    expect(likes.container.querySelector('.ckp-page-pad')?.textContent).toBe('réactions');
    likes.unmount();
  });

  it('ne monte aucune carte dans le carrousel : la seule carte est celle du bas', () => {
    for (const page of ['posts', 'etapes', 'materiel', 'nature'] as const) {
      const view = render(<CarnetCard {...base({ page })} />);
      expect(view.container.querySelector('.ckp-card .ckp-map-wrap')).toBeNull();
      expect(view.container.querySelector('.ckp-card .ckp-map-canvas')).toBeNull();
      expect(view.container.querySelector('.ckp-card .leaflet-container')).toBeNull();
      view.unmount();
    }
  });

  it('affiche une seule ligne de bio, sans répéter les statistiques', () => {
    const { container } = render(<CarnetCard {...base()} />);
    const lines = container.querySelectorAll('.ckp-bio-line');
    expect(lines).toHaveLength(1);
    const text = lines[0].textContent ?? '';
    expect(text).toBe(DETAIL.description);
    // L'ancienne ligne de synthèse (jours · km · D+ · moments) ne doit plus apparaître.
    expect(text).not.toContain('106,4 km');
    expect(text).not.toContain('2 002 m D+');
    expect(text).not.toContain('moments');
  });

  it('affiche une seule ligne de lieu, du texte, sans pastille ni bouton', () => {
    const { container } = render(<CarnetCard {...base()} />);
    const line = container.querySelector('.ckp-place-line');
    /* Même source que la rangée de statistiques : les totaux des jours. */
    expect(norm(line?.textContent)).toBe(
      'France / Italie / Suisse · 7 jours · 106,4 km · 2 002 m D+ · 26 sept. – 2 oct. 2026',
    );
    expect(container.querySelector('.ckp-place-pill')).toBeNull();
    expect(container.querySelector('.ckp-place-row')).toBeNull();
    expect(container.querySelector('.ckp-place-date')).toBeNull();
    /* Du texte seul : aucun bouton, aucune surface cliquable. */
    expect(line?.tagName).toBe('P');
    expect(container.querySelectorAll('.ckp-place-line button')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Recentrer/ })).toBeNull();
  });

  it('affiche les participants réels en pastilles, jamais les likers', () => {
    const { container } = render(
      <CarnetCard
        {...base({
          detail: detail({
            /* Un liker qui n'est pas participant ne doit produire aucune pastille. */
            likers: [{ id: 'u9', name: 'Liker Fantôme', handle: 'liker', avatarUrl: null, reaction: 'like' }],
            participants: [
              { userId: 'u1', name: 'Camille Rochat', handle: 'camille', avatarUrl: null, role: 'author' },
              { userId: 'u2', name: 'Noé Vidal', handle: 'noe', avatarUrl: null, role: 'participant' },
              { userId: 'u3', name: null, handle: 'sans_profil', avatarUrl: null, role: 'collaborator' },
            ],
          }),
        })}
      />,
    );
    const people = container.querySelectorAll('.ckp-people .pmi-author');
    expect(people).toHaveLength(3);
    expect(people[0].getAttribute('href')).toBe('/profil/u1');
    expect(people[1].textContent).toContain('Noé Vidal');
    /* Participant sans profil public : la ligne reste, sans nom inventé. */
    expect(people[2].getAttribute('href')).toBe('/profil/u3');
    expect(people[2].textContent).toContain('@sans_profil');
    expect(container.textContent).not.toContain('Liker Fantôme');
  });

  it('une seule pastille quand l’auteur est seul (carnet Islande)', () => {
    const { container } = render(
      <CarnetCard {...base({ detail: detail({ participants: DETAIL.participants, likers: [] }) })} />,
    );
    const people = container.querySelectorAll('.ckp-people .pmi-author');
    expect(people).toHaveLength(1);
    expect(people[0].getAttribute('href')).toBe('/profil/u1');
  });

  it('ouvre le post du moment au clic sur une tuile', () => {
    const onOpenPost = vi.fn();
    render(<CarnetCard {...base({ onOpenPost })} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Moment / })[1]);
    expect(onOpenPost).toHaveBeenCalledWith(1);
  });

  it('rend la page Étapes quand elle est active', () => {
    const { container } = render(
      <CarnetCard
        {...base({
          page: 'etapes',
          detail: detail({
            etapes: [
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
            ],
          }),
        })}
      />,
    );
    expect(container.querySelector('.ckp-pages')?.getAttribute('id')).toBe('carnet-page-etapes');
    expect(screen.getByText('Les Houches → Refuge de Bellachat')).toBeTruthy();
    /* Le volet Récit n'est plus dans le drawer : son contenu vit sur cette page. */
    expect(screen.getByText(/Vérifié/)).toBeTruthy();
    expect(document.getElementById('carnet-page-etapes')).toBeTruthy();
  });

  it('rend la page Matériel et son état vide honnête', () => {
    const { container } = render(<CarnetCard {...base({ page: 'materiel' })} />);
    expect(screen.getByText('Matériel non renseigné.')).toBeTruthy();
    expect(container.querySelector('.ckp-page-pad')).toBeTruthy();
  });

  it('ne peint plus les compteurs ♥ et 💬 sur la carte', () => {
    render(<CarnetCard {...base()} />);
    expect(screen.queryByRole('button', { name: /^J’aime, 22$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Commenter, 3$/ })).toBeNull();
  });

  it('pose les contenus J’aime, Commentaires et Gérer dans le carrousel', () => {
    const { container } = render(
      <CarnetCard
        {...base({
          page: 'likes',
          likesPage: <p>réactions réelles</p>,
          commentsPage: <p>commentaires réels</p>,
          managePage: <p>gestion réelle</p>,
        })}
      />,
    );
    expect(container.querySelector('.ckp-pages > .ckp-page .ckp-page-pad')?.textContent).toBe(
      'réactions réelles',
    );
    expect(container.querySelector('.ckp-pages')?.getAttribute('id')).toBe('carnet-page-likes');
  });
});

describe('CarnetCard — lentille unique du sélecteur', () => {
  function lens(container: HTMLElement) {
    const node = container.querySelector('.ckp-th') as HTMLElement | null;
    return { node, i: node?.style.getPropertyValue('--i') };
  }

  it('rend une seule lentille, dans la capsule des jours', () => {
    const { container } = render(<CarnetCard {...base()} />);
    expect(container.querySelectorAll('.ckp-th')).toHaveLength(1);
    const node = container.querySelector('.ckp-th');
    expect(node?.parentElement?.className).toContain('ckp-capsule');
    expect(node?.getAttribute('aria-hidden')).toBe('true');
  });

  it('pose la lentille sur le segment du jour affiché', () => {
    const summary = render(<CarnetCard {...base({ dayPage: 0 })} />);
    expect(lens(summary.container).i).toBe('0');
    summary.unmount();
    const dayTwo = render(<CarnetCard {...withDays({ dayPage: 2 })} />);
    expect(lens(dayTwo.container).i).toBe('2');
    dayTwo.unmount();
    const last = render(<CarnetCard {...withDays({ dayPage: 3 })} />);
    expect(lens(last.container).i).toBe('3');
  });

  it('garde la lentille allumée sur le jour affiché, quel que soit le volet ouvert', () => {
    for (const page of ['posts', 'likes', 'comments', 'manage', 'etapes', 'materiel', 'nature'] as const) {
      const view = render(<CarnetCard {...withDays({ page, detail: detail({ isOwner: true, days: [DAY_ONE, DAY_TWO] }) })} />);
      expect(lens(view.container).node?.getAttribute('data-off')).toBeNull();
      expect(lens(view.container).i).toBe('0');
      view.unmount();
    }
  });

  it('ne garde qu’un segment par page de jour, quel que soit le volet ouvert', () => {
    for (const page of ['posts', 'likes', 'comments', 'etapes'] as const) {
      const view = render(<CarnetCard {...withDays({ page })} />);
      const labels = [...view.container.querySelectorAll('.ckp-card-foot .ckp-tabs button')]
        .map((node) => node.getAttribute('aria-label'));
      expect(labels).toEqual(['Résumé', 'Jour 1', 'Jour 2', 'Jour 3']);
      view.unmount();
    }
  });

  it('garde les mêmes segments pour le propriétaire et le visiteur', () => {
    for (const isOwner of [false, true]) {
      const view = render(<CarnetCard {...base({ detail: detail({ isOwner, days: [DAY_ONE] }) })} />);
      const labels = [...view.container.querySelectorAll('.ckp-card-foot .ckp-tabs button')]
        .map((node) => node.getAttribute('aria-label'));
      expect(labels).toEqual(['Résumé', 'Jour 1']);
      view.unmount();
    }
  });
});

describe('CarnetCard — ligne de lieu unique', () => {
  const PLACE = { country: 'Islande', region: null, locality: 'Landmannalaugar', lat: null, lng: null };

  it('affiche pays, jours, distance, dénivelé et dates sur une seule ligne', () => {
    const { container } = render(
      <CarnetCard
        {...base({
          detail: detail({
            place: PLACE,
            etapes: [{ id: 'd1', dayNumber: 1, label: 'JOUR 1', from: null, to: null, note: null, distanceKm: null, elevationM: null, durationText: null, weather: null, overnight: null }],
          }),
        })}
      />,
    );
    const line = container.querySelector('.ckp-place-line');
    expect(norm(line?.textContent)).toBe(
      'Islande · 7 jours · 106,4 km · 2 002 m D+ · 26 sept. – 2 oct. 2026',
    );
    /* Le lieu est du texte : plus aucune pastille ni bouton de recentrage. */
    expect(container.querySelectorAll('.ckp-place-line button')).toHaveLength(0);
  });

  it('écrit un tiret pour chaque valeur réelle absente', () => {
    const { container } = render(
      <CarnetCard
        {...base({
          detail: detail({
            place: { country: 'Islande', region: null, locality: null, lat: null, lng: null },
            destination: null,
            dateRange: null,
            distanceKm: null,
            elevationM: null,
            etapes: [],
            summary: { distanceKm: null, elevationM: null, days: 0, moments: 0 },
          }),
        })}
      />,
    );
    expect(norm(container.querySelector('.ckp-place-line')?.textContent)).toBe('Islande · — · — · —');
  });

  it('retombe sur la destination quand le pays réel est vide', () => {
    const { container } = render(<CarnetCard {...base()} />);
    expect(norm(container.querySelector('.ckp-place-line')?.textContent).startsWith(DETAIL.destination ?? '')).toBe(true);
  });

  it('n’affiche aucune ligne quand le carnet n’a réellement rien à dire', () => {
    const { container } = render(
      <CarnetCard
        {...base({
          detail: detail({
            place: { country: null, region: null, locality: null, lat: null, lng: null },
            destination: null,
            dateRange: null,
            distanceKm: null,
            elevationM: null,
            etapes: [],
            summary: { distanceKm: null, elevationM: null, days: 0, moments: 0 },
          }),
        })}
      />,
    );
    /* Aucune donnée réelle : pas de ligne de tirets décorative. */
    expect(container.querySelector('.ckp-place-line')).toBeNull();
  });
});

/* =============================================================================
   Balayage Résumé → J1 … → Jn (tâche 3) et capsule des drawers (tâche 4)
   ============================================================================= */

const M1 = {
  id: 'm1',
  dayNumber: 1,
  time: '18:30',
  caption: 'Bivouac',
  authorName: null,
  place: 'Col',
  imageUrl: 'https://cdn.test/1.jpg',
};
const M2 = {
  id: 'm2',
  dayNumber: 2,
  time: null,
  caption: null,
  authorName: null,
  place: null,
  imageUrl: 'https://cdn.test/2.jpg',
};
/* Un moment sans image : il compte dans le jour, jamais dans la grille. */
const M3 = { ...M2, id: 'm3', imageUrl: null };

const DAY_ONE = {
  index: 1,
  date: '2026-09-26',
  distanceKm: 18.4,
  elevationM: 620,
  durationS: 21600,
  moments: [M1],
  points: [],
};
const DAY_TWO = {
  index: 2,
  date: '2026-09-27',
  distanceKm: 12,
  elevationM: 300,
  durationS: null,
  moments: [M2, M3],
  points: [],
};
/* Jour sans GPS et sans moment : il reste dans le balayage, en tirets honnêtes. */
const DAY_THREE = {
  index: 3,
  date: '2026-09-28',
  distanceKm: null,
  elevationM: null,
  durationS: null,
  moments: [],
  points: [],
};

function withDays(overrides: Partial<React.ComponentProps<typeof CarnetCard>> = {}) {
  return base({
    detail: detail({
      days: [DAY_ONE, DAY_TWO, DAY_THREE],
      moments: [M1, M2, M3],
      photoMoments: [M1, M2],
      distanceKm: 30.4,
      elevationM: 920,
      summary: { distanceKm: 30.4, elevationM: 920, days: 3, moments: 3 },
    }),
    ...overrides,
  });
}

function drag(element: Element, x1: number, x2: number) {
  pointer(element, 'pointerdown', x1, 100);
  pointer(element, 'pointerup', x2, 100);
}

function pointer(element: Element, type: 'pointerdown' | 'pointerup', x: number, y: number) {
  fireEvent(
    element,
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }),
  );
}

/* jsdom n'émet aucun `pointerType` : on le pose sur l'événement natif, comme
   le fait un vrai navigateur tactile. */
function pointerAs(
  element: Element,
  type: 'pointerdown' | 'pointerup',
  x: number,
  y: number,
  pointerType: string,
) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  fireEvent(element, event);
}

function touchStart(element: Element, x: number, y: number) {
  fireEvent.touchStart(element, { touches: [{ clientX: x, clientY: y, identifier: 0 }] });
}

function touchMove(element: Element, x: number, y: number) {
  fireEvent.touchMove(element, { touches: [{ clientX: x, clientY: y, identifier: 0 }] });
}

function touchEnd(element: Element, x: number, y: number) {
  fireEvent.touchEnd(element, { changedTouches: [{ clientX: x, clientY: y, identifier: 0 }], touches: [] });
}

function swipeTouch(element: Element, x1: number, y1: number, x2: number, y2: number) {
  touchStart(element, x1, y1);
  touchMove(element, x2, y2);
  touchEnd(element, x2, y2);
}

const dayLabel = (container: HTMLElement) => container.querySelector('.ckp-daypill-label')?.textContent;
const statNames = (container: HTMLElement) =>
  [...container.querySelectorAll('.ckp-stat')].map((node) => node.getAttribute('aria-label'));

describe('CarnetCard — balayage Résumé → J1..Jn', () => {
  it('ouvre sur le Résumé : les totaux du carnet et tous les moments', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    expect(dayLabel(container)).toBe('Résumé');
    expect(norm(container.querySelector('.ckp-daypill-count')?.textContent)).toBe('3 moments');
    expect(statNames(container)).toEqual([
      'DISTANCE 30,4 km',
      'DÉNIVELÉ + 920 m',
      'JOURS 3',
    ]);
    expect(container.querySelectorAll('.ckp-grid-wrap .ckp-tile')).toHaveLength(2);
  });

  it('passe au jour 1 au balayage vers la gauche : sa date, ses chiffres, ses photos', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    drag(container.querySelector('.ckp-card') as Element, 300, 180);
    expect(norm(dayLabel(container))).toBe('Jour 1 · 26 sept.');
    expect(statNames(container)).toEqual([
      'DISTANCE 18,4 km',
      'DÉNIVELÉ + 620 m',
      'DURÉE 6 h',
    ]);
    expect(container.querySelectorAll('.ckp-grid-wrap .ckp-tile')).toHaveLength(1);
    expect(norm(container.querySelector('.ckp-daypill-count')?.textContent)).toBe('1 moment');
  });

  it('revient au Résumé au balayage vers la droite', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    drag(container.querySelector('.ckp-card') as Element, 300, 180);
    expect(norm(dayLabel(container))).toBe('Jour 1 · 26 sept.');
    drag(container.querySelector('.ckp-card') as Element, 120, 260);
    expect(dayLabel(container)).toBe('Résumé');
  });

  it('respecte les bornes : rien à droite du Résumé, rien après le dernier jour', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    const card = container.querySelector('.ckp-card') as Element;
    drag(card, 140, 300);
    expect(dayLabel(container)).toBe('Résumé');
    drag(card, 300, 180);
    drag(card, 300, 180);
    drag(card, 300, 180);
    expect(dayLabel(container)).toBe('Jour 3 · 28 sept.');
    drag(card, 300, 180);
    expect(dayLabel(container)).toBe('Jour 3 · 28 sept.');
  });

  it('se balaie au clavier, flèches gauche et droite, bornes comprises', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    const card = container.querySelector('.ckp-card') as Element;
    fireEvent.keyDown(card, { key: 'ArrowRight' });
    expect(norm(dayLabel(container))).toBe('Jour 1 · 26 sept.');
    fireEvent.keyDown(card, { key: 'ArrowLeft' });
    expect(dayLabel(container)).toBe('Résumé');
    fireEvent.keyDown(card, { key: 'ArrowLeft' });
    expect(dayLabel(container)).toBe('Résumé');
    fireEvent.keyDown(card, { key: 'End' });
    expect(dayLabel(container)).toBe('Jour 3 · 28 sept.');
    fireEvent.keyDown(card, { key: 'ArrowRight' });
    expect(dayLabel(container)).toBe('Jour 3 · 28 sept.');
  });

  it('un jour sans GPS écrit — km, — m et un état vide de grille, sans erreur', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<CarnetCard {...withDays()} />);
    const card = container.querySelector('.ckp-card') as Element;
    fireEvent.keyDown(card, { key: 'End' });
    expect(statNames(container)).toEqual(['DISTANCE — km', 'DÉNIVELÉ + — m', 'DURÉE — h']);
    expect(container.querySelector('.ckp-grid-wrap')).toBeNull();
    expect(container.querySelector('.ckp-grid-empty')?.textContent).toContain(
      'Aucun moment ce jour-là.',
    );
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('ne limite la grille qu’aux moments du jour affiché', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    const card = container.querySelector('.ckp-card') as Element;
    /* Résumé : les deux photos du carnet. */
    expect(container.querySelectorAll('.ckp-grid-wrap .ckp-tile')).toHaveLength(2);
    fireEvent.keyDown(card, { key: 'ArrowRight' });
    /* J1 : une seule photo, celle de J1. */
    expect(container.querySelectorAll('.ckp-grid-wrap .ckp-tile')).toHaveLength(1);
    fireEvent.keyDown(card, { key: 'ArrowRight' });
    /* J2 : deux moments, une seule photo. */
    expect(norm(container.querySelector('.ckp-daypill-count')?.textContent)).toBe('2 moments');
    expect(container.querySelectorAll('.ckp-grid-wrap .ckp-tile')).toHaveLength(1);
  });

  it('ouvre le post du moment réel depuis une grille de jour', () => {
    const onOpenPost = vi.fn();
    const { container } = render(<CarnetCard {...withDays({ onOpenPost })} />);
    fireEvent.keyDown(container.querySelector('.ckp-card') as Element, { key: 'ArrowRight' });
    fireEvent.keyDown(container.querySelector('.ckp-card') as Element, { key: 'ArrowRight' });
    fireEvent.click(screen.getAllByRole('button', { name: /^Moment / })[0]);
    /* Le moment de J2 est le deuxième de la galerie complète. */
    expect(onOpenPost).toHaveBeenLastCalledWith(1);
  });

  it('un glissement dans la grille change de jour, jamais de page', () => {
    const onPageChange = vi.fn();
    const { container } = render(<CarnetCard {...withDays({ onPageChange })} />);
    const pages = () => container.querySelector('.ckp-pages') as Element;
    drag(pages(), 300, 180);
    expect(norm(dayLabel(container))).toBe('Jour 1 · 26 sept.');
    expect(onPageChange).not.toHaveBeenCalled();
    expect(container.querySelector('.ckp-pages')?.getAttribute('id')).toBe('carnet-page-posts');
    drag(pages(), 300, 180);
    expect(norm(dayLabel(container))).toBe('Jour 2 · 27 sept.');
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('respecte les bornes depuis la grille : rien avant le Résumé, rien après Jn', () => {
    const onPageChange = vi.fn();
    const { container } = render(<CarnetCard {...withDays({ onPageChange })} />);
    const pages = () => container.querySelector('.ckp-pages') as Element;
    /* Vers la droite sur le Résumé : aucun jour avant. */
    drag(pages(), 140, 300);
    expect(dayLabel(container)).toBe('Résumé');
    /* Résumé + trois jours : trois pas mènent à la borne haute, le
       quatrième glisse dans le vide. */
    drag(pages(), 300, 180);
    drag(pages(), 300, 180);
    drag(pages(), 300, 180);
    expect(norm(dayLabel(container))).toBe('Jour 3 · 28 sept.');
    drag(pages(), 300, 180);
    expect(norm(dayLabel(container))).toBe('Jour 3 · 28 sept.');
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('un glissement ne clique jamais la tuile sous le doigt', () => {
    const onOpenPost = vi.fn();
    const { container } = render(<CarnetCard {...withDays({ onOpenPost })} />);
    const tile = screen.getAllByRole('button', { name: /^Moment / })[0];
    pointer(tile, 'pointerdown', 300, 100);
    pointer(tile, 'pointerup', 180, 105);
    fireEvent.click(tile);
    expect(onOpenPost).not.toHaveBeenCalled();
    expect(norm(dayLabel(container))).toBe('Jour 1 · 26 sept.');
  });

  /* --- Doigt : même seuil, mêmes bornes, même règle ------------------------ */

  it('se balaie au doigt : touchstart → touchmove → touchend change de jour', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    const card = container.querySelector('.ckp-card') as Element;
    swipeTouch(card, 300, 120, 180, 128);
    expect(norm(dayLabel(container))).toBe('Jour 1 · 26 sept.');
    swipeTouch(card, 300, 120, 180, 128);
    expect(norm(dayLabel(container))).toBe('Jour 2 · 27 sept.');
    swipeTouch(card, 120, 120, 260, 124);
    expect(norm(dayLabel(container))).toBe('Jour 1 · 26 sept.');
  });

  it('ignore un geste tactile vertical ou trop court', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    const card = container.querySelector('.ckp-card') as Element;
    /* Trop court : moins de 40 px. */
    swipeTouch(card, 200, 100, 175, 100);
    expect(dayLabel(container)).toBe('Résumé');
    /* Vertical : le défilement de la carte garde la main. */
    swipeTouch(card, 200, 60, 160, 220);
    expect(dayLabel(container)).toBe('Résumé');
  });

  it('respecte les bornes au doigt', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    const card = container.querySelector('.ckp-card') as Element;
    swipeTouch(card, 140, 120, 300, 120);
    expect(dayLabel(container)).toBe('Résumé');
    swipeTouch(card, 300, 120, 180, 120);
    swipeTouch(card, 300, 120, 180, 120);
    swipeTouch(card, 300, 120, 180, 120);
    expect(norm(dayLabel(container))).toBe('Jour 3 · 28 sept.');
    swipeTouch(card, 300, 120, 180, 120);
    expect(norm(dayLabel(container))).toBe('Jour 3 · 28 sept.');
  });

  it('un balayage tactile ne clique jamais la tuile sous le doigt', () => {
    const onOpenPost = vi.fn();
    const { container } = render(<CarnetCard {...withDays({ onOpenPost })} />);
    const tile = screen.getAllByRole('button', { name: /^Moment / })[0];
    swipeTouch(tile, 300, 100, 180, 105);
    expect(norm(dayLabel(container))).toBe('Jour 1 · 26 sept.');
    /* Le clic synthétique du navigateur est avalé en capture. */
    fireEvent.click(tile);
    expect(onOpenPost).not.toHaveBeenCalled();
  });

  it('ne compte qu’un jour quand le doigt émet aussi des événements pointeur', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    const card = container.querySelector('.ckp-card') as Element;
    pointerAs(card, 'pointerdown', 300, 120, 'touch');
    pointerAs(card, 'pointerup', 180, 120, 'touch');
    expect(dayLabel(container)).toBe('Résumé');
    swipeTouch(card, 300, 120, 180, 120);
    expect(norm(dayLabel(container))).toBe('Jour 1 · 26 sept.');
  });
});

/* =============================================================================
   Informations du jour : lignes chiffrées et liste des moments
   ============================================================================= */

describe('CarnetCard — informations du jour', () => {
  const rows = (container: HTMLElement) =>
    [...container.querySelectorAll('.ckp-dayinfo-row')].map((row) => [
      row.querySelector('.ckp-dayinfo-l')?.textContent,
      row.querySelector('.ckp-dayinfo-v')?.textContent,
    ]);

  const moments = (container: HTMLElement) =>
    [...container.querySelectorAll('.ckp-dayinfo-moment')].map((row) => [
      row.querySelector('.ckp-dayinfo-time')?.textContent,
      row.querySelector('.ckp-dayinfo-place')?.textContent,
    ]);

  it('donne les totaux du Résumé : jours, moments, D+ cumulé, distance', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    expect(rows(container)).toEqual([
      ['Jours', '3'],
      ['Moments', '3'],
      ['D+ cumulé', '920 m'],
      ['Distance totale', '30,4 km'],
    ]);
  });

  it('calcule l’allure réelle du jour et le cumul depuis le départ', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    fireEvent.keyDown(container.querySelector('.ckp-card') as Element, { key: 'ArrowRight' });
    /* 6 h pour 18,4 km : 19,6 min/km — calculée, jamais inventée. */
    expect(rows(container)).toEqual([
      ['Allure', '19,6 min/km'],
      ['Activité', '—'],
      ['Départ', '—'],
      ['Arrivée', '—'],
      ['Depuis le départ', '18,4 km'],
    ]);
    fireEvent.keyDown(container.querySelector('.ckp-card') as Element, { key: 'ArrowRight' });
    expect(rows(container)).toContainEqual(['Depuis le départ', '30,4 km']);
  });

  it('écrit un tiret quand la durée ou la distance manque', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    fireEvent.keyDown(container.querySelector('.ckp-card') as Element, { key: 'End' });
    expect(rows(container)).toEqual([
      ['Allure', '—'],
      ['Activité', '—'],
      ['Départ', '—'],
      ['Arrivée', '—'],
      ['Depuis le départ', '30,4 km'],
    ]);
  });

  it('lit le départ et l’arrivée dans l’étape déclarée', () => {
    const { container } = render(
      <CarnetCard
        {...withDays({
          detail: detail({
            days: [DAY_ONE],
            etapes: [
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
                overnight: null,
              },
            ],
          }),
        })}
      />,
    );
    fireEvent.keyDown(container.querySelector('.ckp-card') as Element, { key: 'ArrowRight' });
    expect(rows(container)).toContainEqual(['Départ', 'Les Houches']);
    expect(rows(container)).toContainEqual(['Arrivée', 'Refuge de Bellachat']);
  });

  it('retombe sur les points GPS du jour quand aucune étape ne les nomme', () => {
    const { container } = render(
      <CarnetCard
        {...withDays({
          detail: detail({
            days: [
              {
                ...DAY_ONE,
                points: [
                  { lat: 44.942, lng: 5.42, at: '2026-09-26T07:30:00.000Z' },
                  { lat: 45.1, lng: 5.5, at: '2026-09-26T12:30:00.000Z' },
                ],
              },
            ],
            etapes: [],
          }),
        })}
      />,
    );
    fireEvent.keyDown(container.querySelector('.ckp-card') as Element, { key: 'ArrowRight' });
    expect(rows(container)).toContainEqual(['Départ', '44,942 · 5,42']);
    expect(rows(container)).toContainEqual(['Arrivée', '45,1 · 5,5']);
  });

  it('liste les moments du jour avec leur heure et leur lieu', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    fireEvent.keyDown(container.querySelector('.ckp-card') as Element, { key: 'ArrowRight' });
    expect(moments(container)).toEqual([['18:30', 'Col']]);
  });

  it('écrit un tiret pour une heure ou un lieu absent', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    fireEvent.keyDown(container.querySelector('.ckp-card') as Element, { key: 'ArrowRight' });
    fireEvent.keyDown(container.querySelector('.ckp-card') as Element, { key: 'ArrowRight' });
    expect(moments(container)).toEqual([
      ['—', '—'],
      ['—', '—'],
    ]);
  });

  it('préfixe les moments du Résumé par leur numéro de jour', () => {
    const { container } = render(<CarnetCard {...withDays()} />);
    expect(
      [...container.querySelectorAll('.ckp-dayinfo-moment')].map(
        (row) => row.querySelector('.ckp-dayinfo-day')?.textContent,
      ),
    ).toEqual(['J1', 'J2', 'J2']);
  });
});

describe('CarnetCard — capsule des drawers et mouvement du balayage', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src/styles/carnet-profile.css'), 'utf8');

  function rule(selector: string): string {
    const start = css.indexOf(selector);
    if (start < 0) throw new Error(`règle absente : ${selector}`);
    const open = css.indexOf('{', start);
    const close = css.indexOf('}', open);
    return css.slice(open + 1, close);
  }

  it('pose la capsule des jours à 10 px du bord droit et du bas, sur 30 px de haut', () => {
    const foot = rule('.ckp-card-foot {');
    expect(foot).toMatch(/position:\s*absolute/);
    expect(foot).toMatch(/right:\s*10px/);
    expect(foot).toMatch(/bottom:\s*10px/);
    expect(foot).toMatch(/height:\s*30px/);
  });

  it('fait `n × 41,5 + 5` de large, avec l’ombre de pose des drawers', () => {
    const capsule = rule('\n.ckp-capsule {');
    /* 2 × 41,5 + 5 = 88 : même formule que la capsule des drawers. */
    expect(capsule).toMatch(/width:\s*calc\(var\(--n, 2\) \* 41\.5px \+ 5px\)/);
    expect(capsule).toMatch(/height:\s*30px/);
    expect(capsule).toMatch(/padding:\s*2\.5px/);
    expect(rule('.ckp-card-foot .ckp-capsule {')).toMatch(/0 2px 8px rgba\(23, 43, 36, \.10\)/);
    expect(rule('.ckp-capsule .ckp-tabs {')).toMatch(
      /grid-template-columns:\s*repeat\(var\(--n, 2\), 41\.5px\)/,
    );
    expect(2 * 41.5 + 5).toBe(88);
  });

  it('n’a plus aucun bouton rond dans le pied', () => {
    expect(css).not.toMatch(/\.ckp-actions/);
    expect(css).not.toMatch(/\.ckp-action\b/);
  });

  it('glisse d’un jour en 220 ms, sans translation sous mouvement réduit', () => {
    expect(rule('.ckp-day--next {')).toMatch(
      /animation:\s*ckp-day-next 220ms cubic-bezier\(\.22, 1, \.36, 1\)/,
    );
    expect(rule('.ckp-day--prev {')).toMatch(
      /animation:\s*ckp-day-prev 220ms cubic-bezier\(\.22, 1, \.36, 1\)/,
    );
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .ckp-day--next'));
    expect(reduced).toMatch(/\.ckp-day--next, \.ckp-day--prev \{ animation: none; \}/);
  });
});
