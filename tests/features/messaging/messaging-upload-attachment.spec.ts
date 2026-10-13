import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/client';
import { messagingService } from '@/features/messaging/services/messagingService';

const mockCreateClient = vi.mocked(createClient);

function clientWithStorage(uploadError: { message: string } | null = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: uploadError }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example' } }),
      })),
    },
  };
}

describe('F-006 — uploadAttachment : clé durable, jamais de faux partage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('sans session : retourne null (plus de blob local partagé)', async () => {
    mockCreateClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as unknown as ReturnType<typeof createClient>);

    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    await expect(messagingService.uploadAttachment('c1', file)).resolves.toBeNull();
  });

  it('upload refusé par le bucket : retourne null (pas de blob de secours)', async () => {
    mockCreateClient.mockReturnValue(
      clientWithStorage({ message: 'mime type not allowed' }) as unknown as ReturnType<typeof createClient>
    );

    const file = new File(['data'], 'note.webm', { type: 'audio/webm' });
    await expect(messagingService.uploadAttachment('c1', file)).resolves.toBeNull();
  });

  it('fichier > 25 Mio : refusé avant tout coût d’upload', async () => {
    const client = clientWithStorage(null);
    mockCreateClient.mockReturnValue(client as unknown as ReturnType<typeof createClient>);

    const big = new File([new Uint8Array(26214401)], 'gros.mp4', { type: 'video/mp4' });
    await expect(messagingService.uploadAttachment('c1', big)).resolves.toBeNull();
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it('succès : retourne la clé durable, aucune URL signée stockée', async () => {
    const client = clientWithStorage(null);
    mockCreateClient.mockReturnValue(client as unknown as ReturnType<typeof createClient>);

    const file = new File(['data'], 'note.webm', { type: 'audio/webm' });
    const result = await messagingService.uploadAttachment('c1', file);

    expect(result).not.toBeNull();
    expect(result!.startsWith('c1/u1/')).toBe(true);
    expect(result!.endsWith('.webm')).toBe(true);
    expect(result!.startsWith('http')).toBe(false);
    expect(result!.startsWith('blob:')).toBe(false);
    const fromReturn = client.storage.from.mock.results[0].value as {
      createSignedUrl: ReturnType<typeof vi.fn>;
    };
    expect(fromReturn.createSignedUrl).not.toHaveBeenCalled();
  });

  it('conversation démo : aperçu blob local autorisé (rien n’est partagé)', async () => {
    const original = URL.createObjectURL;
    (URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => 'blob:demo');
    try {
      const file = new File(['data'], 'photo.png', { type: 'image/png' });
      await expect(messagingService.uploadAttachment('demo-conv-1', file)).resolves.toBe('blob:demo');
    } finally {
      (URL as unknown as Record<string, unknown>).createObjectURL = original;
    }
  });
});
