// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetCard } from '../CarnetCard';
import { DETAIL, detail } from './fixtures';

afterEach(() => cleanup());

const noop = () => {};

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
    mediaMode: 'grid' as const,
    onMediaModeChange: noop,
    onOpenCarnet: noop,
    onOpenStat: noop,
    onOpenComments: noop,
    onOpenLikes: noop,
    onOpenParcours: noop,
    onOpenManage: noop,
    onLike: noop,
    onSave: noop,
    onOpenMenu: noop,
    onFocusPlace: noop,
    onOpenPost: noop,
    onDownloadGpx: noop,
    ...overrides,
  };
}

describe('CarnetCard — carte du carnet', () => {
  it('ouvre le drawer Carnet au clic sur le mini tracé', () => {
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

  it('rend les statistiques comme des boutons de drawer', () => {
    const onOpenStat = vi.fn();
    render(<CarnetCard {...base({ onOpenStat })} />);
    fireEvent.click(screen.getByRole('button', { name: 'DISTANCE 106,4 km' }));
    expect(onOpenStat).toHaveBeenCalledWith('parcours');
    fireEvent.click(screen.getByRole('button', { name: 'JOURS 7' }));
    expect(onOpenStat).toHaveBeenCalledWith('etapes');
  });

  it('pose cinq actions compactes sur la ligne du sélecteur, sans libellé', () => {
    const { container } = render(<CarnetCard {...base()} />);
    expect(container.querySelector('.ckp-action-lbl')).toBeNull();
    expect(container.querySelectorAll('.ckp-actions .ckp-action-btn')).toHaveLength(5);
    expect(container.querySelector('.ckp-card-foot .ckp-tabs')).toBeTruthy();
  });

  it('fusionne actions, séparateur et segments dans une seule capsule', () => {
    const { container } = render(<CarnetCard {...base()} />);
    const foot = container.querySelector('.ckp-card-foot');
    expect(container.querySelectorAll('.ckp-card-foot')).toHaveLength(1);
    // Conteneur simple : aucun rôle de sélecteur sur la capsule.
    expect(foot?.getAttribute('role')).toBeNull();
    expect([...(foot?.children ?? [])].map((el) => el.className)).toEqual([
      'ckp-actions',
      'ckp-foot-sep',
      'ckp-tabs',
    ]);
    expect(foot?.querySelector('.ckp-foot-sep')?.getAttribute('aria-hidden')).toBe('true');
    // Le sélecteur vit dans la capsule, pas ailleurs dans la carte.
    expect(container.querySelectorAll('.ckp-card > .ckp-tabs')).toHaveLength(0);
    expect(container.querySelectorAll('.ckp-tabs')).toHaveLength(1);
    // Les deux familles de boutons restent distinctes et accessibles.
    expect(foot?.querySelectorAll('.ckp-actions button[aria-label]')).toHaveLength(5);
    expect(foot?.querySelectorAll('.ckp-tabs button[role="tab"]')).toHaveLength(2);
  });

  it('garde tous les comportements des actions déplacées', () => {
    const onLike = vi.fn();
    const onSave = vi.fn();
    const onOpenComments = vi.fn();
    const onOpenParcours = vi.fn();
    const onOpenMenu = vi.fn();
    render(<CarnetCard {...base({ onLike, onSave, onOpenComments, onOpenParcours, onOpenMenu })} />);
    fireEvent.click(screen.getByRole('button', { name: /^J’aime/ }));
    expect(onLike).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /^Commenter/ }));
    expect(onOpenComments).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSave).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Parcours' }));
    expect(onOpenParcours).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Plus d’options' }));
    expect(onOpenMenu).toHaveBeenCalledOnce();
  });

  it('propose Gérer au propriétaire', () => {
    const onOpenManage = vi.fn();
    render(<CarnetCard {...base({ onOpenManage, detail: detail({ isOwner: true }) })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gérer' }));
    expect(onOpenManage).toHaveBeenCalledOnce();
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

  it('affiche le lieu et les dates sur la ligne de lieu', () => {
    const { container } = render(<CarnetCard {...base()} />);
    expect(container.querySelector('.ckp-place-pill')?.textContent).toBe(DETAIL.destination);
    expect(container.querySelector('.ckp-place-date')?.textContent).toBe(DETAIL.dateRange);
  });

  it('désactive le recentrage sans coordonnée réelle', () => {
    const onFocusPlace = vi.fn();
    render(<CarnetCard {...base({ onFocusPlace, detail: detail({ trace: null }) })} />);
    const chip = screen.getByRole('button', { name: /Recentrer la carte sur/ }) as HTMLButtonElement;
    expect(chip.disabled).toBe(true);
    fireEvent.click(chip);
    expect(onFocusPlace).not.toHaveBeenCalled();
  });

  it('recentre la carte sur le centre réel de la trace', () => {
    const onFocusPlace = vi.fn();
    render(<CarnetCard {...base({ onFocusPlace, detail: detail({ trace: TRACE }) })} />);
    fireEvent.click(screen.getByRole('button', { name: /Recentrer la carte sur/ }));
    expect(onFocusPlace).toHaveBeenCalledOnce();
    const target = onFocusPlace.mock.calls[0][0];
    expect(target.lat).toBeCloseTo(45.835, 6);
    expect(target.lng).toBeCloseTo(6.865, 6);
    expect(target.zoom).toBe(10);
  });

  it('affiche l’auteur puis les likers distincts en pastilles', () => {
    const { container } = render(
      <CarnetCard
        {...base({
          detail: detail({
            likers: [
              { id: 'u1', name: 'Camille Rochat', handle: 'camille', avatarUrl: null, reaction: 'bravo' },
              { id: 'u2', name: 'Noé Vidal', handle: null, avatarUrl: null, reaction: 'like' },
            ],
          }),
        })}
      />,
    );
    const people = container.querySelectorAll('.ckp-people .pmi-author');
    expect(people).toHaveLength(2);
    expect(people[0].getAttribute('href')).toBe('/profil/u1');
    expect(people[1].textContent).toContain('Noé Vidal');
  });

  it('ouvre le post du moment au clic sur une tuile', () => {
    const onOpenPost = vi.fn();
    render(<CarnetCard {...base({ onOpenPost })} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Moment / })[1]);
    expect(onOpenPost).toHaveBeenCalledWith(1);
  });

  it('expose le sélecteur 31 px avec lentille et deux cellules', () => {
    const { container } = render(<CarnetCard {...base()} />);
    const tabs = container.querySelector('.ckp-tabs');
    expect(tabs?.getAttribute('aria-label')).toBe('Affichage des médias');
    expect(container.querySelector('.ckp-th')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Grille des moments' }).getAttribute('aria-selected')).toBe('true');
  });

  it('bascule en carte du parcours', () => {
    const onMediaModeChange = vi.fn();
    render(<CarnetCard {...base({ onMediaModeChange })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Carte du parcours' }));
    expect(onMediaModeChange).toHaveBeenCalledWith('map');
  });

  it('affiche les compteurs réels et le like actif', () => {
    render(<CarnetCard {...base({ detail: detail({ engagement: { ...detail().engagement, liked: true } }) })} />);
    expect(screen.getByRole('button', { name: 'J’aime, 22' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Commenter, 3' })).toBeTruthy();
  });
});
