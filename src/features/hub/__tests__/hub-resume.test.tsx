// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  ActiveAdventureProvider,
  useActiveAdventure,
  SECTION_RESUME_MAX_AGE_MS,
  readLastSectionsRaw,
} from '../context/ActiveAdventureContext';
import { HubResumeBanner } from '../components/HubResumeBanner';
import type { ActiveAdventureData } from '../context/adventureSchema';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  usePathname: () => '/hub',
}));

// Mock AuthContext to provide stable user
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr_test_123' },
    loading: false,
  }),
}));

// Mock ActiveTripContext
vi.mock('@/features/trips/context/ActiveTripContext', () => ({
  useActiveTrip: () => ({
    userTrips: [],
    reloadUserTrips: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

const sampleSortie: ActiveAdventureData = {
  nature: 'sortie',
  id: 'trip-1',
  slug: 'tour-du-mont-blanc',
  title: 'Tour du Mont-Blanc',
};

describe('Hub Section Resume Behavior (Task L0-3, AUDIT_AS_IS §3.3)', () => {
  it('TEST-RESUME-01: setLastSection stores a timestamped record in localStorage', () => {
    function TestRecorder() {
      const { setLastSection } = useActiveAdventure();
      return (
        <button
          onClick={() => setLastSection('sortie:tour-du-mont-blanc', 'itinerary')}
        >
          Record
        </button>
      );
    }

    render(
      <ActiveAdventureProvider initialAdventure={sampleSortie}>
        <TestRecorder />
      </ActiveAdventureProvider>
    );

    const btn = screen.getByText('Record');
    const beforeTime = Date.now();
    fireEvent.click(btn);
    const afterTime = Date.now();

    const storedRaw = localStorage.getItem('lkdv_adventure_last_section:usr_test_123');
    expect(storedRaw).not.toBeNull();
    const parsed = JSON.parse(storedRaw!);
    expect(parsed['sortie:tour-du-mont-blanc']).toBeDefined();
    expect(parsed['sortie:tour-du-mont-blanc'].sectionId).toBe('itinerary');
    expect(parsed['sortie:tour-du-mont-blanc'].timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(parsed['sortie:tour-du-mont-blanc'].timestamp).toBeLessThanOrEqual(afterTime);
  });

  it('TEST-RESUME-02: handles legacy string format gracefully without error and treats as expired', () => {
    localStorage.setItem(
      'lkdv_adventure_last_section:usr_test_123',
      JSON.stringify({ 'sortie:tour-du-mont-blanc': 'itinerary' })
    );

    const parsed = readLastSectionsRaw('lkdv_adventure_last_section:usr_test_123');
    expect(parsed['sortie:tour-du-mont-blanc']).toEqual({
      sectionId: 'itinerary',
      timestamp: 0,
    });

    render(
      <ActiveAdventureProvider initialAdventure={sampleSortie}>
        <HubResumeBanner adventure={sampleSortie} />
      </ActiveAdventureProvider>
    );

    // Legacy record without timestamp must NOT show resume button
    expect(screen.queryByTestId('hub-resume-button')).toBeNull();
  });

  it('TEST-RESUME-03: renders explicit button "Reprendre : Itinéraire" when visit was < 24h', () => {
    const recentTimestamp = Date.now() - 2 * 3600 * 1000; // 2 hours ago
    localStorage.setItem(
      'lkdv_adventure_last_section:usr_test_123',
      JSON.stringify({
        'sortie:tour-du-mont-blanc': {
          sectionId: 'itinerary',
          timestamp: recentTimestamp,
        },
      })
    );

    render(
      <ActiveAdventureProvider initialAdventure={sampleSortie}>
        <HubResumeBanner adventure={sampleSortie} />
      </ActiveAdventureProvider>
    );

    const button = screen.getByTestId('hub-resume-button');
    expect(button).toBeTruthy();
    expect(button.textContent).toContain('Reprendre : Itinéraire');
    expect(button.getAttribute('href')).toBe('/hub/itineraire');
  });

  it('TEST-RESUME-04: does NOT render button when visit was >= 24h', () => {
    const expiredTimestamp = Date.now() - (24 * 3600 * 1000 + 1000); // 24h and 1s ago
    localStorage.setItem(
      'lkdv_adventure_last_section:usr_test_123',
      JSON.stringify({
        'sortie:tour-du-mont-blanc': {
          sectionId: 'itinerary',
          timestamp: expiredTimestamp,
        },
      })
    );

    render(
      <ActiveAdventureProvider initialAdventure={sampleSortie}>
        <HubResumeBanner adventure={sampleSortie} />
      </ActiveAdventureProvider>
    );

    expect(screen.queryByTestId('hub-resume-button')).toBeNull();
    expect(screen.queryByTestId('hub-resume-banner')).toBeNull();
  });

  it('TEST-RESUME-05: exact boundary at 24 hours is rejected', () => {
    const boundaryTimestamp = Date.now() - SECTION_RESUME_MAX_AGE_MS;
    localStorage.setItem(
      'lkdv_adventure_last_section:usr_test_123',
      JSON.stringify({
        'sortie:tour-du-mont-blanc': {
          sectionId: 'itinerary',
          timestamp: boundaryTimestamp,
        },
      })
    );

    render(
      <ActiveAdventureProvider initialAdventure={sampleSortie}>
        <HubResumeBanner adventure={sampleSortie} />
      </ActiveAdventureProvider>
    );

    expect(screen.queryByTestId('hub-resume-button')).toBeNull();
  });

  it('TEST-RESUME-06: STRICT INVARIANT — zero automatic drawer reopening or redirection on mount', () => {
    const recentTimestamp = Date.now() - 30000; // 30s ago
    localStorage.setItem(
      'lkdv_adventure_last_section:usr_test_123',
      JSON.stringify({
        'sortie:tour-du-mont-blanc': {
          sectionId: 'itinerary',
          timestamp: recentTimestamp,
        },
      })
    );

    render(
      <ActiveAdventureProvider initialAdventure={sampleSortie}>
        <HubResumeBanner adventure={sampleSortie} />
      </ActiveAdventureProvider>
    );

    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByTestId('hub-resume-button')).toBeTruthy();
  });
});
