import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTripCollaborators,
  inviteCollaborator,
  updateCollaboratorRole,
  removeCollaborator,
} from '@/lib/queries-trip-collab';
import {
  getTripExpenses,
  addTripExpense,
  deleteTripExpense,
} from '@/lib/queries-trip-budget';
import {
  getTripDocuments,
  addTripDocument,
  deleteTripDocument,
} from '@/lib/queries-trip-docs';

// Mock de Supabase server
vi.mock('@/lib/supabase/server', () => {
  return {
    createClient: vi.fn(),
  };
});

import { createClient } from '@/lib/supabase/server';

function createChainedMock(result: any = { error: null }) {
  const chain: any = {
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

describe('queries-trip-collab & budget & docs — Chantier 7', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queries-trip-collab', () => {
    it('récupère les collaborateurs d\'un voyage avec profils enrichis', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'trip_collaborators') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'c-1',
                    trip_id: 't-1',
                    user_id: 'u-1',
                    role: 'owner',
                    joined_at: '2026-06-01T10:00:00Z',
                    invited_by: null,
                    created_at: '2026-06-01T10:00:00Z',
                    updated_at: '2026-06-01T10:00:00Z',
                  },
                ],
                error: null,
              }),
            };
          }
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'u-1', full_name: 'Alice', avatar_url: null, username: 'alice' }],
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const collabs = await getTripCollaborators('t-1');
      expect(collabs).toHaveLength(1);
      expect(collabs[0].role).toBe('owner');
      expect(collabs[0].profile?.full_name).toBe('Alice');
    });

    it('met à jour le rôle d\'un collaborateur avec succès', async () => {
      const chain = createChainedMock({ error: null });
      const mockSupabase = {
        from: vi.fn().mockReturnValue(chain),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const ok = await updateCollaboratorRole('t-1', 'c-1', 'editor');
      expect(ok).toBe(true);
    });

    it('supprime un collaborateur avec succès', async () => {
      const chain = createChainedMock({ error: null });
      const mockSupabase = {
        from: vi.fn().mockReturnValue(chain),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const ok = await removeCollaborator('t-1', 'c-1');
      expect(ok).toBe(true);
    });
  });

  describe('queries-trip-budget', () => {
    it('récupère les dépenses avec payeurs associés', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'trip_expenses') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'e-1',
                    trip_id: 't-1',
                    payer_id: 'u-1',
                    title: 'Bivouac matos',
                    amount: '120.50',
                    currency: 'EUR',
                    category: 'matériel',
                    expense_date: '2026-07-01',
                    split_type: 'equal',
                    metadata: {},
                    created_at: '2026-07-01T10:00:00Z',
                    updated_at: '2026-07-01T10:00:00Z',
                  },
                ],
                error: null,
              }),
            };
          }
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'u-1', full_name: 'Bob', avatar_url: null, username: 'bob' }],
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const expenses = await getTripExpenses('t-1');
      expect(expenses).toHaveLength(1);
      expect(expenses[0].amount).toBe(120.5);
      expect(expenses[0].payer?.full_name).toBe('Bob');
    });

    it('ajoute une dépense avec succès', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'e-2',
              trip_id: 't-1',
              payer_id: 'u-1',
              title: 'Repas refuge',
              amount: 45,
              currency: 'EUR',
              category: 'nourriture',
              expense_date: '2026-07-02',
              split_type: 'equal',
              metadata: {},
              created_at: '2026-07-02T10:00:00Z',
              updated_at: '2026-07-02T10:00:00Z',
            },
            error: null,
          }),
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const created = await addTripExpense({
        trip_id: 't-1',
        payer_id: 'u-1',
        title: 'Repas refuge',
        amount: 45,
      });

      expect(created).not.toBeNull();
      expect(created?.id).toBe('e-2');
      expect(created?.amount).toBe(45);
    });

    it('supprime une dépense avec succès', async () => {
      const chain = createChainedMock({ error: null });
      const mockSupabase = {
        from: vi.fn().mockReturnValue(chain),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const ok = await deleteTripExpense('t-1', 'e-1');
      expect(ok).toBe(true);
    });
  });

  describe('queries-trip-docs', () => {
    it('récupère les documents d\'un voyage', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'd-1',
                trip_id: 't-1',
                user_id: 'u-1',
                title: 'Passeport',
                category: 'passport',
                file_url: 'https://example.com/p.pdf',
                file_name: 'p.pdf',
                file_size_bytes: 5000,
                mime_type: 'application/pdf',
                expires_at: '2028-01-01',
                notes: null,
                created_at: '2026-06-01T10:00:00Z',
                updated_at: '2026-06-01T10:00:00Z',
              },
            ],
            error: null,
          }),
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const docs = await getTripDocuments('t-1');
      expect(docs).toHaveLength(1);
      expect(docs[0].category).toBe('passport');
    });

    it('ajoute un document avec succès', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'd-2',
              trip_id: 't-1',
              user_id: 'u-1',
              title: 'Assurance rapatriement',
              category: 'insurance',
              file_url: 'https://example.com/assur.pdf',
              file_name: 'assur.pdf',
              file_size_bytes: 1200,
              mime_type: 'application/pdf',
              expires_at: '2027-06-01',
              notes: 'Police #987',
              created_at: '2026-06-01T10:00:00Z',
              updated_at: '2026-06-01T10:00:00Z',
            },
            error: null,
          }),
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const created = await addTripDocument({
        trip_id: 't-1',
        user_id: 'u-1',
        title: 'Assurance rapatriement',
        category: 'insurance',
        file_url: 'https://example.com/assur.pdf',
      });

      expect(created).not.toBeNull();
      expect(created?.category).toBe('insurance');
    });

    it('supprime un document avec succès', async () => {
      const chain = createChainedMock({ error: null });
      const mockSupabase = {
        from: vi.fn().mockReturnValue(chain),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const ok = await deleteTripDocument('t-1', 'd-1');
      expect(ok).toBe(true);
    });
  });
});
