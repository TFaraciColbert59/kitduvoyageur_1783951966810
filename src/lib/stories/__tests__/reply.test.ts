import { beforeEach, describe, expect, it, vi } from 'vitest';

import { messagingService } from '../../../features/messaging/services/messagingService';
import { replyToStory } from '../reply';

vi.mock('../../../features/messaging/services/messagingService', () => ({
  messagingService: {
    getOrCreateDirectConversation: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

const mocked = messagingService as unknown as {
  getOrCreateDirectConversation: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
};

const slide = { storyId: 'story-1', caption: 'hello' };
const author = { id: 'author-1', name: 'Alice' };

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Stories V2 — réponse privée à une story via la messagerie canonique.
 * Contrat : conversation directe (RPC) + message avec metadata story_reply ;
 * échec → message explicite, jamais de faux succès.
 */
describe('replyToStory — réponse DM canonique', () => {
  it('envoie via conversation directe, avec la référence story en metadata', async () => {
    mocked.getOrCreateDirectConversation.mockResolvedValue('conv-1');
    mocked.sendMessage.mockResolvedValue({ id: 'm-1' });

    const result = await replyToStory({ slide, author, myUserId: 'me-1', text: 'Superbe !' });

    expect(result).toEqual({ ok: true });
    expect(mocked.getOrCreateDirectConversation).toHaveBeenCalledWith('author-1', 'me-1');
    expect(mocked.sendMessage).toHaveBeenCalledWith('conv-1', 'me-1', 'Superbe !', 'text', undefined, {
      story_reply: {
        story_id: 'story-1',
        author_id: 'author-1',
        author_name: 'Alice',
        caption: 'hello',
      },
    });
  });

  it('texte vide → refus sans aucun appel réseau', async () => {
    const result = await replyToStory({ slide, author, myUserId: 'me-1', text: '   ' });

    expect(result.ok).toBe(false);
    expect(mocked.getOrCreateDirectConversation).not.toHaveBeenCalled();
    expect(mocked.sendMessage).not.toHaveBeenCalled();
  });

  it('sans storyId → refus', async () => {
    const result = await replyToStory({ slide: {}, author, myUserId: 'me-1', text: 'hi' });

    expect(result.ok).toBe(false);
    expect(mocked.getOrCreateDirectConversation).not.toHaveBeenCalled();
  });

  it('RPC en échec → message explicite, jamais de faux succès', async () => {
    mocked.getOrCreateDirectConversation.mockRejectedValue(new Error('Conversation indisponible.'));

    const result = await replyToStory({ slide, author, myUserId: 'me-1', text: 'hi' });

    expect(result).toEqual({ ok: false, error: 'Conversation indisponible.' });
  });

  it('envoi null → consigne de réessai', async () => {
    mocked.getOrCreateDirectConversation.mockResolvedValue('conv-1');
    mocked.sendMessage.mockResolvedValue(null);

    const result = await replyToStory({ slide, author, myUserId: 'me-1', text: 'hi' });

    expect(result).toEqual({ ok: false, error: 'Réponse non envoyée — réessayez.' });
  });

  it('tronque le texte à 500 caractères', async () => {
    mocked.getOrCreateDirectConversation.mockResolvedValue('conv-1');
    mocked.sendMessage.mockResolvedValue({ id: 'm-2' });

    await replyToStory({ slide, author, myUserId: 'me-1', text: `x${'y'.repeat(600)}` });

    const sent = mocked.sendMessage.mock.calls[0][2] as string;
    expect(sent).toHaveLength(500);
  });
});
