import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/queries/publicProfilesCore', () => ({
  fetchPublicProfilesWith: vi.fn().mockResolvedValue({}),
}));

import { createClient } from '@/lib/supabase/client';
import { messagingService } from '@/features/messaging/services/messagingService';

const mockCreateClient = vi.mocked(createClient);

type ChainResult = { data?: unknown; error?: { message: string } | null };

function makeChain(result: ChainResult) {
  const builder: Record<string, unknown> = {};
  const passthrough = ['select', 'insert', 'update', 'eq', 'neq', 'in', 'order', 'limit'];
  for (const method of passthrough) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.then = (resolve: (value: ChainResult) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

describe('F-005 — une panne n’est pas une liste vide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('getMessages remonte une erreur SQL au lieu de renvoyer un faux vide', async () => {
    mockCreateClient.mockReturnValue({
      from: vi.fn(() => makeChain({ data: null, error: { message: 'boom' } })),
    } as unknown as ReturnType<typeof createClient>);

    await expect(messagingService.getMessages('c1')).rejects.toThrow(
      'Impossible de charger les messages.'
    );
  });

  it('getMessages retourne [] pour une discussion réellement vide', async () => {
    mockCreateClient.mockReturnValue({
      from: vi.fn(() => makeChain({ data: [], error: null })),
    } as unknown as ReturnType<typeof createClient>);

    await expect(messagingService.getMessages('c1')).resolves.toEqual([]);
  });

  it('getConversations remonte une erreur SQL sur les adhésions', async () => {
    mockCreateClient.mockReturnValue({
      from: vi.fn(() => makeChain({ data: null, error: { message: 'boom' } })),
    } as unknown as ReturnType<typeof createClient>);

    await expect(messagingService.getConversations('u1')).rejects.toThrow(
      'Impossible de charger vos conversations.'
    );
  });

  it('getConversations retourne [] quand l’utilisateur n’a aucune adhésion', async () => {
    mockCreateClient.mockReturnValue({
      from: vi.fn(() => makeChain({ data: [], error: null })),
    } as unknown as ReturnType<typeof createClient>);

    await expect(messagingService.getConversations('u1')).resolves.toEqual([]);
  });
});
