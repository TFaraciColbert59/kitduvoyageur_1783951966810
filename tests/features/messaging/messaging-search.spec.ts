import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/client';
import { messagingService } from '@/features/messaging/services/messagingService';

const mockCreateClient = vi.mocked(createClient);

type ChainResult = { data?: unknown; error?: { message: string } | null };

function makeChain(result: ChainResult) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'ilike']) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (resolve: (value: ChainResult) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

describe('A-084 — recherche messagerie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('ne lance aucune requête sous deux caractères', async () => {
    const from = vi.fn();
    mockCreateClient.mockReturnValue({ from } as unknown as ReturnType<typeof createClient>);
    await expect(messagingService.searchMessages('a')).resolves.toEqual([]);
    await expect(messagingService.searchPeople(' ')).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('retourne les messages trouvés (RLS côté base)', async () => {
    const rows = [
      { id: 'm1', conversation_id: 'c1', content: 'lac gelé', message_type: 'text', created_at: '2026-10-12T10:00:00Z', sender_id: 'u1' },
    ];
    mockCreateClient.mockReturnValue({
      from: vi.fn(() => makeChain({ data: rows, error: null })),
    } as unknown as ReturnType<typeof createClient>);
    const results = await messagingService.searchMessages('lac');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('m1');
  });

  it('échoue proprement (aucun extrait) quand la recherche est refusée', async () => {
    mockCreateClient.mockReturnValue({
      from: vi.fn(() => makeChain({ data: null, error: { message: 'RLS' } })),
    } as unknown as ReturnType<typeof createClient>);
    await expect(messagingService.searchMessages('secret')).resolves.toEqual([]);
  });

  it('exclut les personnes déjà en conversation et les profils sans nom', async () => {
    const rows = [
      { id: 'p1', full_name: 'Marie Dupont', avatar_url: null },
      { id: 'p2', full_name: 'Marc', avatar_url: null },
      { id: 'p3', full_name: null, avatar_url: null },
    ];
    mockCreateClient.mockReturnValue({
      from: vi.fn(() => makeChain({ data: rows, error: null })),
    } as unknown as ReturnType<typeof createClient>);
    const results = await messagingService.searchPeople('mar', ['p2']);
    expect(results.map((p) => p.id)).toEqual(['p1']);
  });
});
