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

/* Deux vrais jours dérivés : le balayage de la carte a de quoi changer de jour. */
const CARD_DAYS = [
  { index: 1, date: '2026-09-26', distanceKm: 18.4, elevationM: 620, durationS: 21600, moments: [], points: [] },
  { index: 2, date: '2026-09-27', distanceKm: 12, elevationM: 300, durationS: null, moments: [], points: [] },
];

const OWNER = detail({ isOwner: true, etapes: DAYS, days: CARD_DAYS });

/* Le geste horizontal appartient aux jours : un glissement dans la grille
   change de jour, jamais la page du carrousel. */
function pointer(element: Element, type: 'pointerdown' | 'pointerup', x: number, y: number) {
  fireEvent(
    element,
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }),
  );
}

function swipeGrid(fromX: number, toX: number) {
  const pages = document.querySelector('.ckp-pages') as Element;
  pointer(pages, 'pointerdown', fromX, 100);
  pointer(pages, 'pointerup', toX, 105);
}

/* Le clavier du carrousel mène à la même page sans laisser de clic fantôme. */
function keyPages(times: number) {
  for (let i = 0; i < times; i += 1) {
    fireEvent.keyDown(document.querySelector('.ckp-pages') as Element, { key: 'ArrowRight' });
  }
}

/* Les pages sans segment s'ouvrent depuis le menu `···` de la barre du haut. */
function openMenuEntry(label: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Plus d’options' }));
  fireEvent.click(screen.getByRole('button', { name: label }));
}

const dayLabel = () =>
  (document.querySelector('.ckp-daypill-label')?.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ');
const pageId = () => document.querySelector('.ckp-pages')?.getAttribute('id');

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

  it('ouvre le volet Jours et le récit complet depuis « voir plus… »', () => {
    render(<CarnetScreen detail={OWNER} />);
    /* La carte ne garde qu'une ligne : le récit entier n'est pas monté. */
    expect(document.querySelector('.ckp-story')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'voir plus…' }));
    expect(drawerOpen()).toBe(true);
    expect(screen.getByRole('button', { name: 'Jours' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Jours' })).toBeTruthy();
    expect(document.querySelector('.ckp-story')?.textContent).toBe(
      'Dix jours, trois pays, deux bivouacs.',
    );
    /* La carte a cédé la place au drawer : plus de ligne de récit tronquée. */
    expect(document.querySelector('.ckp-bio-line')).toBeNull();
    expect(document.querySelector('.ckp-place-line')).toBeNull();
    expect(document.querySelector('.ckp-dayinfo')).toBeNull();
  });

  it('porte l’allure et le cumul du jour affiché dans le volet Distance', () => {
    render(<CarnetScreen detail={OWNER} />);
    /* La capsule change de jour sans geste : le clic suivant n'est pas avalé. */
    fireEvent.click(screen.getByRole('tab', { name: 'Jour 1' }));
    expect(dayLabel()).toBe('Jour 1 · 26 sept.');
    fireEvent.click(screen.getByRole('button', { name: 'DISTANCE 18,4 km' }));
    const panel = screen.getByRole('tabpanel', { name: 'Distance' });
    const values = [...panel.querySelectorAll('.ckp-field-value')].map((node) => node.textContent);
    /* Le volet d'un jour ne porte que le jour : départ, arrivée, allure, cumul.
       6 h pour 18,4 km : 19,6 min/km, calculée depuis le jour. */
    expect(values).toEqual(['Les Houches', 'Refuge de Bellachat', '19,6 min/km', '18,4 km']);
    /* 106,4 km est le total du carnet : il reste au Résumé. */
    expect(panel.querySelector('.ckp-hero-value')?.textContent).toBe('18,4');
    expect(panel.textContent).not.toContain('106,4');
  });

  it('ouvre le sous-onglet Dénivelé depuis la statistique DÉNIVELÉ', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('button', { name: /^DÉNIVELÉ \+ 2\s002 m$/ }));
    expect(screen.getByRole('button', { name: 'Dénivelé' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Dénivelé' })).toBeTruthy();
  });

  it('la page d’un jour ne peint que les données de ce jour dans les trois volets', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Jour 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'DISTANCE 18,4 km' }));

    const distance = screen.getByRole('tabpanel', { name: 'Distance' });
    expect(distance.querySelector('.ckp-hero-value')?.textContent).toBe('18,4');
    expect(distance.textContent).not.toContain('106,4');

    fireEvent.click(screen.getByRole('button', { name: 'Dénivelé' }));
    const elevation = screen.getByRole('tabpanel', { name: 'Dénivelé' });
    expect(elevation.querySelector('.ckp-hero-value')?.textContent).toBe('620');
    expect(elevation.textContent).not.toContain('2\u202f002');
    expect(elevation.querySelector('.ckp-elev')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Jours' }));
    const days = screen.getByRole('tabpanel', { name: 'Jours' });
    expect([...days.querySelectorAll('.ckp-field-label')].map((node) => node.textContent)).toEqual([
      'jour',
      'date',
    ]);
    expect(days.textContent).not.toContain('26 sept. – 2 oct. 2026');
    /* Le récit global apparaît une seule fois dans le volet du jour. */
    expect(days.querySelectorAll('.ckp-story')).toHaveLength(1);
  });
});

