import { describe, expect, it } from 'vitest';
import {
  cleanOutingTitle,
  computeOutingRouteAnalysis,
  haversineKm,
} from '../outing/outingUtils';
import type { ClubOutingData } from '../ClubDrawerTypes';

const BASE_OUTING: ClubOutingData = {
  id: '00000000-0000-4000-8000-000000000001',
  clubId: 'db8623d4-fc9b-4c39-ae3a-c93daf2a5075',
  title: 'Circuit de Leschaux — Lac d’Annecy & Bauges (55.9 km · +865 m)',
  date: '2026-12-05',
  massif: 'Bauges · Lac d’Annecy',
  km: 55.9,
  dplus: 865,
  maxAlt: 944,
  status: 'upcoming',
  leaderName: 'Victor Anselme',
  leaderHandle: 'victor_anselme',
  participantsCount: 14,
  maxParticipants: 20,
  rsvpJoined: false,
  carpoolCity: 'Annecy',
  carpoolSeatsLeft: 3,
  requiredGear: ['Chaussures crantées', 'Veste imperméable'],
  lat: 45.82,
  lng: 6.12,
  routeTrace: [
    [6.12, 45.82, 480],
    [6.14, 45.80, 720],
    [6.16, 45.78, 944],
    [6.13, 45.81, 610],
    [6.121, 45.8205, 485],
  ],
};

describe('ClubOutingDetail utilities', () => {
  it('strips duplicated km/D+ suffix from outing title', () => {
    expect(cleanOutingTitle(BASE_OUTING.title)).toBe('Circuit de Leschaux — Lac d’Annecy & Bauges');
  });

  it('detects Boucle vs Traversée A -> B from real 3D routeTrace', () => {
    const loop = computeOutingRouteAnalysis(BASE_OUTING);
    expect(loop.hasRealTrace).toBe(true);
    expect(loop.isTraversal).toBe(false);
    expect(loop.maxAlt).toBe(944);
    expect(loop.samples.length).toBeGreaterThanOrEqual(4);
    expect(loop.estimatedHoursP90).toBeGreaterThan(loop.estimatedHoursP50);

    const traversal = computeOutingRouteAnalysis({
      ...BASE_OUTING,
      routeTrace: [
        [6.12, 45.82, 480],
        [6.25, 45.90, 1420],
      ],
    });
    expect(traversal.isTraversal).toBe(true);
    expect(haversineKm(45.82, 6.12, 45.9, 6.25)).toBeGreaterThan(5);
  });
});
