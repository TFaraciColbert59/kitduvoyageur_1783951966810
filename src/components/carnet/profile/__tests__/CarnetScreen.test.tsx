// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CarnetScreen } from '../CarnetScreen';
import { detail } from './fixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      insert: async () => ({ error: null }),
      upsert: async () => ({ error: null }),
      delete: async () => ({ error: null }),
      select: async () => ({ data: [], error: null }),
    }),
  }),
}));

const SPIES = vi.hoisted(() => ({
  toggleLike: vi.fn(),
  toggleFavorite: vi.fn(),
  registerView: vi.fn(),
}));

vi.mock('@/features/carnet/detail/useCarnetEngagement', () => ({
  useCarnetEngagement: () => ({
    liked: false,
    likes: 22,
    favorited: false,
    favorites: 0,
    toggleLike: SPIES.toggleLike,
    toggleFavorite: SPIES.toggleFavorite,
    registerView: SPIES.registerView,
  }),
}));

vi.mock('@/features/carnet/detail/useCarnetComments', () => ({
  useCarnetComments: () => ({
    comments: [
      {
        id: 'k1',
        authorId: 'u9',
        authorName: 'Noé Vidal',
        authorAvatar: null,
        content: 'Bivouac validé, merci pour l’itinéraire.',
        createdAt: '2026-10-01T10:00:00.000Z',
      },
    ],
    loading: false,
    send: vi.fn(async () => true),
    remove: vi.fn(async () => true),
  }),
}));

vi.mock('@/components/account/AccountBottomBar', () => ({
  AccountBottomBar: () => <div data-testid="bottom-bar" />,
}));

vi.mock('@/features/community/feed/useAccountUnreadCount', () => ({
  useAccountUnreadCount: () => 0,
}));

