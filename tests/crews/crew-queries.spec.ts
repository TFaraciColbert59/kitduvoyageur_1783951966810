import { describe, it, expect } from 'vitest';
import { aggregateCrewsData } from '@/lib/queries-crews';
import type { Crew } from '@/features/crews/types/crew.types';

describe('Crew Queries — Elimination du N+1 (D12 & Phase 4.1)', () => {
  const mockCrews: Crew[] = [
    {
      id: 'crew-1',
      name: 'Trek Pyrénées',
      slug: 'trek-pyrenees',
      description: 'Groupe pyrénéen',
      theme: 'Randonnée',
      cover_url: null,
      visibility: 'public',
      invite_code: 'PYR-2026',
      max_members: 12,
      level: 2,
      xp: 150,
      created_by: 'user-1',
      legacy_group_id: null,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
    {
      id: 'crew-2',
      name: 'Alpinisme Écrins',
      slug: 'alpinisme-ecrins',
      description: 'Courses rocher et glace',
      theme: 'Trek',
      cover_url: null,
      visibility: 'private',
      invite_code: 'ECR-2026',
      max_members: 8,
      level: 4,
      xp: 450,
      created_by: 'user-2',
      legacy_group_id: null,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
  ];

  const mockMembers = [
    { crew_id: 'crew-1', user_id: 'user-1', role: 'owner' as const, status: 'active' as const },
    { crew_id: 'crew-1', user_id: 'user-2', role: 'member' as const, status: 'active' as const },
    { crew_id: 'crew-1', user_id: 'user-3', role: 'member' as const, status: 'active' as const },
    { crew_id: 'crew-2', user_id: 'user-2', role: 'owner' as const, status: 'active' as const },
  ];

  const mockTrips = [
    {
      id: 'trip-1',
      crew_id: 'crew-1',
      title: 'Tour du Vignemale',
      slug: 'tour-du-vignemale',
      start_date: '2026-10-15',
    },
    {
      id: 'trip-2',
      crew_id: 'crew-1',
      title: 'Traversée Gavarnie',
      slug: 'traversee-gavarnie',
      start_date: '2026-11-20',
    },
  ];

  it('aggregates member counts in a single pass without N+1 queries', () => {
    const enriched = aggregateCrewsData(mockCrews, mockMembers, mockTrips, 'user-2');

    expect(enriched).toHaveLength(2);

    const crew1 = enriched.find(c => c.id === 'crew-1');
    expect(crew1?.member_count).toBe(3);
    expect(crew1?.my_role).toBe('member');
    expect(crew1?.active_trips_count).toBe(2);
    expect(crew1?.next_trip?.title).toBe('Tour du Vignemale');

    const crew2 = enriched.find(c => c.id === 'crew-2');
    expect(crew2?.member_count).toBe(1);
    expect(crew2?.my_role).toBe('owner');
    expect(crew2?.active_trips_count).toBe(0);
    expect(crew2?.next_trip).toBeNull();
  });
});
