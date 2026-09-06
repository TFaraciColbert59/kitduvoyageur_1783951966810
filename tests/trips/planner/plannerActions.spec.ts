import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addTripStepAction,
  updateTripStepAction,
  deleteTripStepAction,
  reorderTripStepsAction,
  moveStepToDayAction,
  insertDayAction,
  deleteDayAction,
  duplicateDayAction,
} from '@/app/voyages/actions';

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock queries-trips
vi.mock('@/lib/queries-trips', () => ({
  createTrip: vi.fn(),
  getTripById: vi.fn(),
}));

// Mock Supabase client
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

import { getTripById } from '@/lib/queries-trips';

describe('Chantier 3 — Planner Server Actions (TDD)', () => {
  const fakeUserId = '11111111-1111-4111-8111-111111111111';
  const fakeTripId = '22222222-2222-4222-8222-222222222222';
  const fakeStepId = '33333333-3333-4333-8333-333333333333';

  const mockTrip = {
    id: fakeTripId,
    slug: 'mon-beau-voyage',
    title: 'Mon Beau Voyage',
    user_id: fakeUserId,
    permissions: {
      canEdit: true,
      canDelete: true,
      canManageCollaborators: true,
      isOwner: true,
      isCollaborator: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: fakeUserId } } });
    vi.mocked(getTripById).mockResolvedValue(mockTrip as any);
  });

  describe('addTripStepAction', () => {
    it('insère une nouvelle étape et incrémente order_index', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [{ order_index: 2 }], error: null }),
            }),
          }),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: fakeStepId, title: 'Étape test' },
            error: null,
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'trip_steps') {
          return {
            select: mockSelect,
            insert: mockInsert,
          };
        }
        return {};
      });

      const result = await addTripStepAction({
        trip_id: fakeTripId,
        day_number: 1,
        title: 'Étape test',
        transport_mode: 'walking',
        distance_km: 5,
      });

      expect(result.success).toBe(true);
      expect(result.stepId).toBe(fakeStepId);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          trip_id: fakeTripId,
          day_number: 1,
          order_index: 3, // 2 + 1
          title: 'Étape test',
        })
      );
    });

    it('rejette si l’utilisateur n’a pas les droits d’édition', async () => {
      vi.mocked(getTripById).mockResolvedValueOnce({
        ...mockTrip,
        permissions: { ...mockTrip.permissions, canEdit: false },
      } as any);

      await expect(
        addTripStepAction({
          trip_id: fakeTripId,
          day_number: 1,
          title: 'Étape interdite',
        })
      ).rejects.toThrow('droits');
    });
  });

  describe('deleteTripStepAction', () => {
    it('supprime l’étape et retasse les order_index du jour', async () => {
      // 1. fetch step to get day_number
      const mockSelectStep = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: fakeStepId, day_number: 1, trip_id: fakeTripId },
            error: null,
          }),
        }),
      });

      // 2. delete
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      // 3. fetch remaining steps
      const mockSelectRemaining = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'step-b', order_index: 1 },
                { id: 'step-c', order_index: 2 },
              ],
              error: null,
            }),
          }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'trip_steps') {
          return {
            select: vi.fn().mockImplementation((fields: string) => {
              if (fields === 'id, day_number, trip_id') return mockSelectStep();
              return mockSelectRemaining();
            }),
            delete: mockDelete,
            update: mockUpdate,
          };
        }
        return {};
      });

      const result = await deleteTripStepAction(fakeTripId, fakeStepId);
      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('reorderTripStepsAction', () => {
    it('réordonne les étapes avec protection anti-collision d’index', async () => {
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'trip_steps') {
          return { update: mockUpdate };
        }
        return {};
      });

      const step1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const step2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      const result = await reorderTripStepsAction({
        trip_id: fakeTripId,
        day_number: 1,
        step_ids_in_order: [step2, step1],
      });

      expect(result.success).toBe(true);
      // Phase 1 : indices temporaires négatifs (2 appels) + Phase 2 : indices finaux (2 appels) = 4 updates
      expect(mockUpdate).toHaveBeenCalledTimes(4);
    });
  });

  describe('insertDayAction', () => {
    it('décale les étapes des jours ultérieurs et ajuste la date de fin', async () => {
      const mockSelectSteps = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 's2', day_number: 3 },
                { id: 's1', day_number: 2 },
              ],
              error: null,
            }),
          }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'trip_steps') {
          return {
            select: mockSelectSteps,
            update: mockUpdate,
          };
        }
        if (table === 'trips') {
          return {
            update: mockUpdate,
          };
        }
        return {};
      });

      const result = await insertDayAction({
        trip_id: fakeTripId,
        after_day_number: 1,
      });

      expect(result.success).toBe(true);
      // Deux étapes décalées
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('deleteDayAction', () => {
    it('bloque si le jour a des étapes sans cascade_steps', async () => {
      const mockSelectSteps = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ id: 'step-1' }],
            error: null,
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'trip_steps') {
          return { select: mockSelectSteps };
        }
        return {};
      });

      await expect(
        deleteDayAction({
          trip_id: fakeTripId,
          day_number: 2,
          cascade_steps: false,
        })
      ).rejects.toThrow('contient des étapes');
    });

    it('supprime et tasse si cascade_steps est true', async () => {
      const mockSelectSteps = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ id: 'step-1' }],
            error: null,
          }),
        }),
      });

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const mockSelectToShift = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ id: 'step-after', day_number: 3 }],
              error: null,
            }),
          }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      let selectCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'trip_steps') {
          return {
            select: vi.fn().mockImplementation(() => {
              selectCallCount++;
              return selectCallCount === 1 ? mockSelectSteps() : mockSelectToShift();
            }),
            delete: mockDelete,
            update: mockUpdate,
          };
        }
        if (table === 'trips') {
          return { update: mockUpdate };
        }
        return {};
      });

      const result = await deleteDayAction({
        trip_id: fakeTripId,
        day_number: 2,
        cascade_steps: true,
      });

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('duplicateDayAction', () => {
    it('duplique les étapes du jour et les insère dans le jour suivant', async () => {
      const mockSelectToShift = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const mockSelectSource = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'src-1',
                  order_index: 0,
                  title: 'Rando lac',
                  distance_km: 10,
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      let selectCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'trip_steps') {
          return {
            select: vi.fn().mockImplementation(() => {
              selectCount++;
              return selectCount === 1 ? mockSelectToShift() : mockSelectSource();
            }),
            insert: mockInsert,
            update: mockUpdate,
          };
        }
        if (table === 'trips') {
          return { update: mockUpdate };
        }
        return {};
      });

      const result = await duplicateDayAction({
        trip_id: fakeTripId,
        day_number: 1,
      });

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          day_number: 2,
          title: 'Rando lac (copie)',
        }),
      ]);
    });
  });
});

