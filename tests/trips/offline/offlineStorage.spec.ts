import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveTripOffline,
  getOfflineTrip,
  removeOfflineTrip,
  isTripAvailableOffline,
  listOfflineTrips,
} from '@/features/trips/offline/tripOfflineStorage';
import type { TripFull } from '@/features/trips/types/trip.types';

describe('tripOfflineStorage — Chantier 7', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => mockStore[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStore[key];
      }),
      clear: vi.fn(() => {
        mockStore = {};
      }),
    };
    vi.stubGlobal('localStorage', localStorageMock);
  });

  const dummyTrip: TripFull = {
    id: 't-123',
    slug: 'trek-annapurna',
    title: 'Tour des Annapurnas',
    description: 'Trek au Népal avec cols à 5416m',
    destination_country_code: 'NP',
    destination_name: 'Népal',
    start_date: '2026-10-01',
    end_date: '2026-10-18',
    status: 'planned',
    visibility: 'public',
    difficulty: 'expert',
    primary_activity: 'trekking',
    estimated_budget: 1500,
    budget_currency: 'EUR',
    cover_image_url: null,
    user_id: 'user-1',
    group_id: null,
    share_token: 'tok-abc',
    metadata: {},
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
    collaborators: [],
    steps: [],
    items: [],
    expenses: [],
    documents: [],
    pois: [],
    safety_checkpoints: [],
    notes: [],
    permissions: {
      canEdit: true,
      canDelete: true,
      canInvite: true,
      canManageBudget: true,
      canViewDocuments: true,
    },
  };

  it('sauvegarde un voyage hors-ligne et l\'enregistre dans le manifeste', () => {
    const success = saveTripOffline(dummyTrip);
    expect(success).toBe(true);

    expect(isTripAvailableOffline('trek-annapurna')).toBe(true);

    const retrieved = getOfflineTrip('trek-annapurna');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('t-123');
    expect(retrieved?.title).toBe('Tour des Annapurnas');

    const manifest = listOfflineTrips();
    expect(manifest).toHaveLength(1);
    expect(manifest[0].slug).toBe('trek-annapurna');
    expect(manifest[0].countryCode).toBe('NP');
  });

  it('supprime un voyage hors-ligne et met à jour le manifeste', () => {
    saveTripOffline(dummyTrip);
    expect(isTripAvailableOffline('trek-annapurna')).toBe(true);

    removeOfflineTrip('trek-annapurna');
    expect(isTripAvailableOffline('trek-annapurna')).toBe(false);
    expect(getOfflineTrip('trek-annapurna')).toBeNull();
    expect(listOfflineTrips()).toHaveLength(0);
  });

  it('retourne null pour un voyage inexistant sans crasher', () => {
    expect(getOfflineTrip('voyage-inexistant')).toBeNull();
    expect(isTripAvailableOffline('voyage-inexistant')).toBe(false);
  });
});