/* MapLibre n'a pas sa place dans jsdom : la carte du bas est remplacée. */
vi.mock('../CarnetMapCard', () => ({
  CarnetMapCard: () => <div data-testid="map-card" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const DAYS = [
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
];

const OWNER = detail({ isOwner: true, etapes: DAYS });

/* Le carrousel garde son geste : c'est lui qui mène aux pages J’aime et
   Commentaires depuis que ♥ et 💬 ont quitté la carte. */
function pointer(element: Element, type: 'pointerdown' | 'pointerup', x: number, y: number) {
  fireEvent(
    element,
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }),
  );
}

function swipePages(times: number) {
  for (let i = 0; i < times; i += 1) {
    const pages = document.querySelector('.ckp-pages') as Element;
    pointer(pages, 'pointerdown', 300, 100);
    pointer(pages, 'pointerup', 180, 105);
  }
}

/* Le clavier du carrousel mène à la même page sans laisser de clic fantôme. */
function keyPages(times: number) {
  for (let i = 0; i < times; i += 1) {
    fireEvent.keyDown(document.querySelector('.ckp-pages') as Element, { key: 'ArrowRight' });
  }
}

function drawerOpen() {
  return screen.queryByRole('region', { name: 'Panneau du carnet' }) !== null;
}

describe('CarnetScreen — drawer réduit à ce qui n’est pas dans le sélecteur', () => {
  it('ne garde que Statistiques et Partage pour le propriétaire', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('button', { name: 'JOURS 7' }));
    const labels = screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'));
    expect(labels).toEqual(['Statistiques', 'Partage']);
    expect(screen.getByRole('tab', { name: 'Statistiques' }).getAttribute('aria-selected')).toBe('true');
    /* Les volets devenus des pages ne sont plus des onglets du drawer. */
    expect(screen.queryByRole('tab', { name: 'Commentaires' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'J’aime' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Gérer' })).toBeNull();
  });

  it('ouvre le sous-onglet Jours depuis la statistique JOURS', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('button', { name: 'JOURS 7' }));
    expect(screen.getByRole('button', { name: 'Jours' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Jours' })).toBeTruthy();
    expect(screen.getByText('Nuit · Refuge de Bellachat')).toBeTruthy();
  });

  it('ouvre le sous-onglet Distance depuis la statistique DISTANCE', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('button', { name: 'DISTANCE 106,4 km' }));
    expect(screen.getByRole('button', { name: 'Distance' }).getAttribute('aria-pressed')).toBe('true');
    const panel = screen.getByRole('tabpanel', { name: 'Distance' });
    expect(panel.querySelector('.ckp-hero-value')?.textContent).toBe('106,4');
    expect(panel.querySelector('.ckp-hero-unit')?.textContent).toBe('km');
  });

  it('ouvre le sous-onglet Dénivelé depuis la statistique DÉNIVELÉ', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('button', { name: /^DÉNIVELÉ \+ 2\s002 m$/ }));
    expect(screen.getByRole('button', { name: 'Dénivelé' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Dénivelé' })).toBeTruthy();
  });
});

describe('CarnetScreen — les actions du sélecteur sont des pages', () => {
  it('la page J’aime reste accessible par le carrousel, sans drawer', () => {
    render(<CarnetScreen detail={OWNER} />);
    swipePages(5);
    expect(drawerOpen()).toBe(false);
    expect(document.getElementById('carnet-page-likes')).toBeTruthy();
    expect(screen.getByRole('tabpanel', { name: 'J’aime' })).toBeTruthy();
    /* Le contenu réel du volet : la bascule du carnet et l’état vide honnête. */
    expect(screen.getByRole('button', { name: 'J’aime ce carnet' })).toBeTruthy();
    expect(document.querySelector('.ckp-empty-state .ckp-empty-dash')?.textContent).toBe('—');
  });

  it('la bascule J’aime du carnet vit dans la page, plus sur la carte', () => {
    render(<CarnetScreen detail={OWNER} />);
    keyPages(5);
    expect(SPIES.toggleLike).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'J’aime ce carnet' }));
    expect(SPIES.toggleLike).toHaveBeenCalledOnce();
  });

  it('la page Commentaires garde la liste réelle et le champ d’envoi', () => {
    render(<CarnetScreen detail={OWNER} />);
    swipePages(6);
    expect(drawerOpen()).toBe(false);
    expect(document.getElementById('carnet-page-comments')).toBeTruthy();
    expect(screen.getByText('Bivouac validé, merci pour l’itinéraire.')).toBeTruthy();
    /* Visiteur : la porte reste un geste, jamais une phrase. */
    expect(screen.getByRole('button', { name: 'Se connecter pour commenter' })).toBeTruthy();
  });

  it('le menu ··· vit dans la barre du haut, dernière position', () => {
    render(<CarnetScreen detail={OWNER} />);
    const more = screen.getByRole('button', { name: 'Plus d’options' });
    expect(more.closest('.ckp-topbar')).toBeTruthy();
    expect(more.closest('.ckp-more-anchor')).toBeTruthy();
    /* Le sélecteur du bas a deux segments : ▦, 🗺 — la capsule des drawers. */
    const segments = document.querySelectorAll('.ckp-card-foot .ckp-tabs button');
    expect(segments).toHaveLength(2);
    expect(document.querySelectorAll('.ckp-card-foot .ckp-action')).toHaveLength(0);
    expect(document.querySelector('.ckp-card-foot .ckp-more-anchor')).toBeNull();
    /* La loupe a disparu de la barre : le `···` prend sa place. */
    expect(screen.queryByRole('button', { name: /Rechercher/ })).toBeNull();
  });

  it('le menu ··· reste un menu contextuel, jamais un drawer', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('button', { name: 'Plus d’options' }));
    expect(drawerOpen()).toBe(false);
    expect(document.querySelector('.pmi-options-menu')?.hasAttribute('hidden')).toBe(false);
  });

  it('le menu ··· mène à la page Gérer, pas à un volet', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('button', { name: 'Plus d’options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gérer le carnet' }));
    expect(drawerOpen()).toBe(false);
    expect(document.getElementById('carnet-page-manage')).toBeTruthy();
  });

  it('🔖 Enregistrer quitte la capsule et reste dans le menu ···', () => {
    render(<CarnetScreen detail={OWNER} />);
    /* Plus aucun segment Enregistrer dans la capsule. */
    expect(
      document.querySelector('.ckp-card-foot [data-icon="bookmark"]'),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Plus d’options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(SPIES.toggleFavorite).toHaveBeenCalledOnce();
    expect(drawerOpen()).toBe(false);
    expect(document.querySelector('.ckp-pages')?.getAttribute('id')).toBe('carnet-page-posts');
  });

  it('chaque segment ouvre sa page : ▦, 🗺', () => {
    render(<CarnetScreen detail={OWNER} />);
    const header = () => document.querySelector('.ckp-pages')?.getAttribute('id');
    fireEvent.click(screen.getByRole('tab', { name: 'Parcours' }));
    expect(header()).toBe('carnet-page-parcours');
    fireEvent.click(screen.getByRole('tab', { name: 'Posts' }));
    expect(header()).toBe('carnet-page-posts');
  });

  it('le carrousel mène encore aux pages sans segment : J’aime, Commentaires', () => {
    render(<CarnetScreen detail={OWNER} />);
    const header = () => document.querySelector('.ckp-pages')?.getAttribute('id');
    swipePages(5);
    expect(header()).toBe('carnet-page-likes');
    swipePages(1);
    expect(header()).toBe('carnet-page-comments');
  });

  it('garde la page active et ses voisines swipables', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Parcours' }));
    expect(screen.getByRole('tab', { name: 'Parcours' }).getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('carnet-page-parcours')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Posts' }));
    expect(screen.getByRole('tab', { name: 'Posts' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Posts' }));
    expect(screen.getByRole('tab', { name: 'Posts' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('CarnetScreen — fond identique à la page Compte', () => {
  it('ne peint aucune photo de fond : la toile du Compte reste seule', () => {
    render(<CarnetScreen detail={detail()} />);
    expect(document.querySelector('.ckp-screen-bg')).toBeNull();
    expect(document.querySelector('.ckp-screen')).toBeTruthy();
  });
});
