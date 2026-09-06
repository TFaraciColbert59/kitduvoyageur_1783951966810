import { describe, it, expect } from 'vitest';
import {
  getCurrentStepForDay,
  formatEmergencyCoordinates,
} from '@/features/trips/components/TripLiveCockpitView';
import type { TripStep } from '@/features/trips/types/trip.types';

describe('Phase 5.3 — Mode Vivre (Terrain)', () => {
  const mockSteps: TripStep[] = [
    {
      id: 'step-1',
      trip_id: 'trip-1',
      day_number: 1,
      order_index: 0,
      title: 'Départ Saint-Martin-Vésubie vers Refuge de la Madone',
      description: 'Montée régulière en sous-bois',
      location_name: 'Saint-Martin-Vésubie',
      latitude: 44.068,
      longitude: 7.256,
      accommodation_name: 'Refuge de la Madone',
      transport_mode: 'foot',
      distance_km: 12.5,
      elevation_gain_m: 950,
      elevation_loss_m: 50,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'step-2',
      trip_id: 'trip-1',
      day_number: 2,
      order_index: 1,
      title: 'Refuge de la Madone vers Refuge de Nice',
      description: 'Passage par le col de Fenestre',
      location_name: 'Col de Fenestre',
      latitude: 44.112,
      longitude: 7.354,
      accommodation_name: 'Refuge de Nice',
      transport_mode: 'foot',
      distance_km: 14.2,
      elevation_gain_m: 1100,
      elevation_loss_m: 700,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ];

  it('selects the correct step for the active day number', () => {
    const step1 = getCurrentStepForDay(mockSteps, 1);
    expect(step1?.title).toContain('Saint-Martin-Vésubie');

    const step2 = getCurrentStepForDay(mockSteps, 2);
    expect(step2?.location_name).toContain('Col de Fenestre');

    const fallback = getCurrentStepForDay(mockSteps, 99);
    expect(fallback?.day_number).toBe(2); // Falls back to last step
  });

  it('formats emergency coordinates clearly for radio/phone transmission', () => {
    const formatted = formatEmergencyCoordinates(44.06812, 7.25611);
    expect(formatted).toBe('44.0681° N, 7.2561° E');

    const southWest = formatEmergencyCoordinates(-21.12346, -55.56789);
    expect(southWest).toBe('21.1235° S, 55.5679° W');

    expect(formatEmergencyCoordinates(null, null)).toBe('Coordonnées non disponibles');
  });
});
