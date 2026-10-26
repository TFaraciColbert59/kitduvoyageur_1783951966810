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
    page: 'posts' as const,
    onPageChange: noop,
    canWrite: false,
    onRequireAuth: noop,
    onOpenCarnet: noop,
    onOpenStat: noop,
    onOpenComments: noop,
    onOpenLikes: noop,
    onOpenParcours: noop,
    onOpenManage: noop,
    onSave: noop,
    onOpenMenu: noop,
    onFocusPlace: noop,
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
    fireEvent.click(screen.getByRole('button', { name: 'DÉNIVELÉ + 2 002 m' }));
    expect(onOpenStat).toHaveBeenLastCalledWith('elevation');
    fireEvent.click(screen.getByRole('button', { name: 'JOURS 7' }));
    expect(onOpenStat).toHaveBeenLastCalledWith('days');
    expect(onOpenStat).toHaveBeenCalledTimes(3);
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
      'ckp-th',
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

  it('expose deux segments grille/carte comme la page Compte', () => {
    const { container } = render(<CarnetCard {...base()} />);
    const tabs = container.querySelector('.ckp-tabs');
    expect(tabs?.getAttribute('aria-label')).toBe('Grille ou carte');
    expect(container.querySelector('.ckp-th')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Posts' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Parcours' }).getAttribute('aria-selected')).toBe('false');
    expect(container.querySelector('.ckp-pages')).toBeTruthy();
  });

  it('remonte le changement de page depuis les pastilles', () => {
    const onPageChange = vi.fn();
    render(<CarnetCard {...base({ onPageChange })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Parcours' }));
    expect(onPageChange).toHaveBeenLastCalledWith('parcours');
    fireEvent.click(screen.getByRole('tab', { name: 'Posts' }));
    expect(onPageChange).toHaveBeenLastCalledWith('posts');
  });

  it('garde tous les comportements des actions déplacées', () => {
    const onOpenLikes = vi.fn();
    const onSave = vi.fn();
    const onOpenComments = vi.fn();
    const onOpenParcours = vi.fn();
    const onOpenMenu = vi.fn();
    render(
      <CarnetCard
        {...base({ onOpenLikes, onSave, onOpenComments, onOpenParcours, onOpenMenu })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^J’aime/ }));
    expect(onOpenLikes).toHaveBeenCalledOnce();
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

  it('rend la page Étapes quand elle est active', () => {
    const { container } = render(
      <CarnetCard
        {...base({
          page: 'etapes',
          detail: detail({
            days: [
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

  it('affiche les compteurs réels sans état pressé sur les pages', () => {
    render(<CarnetCard {...base()} />);
    expect(screen.getByRole('button', { name: 'J’aime, 22' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Commenter, 3' })).toBeTruthy();
    /* Le ♥ n’est plus une bascule : il ouvre la page J’aime. */
    expect(screen.getByRole('button', { name: 'J’aime, 22' }).getAttribute('aria-pressed')).toBeNull();
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

  it('rend une seule lentille, enfant direct de la capsule', () => {
    const { container } = render(<CarnetCard {...base()} />);
    expect(container.querySelectorAll('.ckp-th')).toHaveLength(1);
    const node = container.querySelector('.ckp-th');
    expect(node?.parentElement?.className).toBe('ckp-card-foot');
    expect(node?.getAttribute('aria-hidden')).toBe('true');
  });

  it('pose la lentille sur la vue active : grille 5, carte 6', () => {
    const posts = render(<CarnetCard {...base({ page: 'posts' })} />);
    expect(lens(posts.container).i).toBe('5');
    posts.unmount();
    const parcours = render(<CarnetCard {...base({ page: 'parcours' })} />);
    expect(lens(parcours.container).i).toBe('6');
  });

  it('suit la page affichée : J’aime 0, Commentaires 1, Gérer 3', () => {
    const likes = render(<CarnetCard {...base({ page: 'likes' })} />);
    expect(lens(likes.container).i).toBe('0');
    expect(screen.getByRole('button', { name: /^J’aime/ }).getAttribute('aria-current')).toBe('page');
    likes.unmount();

    const comments = render(<CarnetCard {...base({ page: 'comments' })} />);
    expect(lens(comments.container).i).toBe('1');
    expect(screen.getByRole('button', { name: /^Commenter/ }).getAttribute('aria-current')).toBe('page');
    comments.unmount();

    const manage = render(<CarnetCard {...base({ page: 'manage', detail: detail({ isOwner: true }) })} />);
    expect(lens(manage.container).i).toBe('3');
    expect(screen.getByRole('button', { name: 'Gérer' }).getAttribute('aria-current')).toBe('page');
  });

  it('masque la lentille sur une page sans segment (Étapes, Matériel, Nature)', () => {
    for (const page of ['etapes', 'materiel', 'nature'] as const) {
      const view = render(<CarnetCard {...base({ page })} />);
      expect(lens(view.container).node?.getAttribute('data-off')).toBe('true');
      view.unmount();
    }
  });

  it('ne pose jamais la lentille sur Enregistrer ou Plus', () => {
    for (const page of ['posts', 'parcours', 'likes', 'comments'] as const) {
      const view = render(<CarnetCard {...base({ page })} />);
      expect(screen.getByRole('button', { name: 'Enregistrer' }).getAttribute('aria-current')).toBeNull();
      expect(screen.getByRole('button', { name: 'Plus d’options' }).getAttribute('aria-current')).toBeNull();
      view.unmount();
    }
  });

  it('donne Gérer au propriétaire et Parcours au visiteur, au même segment', () => {
    const visitor = render(<CarnetCard {...base({ detail: detail({ isOwner: false }) })} />);
    expect(screen.queryByRole('button', { name: 'Gérer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Parcours' })).toBeTruthy();
    visitor.unmount();

    const owner = render(<CarnetCard {...base({ detail: detail({ isOwner: true }) })} />);
    expect(screen.getByRole('button', { name: 'Gérer' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Parcours' })).toBeNull();
  });
});

describe('CarnetCard — lieu « pays · région · lieu »', () => {
  const PLACE = { country: 'Islande', region: null, locality: 'Landmannalaugar', lat: null, lng: null };

  it('affiche jusqu’à trois segments réels, sans bouton sans coordonnée', () => {
    const { container } = render(<CarnetCard {...base({ detail: detail({ place: PLACE }) })} />);
    const pills = container.querySelectorAll('.ckp-place-pill');
    expect([...pills].map((pill) => pill.textContent)).toEqual(['Islande', 'Landmannalaugar']);
    expect((pills[0] as HTMLButtonElement).disabled).toBe(true);
    expect((pills[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('rend chaque segment cliquable dès qu’une coordonnée réelle existe', () => {
    const onFocusPlace = vi.fn();
    render(
      <CarnetCard {...base({ onFocusPlace, detail: detail({ place: PLACE, trace: TRACE }) })} />,
    );
    const pills = screen.getAllByRole('button', { name: /Recentrer la carte sur/ });
    expect(pills).toHaveLength(2);
    expect(pills.map((pill) => pill.textContent)).toEqual(['Islande', 'Landmannalaugar']);
    fireEvent.click(pills[1]);
    expect(onFocusPlace).toHaveBeenCalledOnce();
    const target = onFocusPlace.mock.calls[0][0];
    expect(target.lat).toBeCloseTo(45.835, 6);
    expect(target.zoom).toBe(10);
  });

  it('retombe sur la destination quand le lieu réel est vide', () => {
    const { container } = render(<CarnetCard {...base()} />);
    expect(container.querySelector('.ckp-place-pill')?.textContent).toBe(DETAIL.destination);
  });
});