describe('CarnetScreen — les actions du sélecteur sont des pages', () => {
  it('la page J’aime s’ouvre depuis le menu ···, sans drawer', () => {
    render(<CarnetScreen detail={OWNER} />);
    openMenuEntry('J’aime');
    expect(drawerOpen()).toBe(false);
    expect(document.getElementById('carnet-page-likes')).toBeTruthy();
    expect(screen.getByRole('tabpanel', { name: 'J’aime' })).toBeTruthy();
    /* Le contenu réel du volet : la bascule du carnet et l’état vide honnête. */
    expect(screen.getByRole('button', { name: 'J’aime ce carnet' })).toBeTruthy();
    expect(document.querySelector('.ckp-empty-state .ckp-empty-dash')?.textContent).toBe('—');
  });

  it('la bascule J’aime du carnet vit dans la page, plus sur la carte', () => {
    render(<CarnetScreen detail={OWNER} />);
    /* Posts → Étapes → Matériel → Nature → J’aime : quatre pas de clavier. */
    keyPages(4);
    expect(SPIES.toggleLike).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'J’aime ce carnet' }));
    expect(SPIES.toggleLike).toHaveBeenCalledOnce();
  });

  it('la page Commentaires s’ouvre depuis le menu ··· et garde la liste réelle', () => {
    render(<CarnetScreen detail={OWNER} />);
    openMenuEntry('Commentaires');
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
    /* La capsule du bas porte les jours : un segment par page. */
    const segments = document.querySelectorAll('.ckp-card-foot .ckp-tabs button');
    expect(segments).toHaveLength(3);
    expect([...segments].map((node) => node.getAttribute('aria-label'))).toEqual([
      'Résumé',
      'Jour 1',
      'Jour 2',
    ]);
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

  it('chaque segment du bas affiche son jour, sans toucher au carrousel', () => {
    render(<CarnetScreen detail={OWNER} />);
    expect(dayLabel()).toBe('Résumé');
    fireEvent.click(screen.getByRole('tab', { name: 'Jour 2' }));
    expect(dayLabel()).toBe('Jour 2 · 27 sept.');
    expect(pageId()).toBe('carnet-page-posts');
    fireEvent.click(screen.getByRole('tab', { name: 'Jour 1' }));
    expect(dayLabel()).toBe('Jour 1 · 26 sept.');
    fireEvent.click(screen.getByRole('tab', { name: 'Résumé' }));
    expect(dayLabel()).toBe('Résumé');
    expect(pageId()).toBe('carnet-page-posts');
  });

  it('la lentille du sélecteur suit le jour affiché', () => {
    render(<CarnetScreen detail={OWNER} />);
    const lens = () => document.querySelector('.ckp-th') as HTMLElement | null;
    expect(lens()?.style.getPropertyValue('--i')).toBe('0');
    fireEvent.click(screen.getByRole('tab', { name: 'Jour 2' }));
    expect(lens()?.style.getPropertyValue('--i')).toBe('2');
    expect(document.querySelectorAll('.ckp-th')).toHaveLength(1);
  });

  it('un glissement dans la grille change de jour, la page Posts reste affichée', () => {
    render(<CarnetScreen detail={OWNER} />);
    expect(dayLabel()).toBe('Résumé');
    swipeGrid(300, 180);
    expect(dayLabel()).toBe('Jour 1 · 26 sept.');
    expect(pageId()).toBe('carnet-page-posts');
    expect(screen.getByRole('tab', { name: 'Jour 1' }).getAttribute('aria-selected')).toBe('true');
    /* Le geste inverse revient au Résumé, jamais à une page du carrousel. */
    swipeGrid(120, 260);
    expect(dayLabel()).toBe('Résumé');
    expect(pageId()).toBe('carnet-page-posts');
  });

  it('un glissement dans la carte ne sort jamais des bornes de jours', () => {
    render(<CarnetScreen detail={OWNER} />);
    /* À droite sur le Résumé : aucun jour avant. */
    swipeGrid(120, 260);
    expect(dayLabel()).toBe('Résumé');
    /* Deux jours : deux pas mènent au dernier, le troisième ne bouge plus. */
    swipeGrid(300, 180);
    swipeGrid(300, 180);
    expect(dayLabel()).toBe('Jour 2 · 27 sept.');
    swipeGrid(300, 180);
    expect(dayLabel()).toBe('Jour 2 · 27 sept.');
    expect(pageId()).toBe('carnet-page-posts');
  });

  it('ouvre la page Étapes depuis le titre et la garde, sans page Parcours', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('button', { name: /^Carnet / }));
    expect(pageId()).toBe('carnet-page-etapes');
    /* La page qui portait la carte interne n'existe plus. */
    expect(document.getElementById('carnet-page-parcours')).toBeNull();
    expect(document.querySelector('.ckp-pages .leaflet-container')).toBeNull();
    /* Le GPX reste téléchargeable depuis cette page. */
    expect(screen.getByRole('button', { name: 'Télécharger le GPX' })).toBeTruthy();
  });

  it('la couverture de la carte ouvre le même volet que le titre', () => {
    render(<CarnetScreen detail={OWNER} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le carnet' }));
    expect(pageId()).toBe('carnet-page-etapes');
  });
});

