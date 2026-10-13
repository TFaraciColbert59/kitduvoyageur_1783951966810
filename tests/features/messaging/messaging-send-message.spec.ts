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
  const passthrough = ['select', 'insert', 'update', 'eq', 'neq', 'order', 'limit'];
  for (const method of passthrough) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.then = (resolve: (value: ChainResult) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

describe('F-004 — messagingService.sendMessage : jamais de faux « envoyé »', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('retourne null quand l’insertion SQL échoue (RLS refusée)', async () => {
    mockCreateClient.mockReturnValue({
      from: vi.fn(() => makeChain({ data: null, error: { message: 'RLS denied' } })),
    } as unknown as ReturnType<typeof createClient>);

    const sent = await messagingService.sendMessage('c1', 'u1', 'bonjour');

    expect(sent).toBeNull();
  });

  it('retourne null quand l’insertion ne renvoie aucune ligne', async () => {
    mockCreateClient.mockReturnValue({
      from: vi.fn(() => makeChain({ data: null, error: null })),
    } as unknown as ReturnType<typeof createClient>);

    const sent = await messagingService.sendMessage('c1', 'u1', 'bonjour');

    expect(sent).toBeNull();
  });

  it('retourne le message serveur (id réel + status sent) quand l’insertion réussit', async () => {
    const serverRow = {
      id: 'srv-1',
      conversation_id: 'c1',
      sender_id: 'u1',
      content: 'bonjour',
      message_type: 'text',
      reply_to_id: null,
      metadata: null,
      created_at: '2026-10-13T00:00:00.000Z',
      updated_at: '2026-10-13T00:00:00.000Z',
    };

    mockCreateClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'messages') return makeChain({ data: serverRow, error: null });
        if (table === 'conversation_members') return makeChain({ data: [], error: null });
        return makeChain({ data: null, error: null });
      }),
    } as unknown as ReturnType<typeof createClient>);

    const sent = await messagingService.sendMessage('c1', 'u1', 'bonjour');

    expect(sent).not.toBeNull();
    expect(sent?.id).toBe('srv-1');
    expect(sent?.status).toBe('sent');
  });

  it('conserve le chemin démo sans toucher Supabase', async () => {
    const sent = await messagingService.sendMessage('demo-conv-1', 'u1', 'hello démo');

    expect(sent).not.toBeNull();
    expect(sent?.status).toBe('sent');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
