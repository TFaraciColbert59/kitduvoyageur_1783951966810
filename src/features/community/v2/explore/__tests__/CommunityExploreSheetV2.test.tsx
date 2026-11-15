// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const haptic = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ haptic, triggerHaptic: haptic, vibrate: vi.fn() }),
}));
vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => ({ isOnline: true, lastOnline: null }),
}));
vi.mock('../useNearMe', () => ({
  useNearMe: () => ({ state: 'idle', point: null, request: async () => null }),
}));

const fixtures = vi.hoisted(() => {
  const carnet = {
    id: 'c1',
    title: 'Tour des Écrins',
    destination: 'Hauts-Alpes',
    coverImage: null,
    coverAlt: null,
    days: 4,
    distanceKm: 62.4,
    elevationGainM: 3200,
    author: { id: 'u1', name: 'Camille', initials: 'C', handle: null, avatarUrl: null },
    likesCount: 12,
    commentsCount: 2,
    likedByMe: false,
    travelers: [],
    travelersTotal: 1,
    isLive: false,
    verifiedGps: false,
    startDate: '2026-11-01',
    endDate: '2026-11-04',
    visibility: 'public',
    distanceKmFromMe: null,
    routeTrace: null,
  };
  const club = {
    id: 'k1',
    slug: 'la-cordee',
    name: 'La Cordée du Vercors',
    description: '',
    category: 'rando',
    emoji: null,
    activities: ['rando'],
    privacy: 'open',
    coverImage: null,
    coverColor: null,
    crestSeed: 'k1',
    membersCount: 12,
    myStatus: 'none',
    eventsThisMonth: 2,
    lastPostAt: null,
    distanceKmFromMe: null,
    zoneLabel: 'Grenoble',
    friends: [],
    friendsTotal: 0,
    rules: null,
    joinQuestions: [],
  };
  const event = {
    id: 'e1',
    title: 'Footing de la Bastille',
    activity: 'Trail',
    startsAt: '2026-11-14T08:00:00+01:00',
    endsAt: '2026-11-14T09:30:00+01:00',
    eventDate: '2026-11-14',
    location: 'Grenoble',
    meetingPoint: null,
    level: 'facile',
    distanceKm: 7,
    elevationGainM: 260,
    duration: '1 h 30',
    coverImage: null,
    coverAlt: null,
    maxParticipants: 20,
    currentParticipants: 6,
    spotsLeft: 14,
    waitlistEnabled: false,
    myStatus: 'none',
    organizer: { id: 'u9', name: 'Nora', initials: 'N', handle: null, avatarUrl: null },
    participants: [],
    participantsTotal: 6,
    clubId: null,
    clubName: null,
    kitId: null,
    description: null,
    safetyNotes: null,
    safetyChecklist: [],
    recurrence: null,
    past: false,
    distanceKmFromMe: null,
  };
  const feed = <T,>(items: T[]) => ({
    items,
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    refresh: vi.fn(),
    loadMore: vi.fn(),
    update: vi.fn(),
  });
  return { carnet, club, event, feed };
});

vi.mock('../../data/useCarnetsFeed', () => ({ useCarnetsFeed: () => fixtures.feed([fixtures.carnet]) }));
vi.mock('../../data/useClubsFeed', () => ({ useClubsFeed: () => fixtures.feed([fixtures.club]) }));
vi.mock('../../data/useEventsFeed', () => ({ useEventsFeed: () => fixtures.feed([fixtures.event]) }));
vi.mock('../../data/useEventAgenda', () => ({
  useEventAgenda: () => ({ counts: {}, loading: false, error: null, retry: vi.fn() }),
}));
vi.mock('../../data/useCommunitySearch', () => ({
  useCommunitySearch: () => ({
    results: [],
    trending: [],
    loading: false,
    trendingLoading: false,
    error: null,
    hasQuery: false,
    retry: vi.fn(),
  }),
}));

import { CommunityExploreSheetV2 } from '../CommunityExploreSheetV2';

afterEach(() => {
  cleanup();
  push.mockClear();
  haptic.mockClear();
});

function renderSheet(
  props: Partial<React.ComponentProps<typeof CommunityExploreSheetV2>> = {},
): ReturnType<typeof render> {
  return render(
    <CommunityExploreSheetV2
      open
      initialTab="carnets"
      initialSearch={false}
      user={null}
      onClose={() => {}}
      onRequireAuth={() => {}}
      {...props}
    />,
  );
}

describe('CommunityExploreSheetV2', () => {
  it('monte la coque, la capsule 4 volets et le volet mémorisé', async () => {
    renderSheet();
    await waitFor(() => expect(screen.getByTestId('communaute-v2-explore')).toBeTruthy());
    const tabs = screen.getAllByRole('tab');
    // Capsule (4) + mini-capsule (filtres du volet actif).
    expect(tabs.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByTestId('cv2-pane-carnets')).toBeTruthy();
    expect(screen.getByTestId('cv2-tile-carnet').getAttribute('data-id')).toBe('c1');
  });

  it('change de volet par la capsule (Clubs puis Sorties)', async () => {
    renderSheet();
    await waitFor(() => expect(screen.getByTestId('communaute-v2-explore')).toBeTruthy());
    const clubsTab = screen.getByRole('tab', { name: 'Clubs' });
    fireEvent.click(clubsTab);
    await waitFor(() => expect(screen.getByTestId('cv2-tile-club')).toBeTruthy());
    fireEvent.click(screen.getByRole('tab', { name: 'Sorties' }));
    await waitFor(() => expect(screen.getByTestId('cv2-tile-sortie')).toBeTruthy());
  });

  it('un invité qui rejoint un club passe par requireAuth (aucune écriture)', async () => {
    const onRequireAuth = vi.fn();
    renderSheet({ onRequireAuth });
    await waitFor(() => expect(screen.getByTestId('communaute-v2-explore')).toBeTruthy());
    fireEvent.click(screen.getByRole('tab', { name: 'Clubs' }));
    await waitFor(() => expect(screen.getByTestId('cv2-club-join')).toBeTruthy());
    fireEvent.click(screen.getByTestId('cv2-club-join'));
    expect(onRequireAuth).toHaveBeenCalledTimes(1);
  });

  it('expose le menu de tri (Carnets) et les filtres en mini-capsule', async () => {
    renderSheet();
    await waitFor(() => expect(screen.getByTestId('cv2-sort-button')).toBeTruthy());
    expect(screen.getByTestId('cv2-mini-capsule')).toBeTruthy();
    fireEvent.click(screen.getByTestId('cv2-sort-button'));
    expect(screen.getByTestId('cv2-sort-menu')).toBeTruthy();
    expect(screen.getByRole('menuitemradio', { name: 'Populaires' })).toBeTruthy();
  });
});
