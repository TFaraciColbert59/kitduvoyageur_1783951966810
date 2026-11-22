// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubDrawerHost, type ClubItemData, type ClubMemberData, type ClubOutingData, type ClubGearVaultItem } from '../ClubDrawerHost';
import { ClubIsland } from '../ClubIsland';
import type { ClubFeedPostItem } from '../../feed/ClubInlineFeed';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
          limit: async () => ({ data: [], error: null }),
        }),
        or: () => ({
          limit: async () => ({ data: [], error: null }),
        }),
        ilike: () => ({
          limit: async () => ({ data: [], error: null }),
        }),
      }),
    }),
  }),
}));

beforeEach(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const ACTIVE_CLUB: ClubItemData = {
  id: 'club-1',
  slug: 'sentiers-pour-tous',
  name: 'Sentiers pour Tous',
  massif: 'Écrins',
  category: 'Alpinisme & Trail',
  level: 'Tous niveaux',
  membersCount: 42,
  outingsCount: 3,
  totalKm: 64,
  totalDplus: 4200,
  joined: true,
  role: 'Fondateur',
  viewerRole: 'admin',
  visibility: 'public',
  bio: 'Cordées alpines et bivouac responsable.',
  charter: 'Zéro trace et sécurité en cordée.',
  nextOutingTitle: 'Arête des Écrins',
  nextOutingDate: 'Sam 28 nov',
  weatherIso: '2 650 m',
  weatherWind: '15 km/h NO',
  weatherTrail: 'Sec jusqu’à 2 200 m',
  lat: 44.922,
  lng: 6.365,
  coverUrl: '/images/club-ecrins.jpg',
};

const CLUBS: ClubItemData[] = [
  ACTIVE_CLUB,
  {
    ...ACTIVE_CLUB,
    id: 'club-2',
    slug: 'vercors-nordique',
    name: 'Vercors Nordique',
    massif: 'Vercors',
    category: 'Bivouac',
    joined: false,
    role: 'Membre',
    viewerRole: null,
    visibility: 'prive',
    membersCount: 19,
    outingsCount: 1,
    coverUrl: undefined,
  },
  {
    ...ACTIVE_CLUB,
    id: 'club-secret',
    slug: 'secret-club',
    name: 'Cercle Secret Invisibilité',
    massif: 'Alpes',
    joined: false,
    role: 'Membre',
    viewerRole: null,
    visibility: 'secret',
    membersCount: 5,
  },
];

const MEMBERS: ClubMemberData[] = [
  {
    id: 'u-1',
    userId: 'u-1',
    name: 'Clara Bivouac',
    handle: 'clara_bivouac',
    role: 'Fondateur',
    massif: 'Écrins',
    skills: ['Alpinisme', 'Secours'],
    availableWeekend: true,
    seekingObjective: 'Arête Nord du Rateau',
    followed: true,
    isNew7d: false,
    avatarUrl: '/images/clara.jpg',
  },
  {
    id: 'u-2',
    userId: 'u-2',
    name: 'Marc Alpi',
    handle: 'marc_alpi',
    role: 'Guide & Sécurité',
    massif: 'Mont-Blanc',
    skills: ['Glacier', 'DVA'],
    availableWeekend: false,
    followed: false,
    isNew7d: false,
  },
  {
    id: 'u-3',
    userId: 'u-3',
    name: 'Léo Nouveau',
    handle: 'leo_new',
    role: 'Nouveau',
    massif: 'Écrins',
    skills: ['Trail'],
    availableWeekend: true,
    seekingObjective: 'Boucle 20 km col du Lautaret',
    followed: false,
    isNew7d: true,
    avatarUrl: '/images/leo.jpg',
  },
];

const OUTINGS: ClubOutingData[] = [
  {
    id: 'out-1',
    clubId: 'club-1',
    title: 'Arête des Écrins',
    date: 'Sam 28 nov · 06h30',
    massif: 'Écrins',
    km: 18,
    dplus: 1350,
    maxAlt: 3120,
    status: 'upcoming',
    leaderName: 'Clara Bivouac',
    leaderHandle: 'clara_bivouac',
    participantsCount: 4,
    maxParticipants: 8,
    rsvpJoined: true,
    carpoolCity: 'Grenoble',
    carpoolSeatsLeft: 2,
    requiredGear: ['Crampons', 'Piolet'],
    lat: 44.922,
    lng: 6.365,
  },
];

const POSTS: ClubFeedPostItem[] = [
  {
    id: 'post-1',
    clubId: 'club-1',
    kind: 'text',
    pinned: true,
    authorName: 'Clara Bivouac',
    authorHandle: 'clara_bivouac',
    spot: 'Refuge du Glacier Blanc',
    massif: 'Écrins',
    timeAgo: 'il y a 2 h',
    caption: 'Conditions de regel parfaites dès 2 400 m sur les Écrins.',
    likes: 12,
    comments: [],
  },
];

const GEAR: ClubGearVaultItem[] = [
  {
    id: 'gear-1',
    clubId: 'club-1',
    name: 'DVA Barryvox S',
    brand: 'Mammut',
    category: 'Sécurité',
    weightG: 210,
    ownerName: 'Clara Bivouac',
    ownerHandle: 'clara_bivouac',
    available: true,
  },
];

function renderHost(overrides: Partial<React.ComponentProps<typeof ClubDrawerHost>> = {}) {
  return render(
    <ClubDrawerHost
      mode="main"
      isOpen
      initialTab={0}
      initialSubTab={0}
      activeClub={ACTIVE_CLUB}
      clubs={CLUBS}
      members={MEMBERS}
      outings={OUTINGS}
      vaultGear={GEAR}
      standardKits={[]}
      challenges={[]}
      chatMessages={[]}
      posts={POSTS}
      onSelectClub={vi.fn()}
      onToggleJoinClub={vi.fn()}
      onToggleFollowMember={vi.fn()}
      onToggleRsvpOuting={vi.fn()}
      onCreateGroupFromOuting={vi.fn()}
      onDownloadGpx={vi.fn()}
      onFlyToCoords={vi.fn()}
      onToggleReserveGear={vi.fn()}
      onCloneStandardKit={vi.fn()}
      onSendChatMessage={vi.fn()}
      onToggleClubVisibility={vi.fn()}
      onCreatePost={vi.fn()}
      onCreateOuting={vi.fn()}
      onCreateVaultGear={vi.fn()}
      onCreateNewClub={vi.fn()}
      {...overrides}
    />,
  );
}

describe('Milestone M1 — ClubDrawerHost, Explorer (D02–D04) & Cordée (D05–D08)', () => {
  it('D01: renders each SlotShell lens uniquely (FN-19 fix) and shows skeleton/error states', () => {
    const { unmount } = renderHost();
    // "Mes tribus rejointes" is rendered strictly ONCE (pane 0), not duplicated across panes 1 & 2
    expect(screen.getAllByText('Mes tribus rejointes')).toHaveLength(1);
    unmount();

    const onRetry = vi.fn();
    renderHost({ syncStatus: 'error', onRetrySync: onRetry });
    const retryBtn = screen.getByRole('button', { name: 'Réessayer' });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('D01: ClubIsland auto-dismisses after 3.8s and triggers undo callback', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const onUndo = vi.fn();
    render(
      <ClubIsland
        toast={{ id: 't1', message: 'Vous avez quitté le club', subtitle: '3,8 s', undo: onUndo }}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByTestId('club-island')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: "Annuler l'action" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    vi.clearAllTimers();
    render(
      <ClubIsland
        toast={{ id: 't2', message: 'Toast auto' }}
        onDismiss={onDismiss}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(3800);
    });
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('D02 & D03: renders my-clubs (0.0) and hides secret clubs in discover-clubs (0.1)', () => {
    renderHost({ initialTab: 0, initialSubTab: 1 });
    const activePane = within(screen.getByTestId('slot-content'));
    expect(activePane.getByText('Vercors Nordique')).toBeTruthy();
    expect(activePane.queryByText('Cercle Secret Invisibilité')).toBeNull();
  });

  it('D04: search-all (0.2) matches NFD accents, renders posts, and navigates to outing without corrupting tab 0 subTab', () => {
    const { container } = renderHost({ initialTab: 0, initialSubTab: 2 });
    const input = container.querySelector<HTMLInputElement>('[data-autofocus="true"]')!;
    expect(input).toBeTruthy();

    fireEvent.change(input, { target: { value: 'ecrin' } });
    const activePane = within(screen.getByTestId('slot-content'));
    expect(activePane.getByText('Refuge du Glacier Blanc')).toBeTruthy();
    expect(activePane.getByText(/Arête des/)).toBeTruthy();

    // Select outing item from search -> opens Sortie detail (tab 2)
    const outingItem = activePane.getByText(/Arête des/).closest('[cmdk-item]')!;
    expect(outingItem).toBeTruthy();
    fireEvent.click(outingItem);
    expect(within(screen.getByTestId('slot-content')).getByText('Fiche Sortie & Covoiturage')).toBeTruthy();

    // Pop back via Retour -> must return to tab 0 lens 2 (search-all) cleanly
    fireEvent.click(within(screen.getByTestId('slot-content')).getByRole('button', { name: 'Toutes les sorties' }));
    expect(container.querySelector('[data-club-tab="0"][data-club-lens="search-all"]')).toBeTruthy();
  });

  it('D05, D06, D07: Cordée lenses filter newArrivals, guides, and availableWeekend binômes accurately', () => {
    const { unmount } = renderHost({ initialTab: 1, initialSubTab: 0 });
    const paneAll = within(screen.getByTestId('slot-content'));
    expect(paneAll.getByText('Nouveaux dans la tribu')).toBeTruthy();
    expect(paneAll.getAllByText('Léo Nouveau').length).toBeGreaterThan(0);
    unmount();

    const { unmount: unmountGuides } = renderHost({ initialTab: 1, initialSubTab: 1 });
    const paneGuides = within(screen.getByTestId('slot-content'));
    expect(paneGuides.getByText('Clara Bivouac')).toBeTruthy();
    expect(paneGuides.getByText('Marc Alpi')).toBeTruthy();
    expect(paneGuides.queryByText('Léo Nouveau')).toBeNull();
    unmountGuides();

    renderHost({ initialTab: 1, initialSubTab: 2 });
    const paneBinomes = within(screen.getByTestId('slot-content'));
    expect(paneBinomes.getByText('Clara Bivouac')).toBeTruthy();
    expect(paneBinomes.queryByText('Marc Alpi')).toBeNull();
    expect(paneBinomes.getByRole('switch')).toBeTruthy();
  });

  it('D08: clicking a member opens 4-lens inspectedMember stack and Escape pops back to list', () => {
    const onClose = vi.fn();
    renderHost({ initialTab: 1, initialSubTab: 0, onClose });

    const paneAll = within(screen.getByTestId('slot-content'));
    const claraBtn = paneAll.getByRole('button', { name: /Ouvrir la fiche de Clara Bivouac/i });
    fireEvent.click(claraBtn);

    const activeDetailPane = within(screen.getByTestId('slot-content'));
    expect(activeDetailPane.getByText('Aperçu Cordée · Clara Bivouac')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Profil & Stats' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Sorties & Traces' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Équipement' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Publications' })).toBeTruthy();

    // Pressing Escape must pop the inspected member stack BEFORE calling onClose
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText('Aperçu Cordée · Clara Bivouac')).toBeNull();
  });
});
