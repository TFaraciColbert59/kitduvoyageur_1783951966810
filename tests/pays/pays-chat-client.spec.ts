import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendPaysChatMessage } from '@/features/pays/chat/paysChatClient';

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('sendPaysChatMessage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('poste vers la route pays et renvoie texte + flags', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ text: 'Juillet-août.', degraded: false, ragUsed: true })
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await sendPaysChatMessage('FR', 'Quand partir ?');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/pays/FR/chat');
    expect(JSON.parse(init.body as string)).toEqual({ question: 'Quand partir ?' });
    expect(res).toEqual({ text: 'Juillet-août.', degraded: false, ragUsed: true });
  });

  it('traduit le 429 en message clair', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'x' }, 429)));
    await expect(sendPaysChatMessage('FR', 'Bonjour')).rejects.toThrow(/heure/);
  });

  it('traduit une coupure reseau en message clair', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(sendPaysChatMessage('FR', 'Bonjour')).rejects.toThrow(/connexion/);
  });
});
