// @vitest-environment jsdom
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
    fireEvent.click(screen.getByRole('button', { name: 'DÉNIVELÉ + 2 002 m' }));
    expect(onOpenStat).toHaveBeenLastCalledWith('elevation');
    fireEvent.click(screen.getByRole('button', { name: 'JOURS 7' }));
    expect(onOpenStat).toHaveBeenLastCalledWith('days');
    expect(onOpenStat).toHaveBeenCalledTimes(3);
  });

  it('deux boutons ronds hors capsule, puis la capsule à deux segments (Compte)', () => {
    const { container } = render(<CarnetCard {...base()} />);
    expect(container.querySelector('.ckp-action-lbl')).toBeNull();
    const actions = container.querySelectorAll('.ckp-card-foot > .ckp-actions .ckp-action');
    expect(actions).toHaveLength(2);
    expect([...actions].map((node) => node.getAttribute('aria-label'))).toEqual([
      'J’aime, 22',
      'Commenter, 3',
    ]);
    const capsule = container.querySelector('.ckp-card-foot .ckp-capsule');
    expect(capsule).toBeTruthy();
    const segments = capsule?.querySelectorAll('.ckp-tabs button') ?? [];
    expect(segments).toHaveLength(2);
    expect([...segments].map((node) => node.getAttribute('aria-label'))).toEqual([
      'Posts',
      'Parcours',
    ]);
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

  it('fusionne actions, séparateur et segments dans une seule capsule', () => {
    const { container } = render(<CarnetCard {...base()} />);
    const foot = container.querySelector('.ckp-card-foot');
    expect(container.querySelectorAll('.ckp-card-foot')).toHaveLength(1);
    // Conteneur simple : aucun rôle de sélecteur sur la capsule.
    expect(foot?.getAttribute('role')).toBeNull();
    expect([...(foot?.children ?? [])].map((el) => el.className)).toEqual([
      'ckp-actions',
      'ckp-capsule',
    ]);
    expect(foot?.querySelector('.ckp-capsule .ckp-th')?.getAttribute('aria-hidden')).toBe('true');
    // Le sélecteur vit dans la capsule, pas ailleurs dans la carte.
    expect(container.querySelectorAll('.ckp-card > .ckp-tabs')).toHaveLength(0);
    expect(container.querySelectorAll('.ckp-tabs')).toHaveLength(1);
    // Les deux familles de boutons restent distinctes et accessibles.
    expect(foot?.querySelectorAll('.ckp-actions button[aria-label]')).toHaveLength(2);
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

  it('garde tous les comportements des actions du sélecteur', () => {
    const onOpenLikes = vi.fn();
    const onOpenComments = vi.fn();
    render(<CarnetCard {...base({ onOpenLikes, onOpenComments })} />);
    fireEvent.click(screen.getByRole('button', { name: /^J’aime/ }));
    expect(onOpenLikes).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /^Commenter/ }));
    expect(onOpenComments).toHaveBeenCalledOnce();
  });

  it('garde la page Parcours à portée de segment (🗺)', () => {
    const onPageChange = vi.fn();
    render(<CarnetCard {...base({ onPageChange })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Parcours' }));
    expect(onPageChange).toHaveBeenLastCalledWith('parcours');
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
    expect(norm(line?.textContent)).toBe(
      'France / Italie / Suisse · — · 106,4 km · 2 002 m D+ · 26 sept. – 2 oct. 2026',
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

  it('rend une seule lentille, dans la capsule de 2 segments', () => {
    const { container } = render(<CarnetCard {...base()} />);
    expect(container.querySelectorAll('.ckp-th')).toHaveLength(1);
    const node = container.querySelector('.ckp-th');
    expect(node?.parentElement?.className).toContain('ckp-capsule');
    expect(node?.getAttribute('aria-hidden')).toBe('true');
  });

  it('pose la lentille sur le segment actif : Posts 0, Parcours 1', () => {
    const posts = render(<CarnetCard {...base({ page: 'posts' })} />);
    expect(lens(posts.container).i).toBe('0');
    posts.unmount();
    const parcours = render(<CarnetCard {...base({ page: 'parcours' })} />);
    expect(lens(parcours.container).i).toBe('1');
  });

  it('suit la page affichée depuis les boutons hors capsule', () => {
    const likes = render(<CarnetCard {...base({ page: 'likes' })} />);
    expect(lens(likes.container).node?.getAttribute('data-off')).toBe('true');
    expect(screen.getByRole('button', { name: /^J’aime/ }).getAttribute('aria-current')).toBe('page');
    likes.unmount();

    const comments = render(<CarnetCard {...base({ page: 'comments' })} />);
    expect(lens(comments.container).node?.getAttribute('data-off')).toBe('true');
    expect(screen.getByRole('button', { name: /^Commenter/ }).getAttribute('aria-current')).toBe('page');
  });

  it('masque la lentille sur une page sans segment (Gérer, Étapes, Matériel, Nature)', () => {
    for (const page of ['manage', 'etapes', 'materiel', 'nature'] as const) {
      const view = render(<CarnetCard {...base({ page, detail: detail({ isOwner: true }) })} />);
      expect(lens(view.container).node?.getAttribute('data-off')).toBe('true');
      view.unmount();
    }
  });

  it('n’a plus aucune action sans page dans la capsule', () => {
    for (const page of ['posts', 'parcours', 'likes', 'comments'] as const) {
      const view = render(<CarnetCard {...base({ page })} />);
      const labels = [...view.container.querySelectorAll('.ckp-card-foot .ckp-action, .ckp-card-foot .ckp-tabs button')]
        .map((node) => node.getAttribute('aria-label'));
      expect(labels).toEqual(['J’aime, 22', 'Commenter, 3', 'Posts', 'Parcours']);
      view.unmount();
    }
  });

  it('garde les mêmes quatre segments pour le propriétaire et le visiteur', () => {
    for (const isOwner of [false, true]) {
      const view = render(<CarnetCard {...base({ detail: detail({ isOwner }) })} />);
      const labels = [...view.container.querySelectorAll('.ckp-card-foot .ckp-action, .ckp-card-foot .ckp-tabs button')]
        .map((node) => node.getAttribute('aria-label'));
      expect(labels).toEqual(['J’aime, 22', 'Commenter, 3', 'Posts', 'Parcours']);
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
      'Islande · 1 jour · 106,4 km · 2 002 m D+ · 26 sept. – 2 oct. 2026',
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
          }),
        })}
      />,
    );
    /* Aucune donnée réelle : pas de ligne de tirets décorative. */
    expect(container.querySelector('.ckp-place-line')).toBeNull();
  });
});
