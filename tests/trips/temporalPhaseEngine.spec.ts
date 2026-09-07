import { describe, it, expect } from 'vitest';
import {
  getTripPhase,
  getTripPhaseDetails,
  isValidTripPhase,
  getPhaseLabel,
  getPhaseDescription,
  type TripPhase,
} from '@/features/trips/engine/temporalPhaseEngine';
import type { Trip } from '@/features/trips/types/trip.types';

describe('Phase 5.1 — Moteur des 3 Phases Temporelles (Préparer / Vivre / Raconter)', () => {
  const createMockTrip = (overrides: Partial<Trip> = {}): Trip => ({
    id: 'trip-test-1',
    slug: 'trek-test',
    title: 'Trek du Mercantour',
    description: 'Test trek',
    destination_country_code: 'FR',
    destination_name: 'Mercantour',
    start_date: '2026-07-10',
    end_date: '2026-07-15',
    status: 'planned',
    visibility: 'private',
    difficulty: 'moderate',
    primary_activity: 'hiking',
    estimated_budget: 450,
    budget_currency: 'EUR',
    cover_image_url: null,
    user_id: 'user-1',
    group_id: null,
    share_token: null,
    metadata: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  });

  describe('getTripPhase()', () => {
    it('returns "prepare" when now is before start_date (voyage lointain ou futur)', () => {
      const trip = createMockTrip({ start_date: '2026-07-10', end_date: '2026-07-15' });
      expect(getTripPhase(trip, '2026-06-01')).toBe('prepare');
      expect(getTripPhase(trip, '2026-07-09')).toBe('prepare');
    });

    it('returns "live" on start_date (borne début incluse)', () => {
      const trip = createMockTrip({ start_date: '2026-07-10', end_date: '2026-07-15' });
      expect(getTripPhase(trip, '2026-07-10')).toBe('live');
    });

    it('returns "live" strictly during the trip', () => {
      const trip = createMockTrip({ start_date: '2026-07-10', end_date: '2026-07-15' });
      expect(getTripPhase(trip, '2026-07-12')).toBe('live');
      expect(getTripPhase(trip, '2026-07-14')).toBe('live');
    });

    it('returns "live" on end_date (borne fin incluse)', () => {
      const trip = createMockTrip({ start_date: '2026-07-10', end_date: '2026-07-15' });
      expect(getTripPhase(trip, '2026-07-15')).toBe('live');
    });

    it('returns "recount" when now is after end_date (voyage passé)', () => {
      const trip = createMockTrip({ start_date: '2026-07-10', end_date: '2026-07-15' });
      expect(getTripPhase(trip, '2026-07-16')).toBe('recount');
      expect(getTripPhase(trip, '2026-12-31')).toBe('recount');
    });

    it('handles a 1-day trip correctly (start_date === end_date)', () => {
      const trip = createMockTrip({ start_date: '2026-08-20', end_date: '2026-08-20' });
      expect(getTripPhase(trip, '2026-08-19')).toBe('prepare');
      expect(getTripPhase(trip, '2026-08-20')).toBe('live');
      expect(getTripPhase(trip, '2026-08-21')).toBe('recount');
    });

    it('handles trips without dates gracefully (defaults to "prepare")', () => {
      const tripNoDates = createMockTrip({ start_date: null, end_date: null });
      expect(getTripPhase(tripNoDates, '2026-07-10')).toBe('prepare');

      const tripStartDateOnly = createMockTrip({ start_date: '2026-07-10', end_date: null });
      expect(getTripPhase(tripStartDateOnly, '2026-07-05')).toBe('prepare');
      expect(getTripPhase(tripStartDateOnly, '2026-07-10')).toBe('live');
      expect(getTripPhase(tripStartDateOnly, '2026-07-15')).toBe('live');
    });

    it('honors explicit trip status overrides', () => {
      // Completed trip is always recount even if end_date is in the future
      const tripCompleted = createMockTrip({
        start_date: '2026-09-01',
        end_date: '2026-09-20',
        status: 'completed',
      });
      expect(getTripPhase(tripCompleted, '2026-09-05')).toBe('recount');

      // Z-D18 : A future trip is never live before start_date, even if status is active
      const tripActive = createMockTrip({
        start_date: '2026-09-10',
        end_date: '2026-09-20',
        status: 'active',
      });
      expect(getTripPhase(tripActive, '2026-09-05')).toBe('prepare');
      // When start_date arrives, active trip is live
      expect(getTripPhase(tripActive, '2026-09-10')).toBe('live');
    });

    it('accepts Date objects as now parameter', () => {
      const trip = createMockTrip({ start_date: '2026-07-10', end_date: '2026-07-15' });
      const dateLive = new Date('2026-07-12T14:30:00Z');
      expect(getTripPhase(trip, dateLive)).toBe('live');
    });
  });

  describe('getTripPhaseDetails()', () => {
    it('computes accurate dayIndex during live phase', () => {
      const trip = createMockTrip({ start_date: '2026-07-10', end_date: '2026-07-15' });
      const detailsDay1 = getTripPhaseDetails(trip, '2026-07-10');
      expect(detailsDay1.phase).toBe('live');
      expect(detailsDay1.dayIndex).toBe(1);
      expect(detailsDay1.totalDays).toBe(6);
      expect(detailsDay1.daysUntilStart).toBe(0);

      const detailsDay3 = getTripPhaseDetails(trip, '2026-07-12');
      expect(detailsDay3.dayIndex).toBe(3);
    });

    it('computes daysUntilStart during prepare phase', () => {
      const trip = createMockTrip({ start_date: '2026-07-10', end_date: '2026-07-15' });
      const details = getTripPhaseDetails(trip, '2026-07-03');
      expect(details.phase).toBe('prepare');
      expect(details.daysUntilStart).toBe(7);
      expect(details.dayIndex).toBeNull();
    });
  });

  describe('Utility helpers', () => {
    it('validates phase types with isValidTripPhase', () => {
      expect(isValidTripPhase('prepare')).toBe(true);
      expect(isValidTripPhase('live')).toBe(true);
      expect(isValidTripPhase('recount')).toBe(true);
      expect(isValidTripPhase('overview')).toBe(false);
      expect(isValidTripPhase(null)).toBe(false);
      expect(isValidTripPhase(undefined)).toBe(false);
    });

    it('returns human labels and descriptions', () => {
      expect(getPhaseLabel('prepare')).toBe('Préparer');
      expect(getPhaseLabel('live')).toBe('Vivre');
      expect(getPhaseLabel('recount')).toBe('Raconter');

      expect(getPhaseDescription('prepare')).toContain('Itinéraire');
      expect(getPhaseDescription('live')).toContain('Cockpit');
      expect(getPhaseDescription('recount')).toContain('Carnet');
    });
  });
});
