// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubDrawerHost, type ClubItemData, type ClubMemberData, type ClubOutingData, type ClubGearVaultItem } from '../ClubDrawerHost';
import { ClubIsland } from '../ClubIsland';
import { ClubRuntimeOverlays } from '../ClubRuntimeOverlays';
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

describe('Milestone M1 — ClubDrawerHost, Pure Stats Hub (Tab 0) & Cordée (D05–D08)', () => {
  it('D01: renders pure Statistics Hub in Tab 0 uniquely and shows error/retry states', () => {
    const { unmount } = renderHost();
    // Score de performance rendered strictly ONCE in pane 0.0
    expect(screen.getAllByTestId('club-performance-score-card')).toHaveLength(1);
    expect(screen.getByTestId('club-stats-perf-pane')).toBeTruthy();
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

  it('Tab 0 Statistics adapts strictly by hierarchy tier: visitor vs member vs admin + story permission toggle', () => {
    // 1. Visitor: sees public score + join CTA, NO personal contribution, NO management panel
    const { unmount: unmountVisitor } = renderHost({
      initialTab: 0,
      initialSubTab: 0,
      activeClub: { ...ACTIVE_CLUB, joined: false, role: 'Membre', viewerRole: null },
      currentUserId: null,
    });
    expect(screen.getByTestId('club-stats-visitor-cta')).toBeTruthy();
    expect(screen.queryByTestId('club-stats-my-contribution')).toBeNull();
    unmountVisitor();

    // 2. Regular member: sees my contribution, NO management panel on subTab 3
    const { unmount: unmountMember } = renderHost({
      initialTab: 0,
      initialSubTab: 3,
      activeClub: { ...ACTIVE_CLUB, joined: true, role: 'Membre actif', viewerRole: 'member' },
      currentUserId: 'u-3',
    });
    expect(screen.getByTestId('club-stats-members-pane')).toBeTruthy();
    expect(screen.queryByTestId('club-stats-management-panel')).toBeNull();
    unmountMember();

    // 3. Admin / Founder: sees management panel and member accordion details
    renderHost({
      initialTab: 0,
      initialSubTab: 3,
      activeClub: { ...ACTIVE_CLUB, joined: true, role: 'Fondateur', viewerRole: 'admin' },
      currentUserId: 'u-1',
    });
    expect(screen.getByTestId('club-stats-management-panel')).toBeTruthy();
    const claraRowBtn = within(screen.getByTestId('club-stats-members-pane'))
      .getAllByRole('button')
      .find((b) => b.hasAttribute('aria-expanded') && b.textContent?.includes('Clara Bivouac'));
    expect(claraRowBtn).toBeTruthy();
    fireEvent.click(claraRowBtn!);
    expect(claraRowBtn!.getAttribute('aria-expanded')).toBe('true');
  });

  it('Tab 0 sub-lenses render events/records (0.1), kits/vault (0.2), and header overlays support club_switcher & club_search', () => {
    const { unmount: unmountEv } = renderHost({ initialTab: 0, initialSubTab: 1 });
    expect(screen.getByTestId('club-stats-events-pane')).toBeTruthy();
    expect(within(screen.getByTestId('slot-content')).getAllByText(/Arête des Écrins/).length).toBeGreaterThan(0);
    unmountEv();

    const { unmount: unmountKits } = renderHost({
      initialTab: 0,
      initialSubTab: 2,
      standardKits: [
        { id: 'kit-1', title: 'Kit Alpinisme Club', season: 'Été', totalWeightG: 4100, itemsCount: 5, items: ['Tente'] },
      ],
    });
    expect(screen.getByTestId('club-stats-kits-pane')).toBeTruthy();
    expect(within(screen.getByTestId('slot-content')).getByText('Kit Alpinisme Club')).toBeTruthy();
    unmountKits();

    // Header Option 1 overlays: club_switcher & club_search
    const onSelectClub = vi.fn();
    const onOpenClubDrawer = vi.fn();
    const { rerender } = render(
      <ClubRuntimeOverlays
        overlay={{ kind: 'club_switcher' }}
        onClose={vi.fn()}
        activeClub={ACTIVE_CLUB}
        clubs={CLUBS}
        members={MEMBERS}
        outings={OUTINGS}
        vaultGear={GEAR}
        standardKits={[]}
        challenges={[]}
        posts={POSTS}
        onSelectClub={onSelectClub}
        onToggleJoinClub={vi.fn()}
        onToggleRsvpOuting={vi.fn()}
        onCreateGroupFromOuting={vi.fn()}
        onOpenClubDrawer={onOpenClubDrawer}
        onFlyToCoords={vi.fn()}
        onToast={vi.fn()}
      />,
    );
    expect(screen.getByTestId('club-runtime-overlay-club_switcher')).toBeTruthy();
    expect(screen.getByText('Sentiers pour Tous')).toBeTruthy();

    rerender(
      <ClubRuntimeOverlays
        overlay={{ kind: 'club_search' }}
        onClose={vi.fn()}
        activeClub={ACTIVE_CLUB}
        clubs={CLUBS}
        members={MEMBERS}
        outings={OUTINGS}
        vaultGear={GEAR}
        standardKits={[]}
        challenges={[]}
        posts={POSTS}
        onSelectClub={onSelectClub}
        onToggleJoinClub={vi.fn()}
        onToggleRsvpOuting={vi.fn()}
        onCreateGroupFromOuting={vi.fn()}
        onOpenClubDrawer={onOpenClubDrawer}
        onFlyToCoords={vi.fn()}
        onToast={vi.fn()}
      />,
    );
    const searchInput = screen.getByRole('searchbox', { name: 'Rechercher dans Sentiers pour Tous' });
    fireEvent.change(searchInput, { target: { value: 'ecrin' } });
    fireEvent.click(screen.getByText('Arête des Écrins'));
    expect(onOpenClubDrawer).toHaveBeenCalledWith(2, 0, { outingId: 'out-1' });
  });

  it('D05, D06, D07: Cordée lenses filter members, guides, and availableWeekend binômes accurately using Carnet crew cards', () => {
    const { unmount } = renderHost({ initialTab: 1, initialSubTab: 0 });
    const paneAll = within(screen.getByTestId('slot-content'));
    expect(paneAll.getByText('Clara Bivouac')).toBeTruthy();
    expect(paneAll.getByText('Marc Alpi')).toBeTruthy();
    expect(paneAll.getByText('Léo Nouveau')).toBeTruthy();
    unmount();

    const { unmount: unmountGuides } = renderHost({ initialTab: 1, initialSubTab: 1 });
    const paneGuides = within(screen.getByTestId('slot-content'));
    expect(paneGuides.getByText('Clara Bivouac')).toBeTruthy();
    expect(paneGuides.getByText('Marc Alpi')).toBeTruthy();
    expect(paneGuides.queryByText('Léo Nouveau')).toBeNull();
    expect(paneGuides.queryByText('Référents & Encadrement du club')).toBeNull();
    unmountGuides();

    renderHost({ initialTab: 1, initialSubTab: 2 });
    const paneBinomes = within(screen.getByTestId('slot-content'));
    expect(paneBinomes.getByText('Clara Bivouac')).toBeTruthy();
    expect(paneBinomes.queryByText('Marc Alpi')).toBeNull();
    expect(paneBinomes.getByRole('switch')).toBeTruthy();
  });

  it('D08: clicking a member WITH a role opens 4-lens Carnet-parity member view, while a member WITHOUT a role redirects to profile', () => {
    const onClose = vi.fn();
    const navSpy = vi.fn();
    (window as unknown as { __lkdvNavigateProfile?: (h: string) => void }).__lkdvNavigateProfile = navSpy;

    renderHost({ initialTab: 1, initialSubTab: 0, onClose });

    const paneAll = within(screen.getByTestId('slot-content'));
    // Clicking Léo Nouveau (no special role) redirects directly to profile without opening member drawer
    const leoBtn = paneAll.getByText('Léo Nouveau').closest('button')!;
    fireEvent.click(leoBtn);
    expect(navSpy).toHaveBeenCalledWith('leo_new');

    // Clicking Clara Bivouac (Fondateur role) opens the 4-lens Carnet-style member detail view
    const claraBtn = paneAll.getByText('Clara Bivouac').closest('button')!;
    fireEvent.click(claraBtn);

    // Header stays stationary in topnav outside sliding slot-content pane
    expect(screen.getAllByText('Clara Bivouac').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Cordée' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Perf & Stats' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Sorties' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Sac' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Contributions' })).toBeNull();

    // Pressing Escape must pop the inspected member stack BEFORE calling onClose
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Cordée' })).toBeNull();
    delete (window as unknown as { __lkdvNavigateProfile?: (h: string) => void }).__lkdvNavigateProfile;
  });
});