describe('CarnetScreen — fond identique à la page Compte', () => {
  it('ne peint aucune photo de fond : la toile du Compte reste seule', () => {
    render(<CarnetScreen detail={detail()} />);
    expect(document.querySelector('.ckp-screen-bg')).toBeNull();
    expect(document.querySelector('.ckp-screen')).toBeTruthy();
  });
});

describe('CarnetScreen — focus rendu au déclencheur (lot F)', () => {
  it('rend le focus à la statistique qui a ouvert la feuille, après Échap', async () => {
    render(<CarnetScreen detail={OWNER} />);
    const trigger = document.querySelector('.ckp-stat[data-stat="distance"]') as HTMLElement;
    expect(trigger).toBeTruthy();
    trigger.focus();
    fireEvent.click(trigger);
    expect(drawerOpen()).toBe(true);
    /* La fermeture joue la sortie de 160 ms, puis la carte est remontée. */
    fireEvent.keyDown(document, { key: 'Escape' });
    await new Promise((resolve) => setTimeout(resolve, 200));
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
    expect(drawerOpen()).toBe(false);
    const again = document.querySelector('.ckp-stat[data-stat="distance"]') as HTMLElement;
    expect(again).toBeTruthy();
    expect(document.activeElement).toBe(again);
  });
});
