import { messagingService } from '@/features/messaging/services/messagingService';

export interface StoryReplyTarget {
  storyId?: string;
  caption?: string | null;
}

export interface StoryReplyAuthor {
  id: string;
  name: string;
}

/**
 * Stories V2 — réponse privée à l'auteur d'une story via la messagerie
 * canonique LKDV (jamais un second système de DM).
 *
 * Chemin : conversation directe (RPC `get_or_create_direct_conversation`, qui
 * crée aussi une demande si nécessaire) puis `sendMessage` avec une référence
 * story en `metadata.story_reply` (id auteur + légende — jamais le média, qui
 * reste soumis à son audience et à son expiration).
 *
 * Échecs (blocage, RPC, RLS) : jamais silencieux, jamais présentés comme
 * envoyés — l'appelant affiche le message retourné.
 */
export async function replyToStory(params: {
  slide: StoryReplyTarget;
  author: StoryReplyAuthor;
  myUserId: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const message = params.text.trim().slice(0, 500);
  if (!message || !params.slide.storyId) return { ok: false };
  try {
    const convId = await messagingService.getOrCreateDirectConversation(
      params.author.id,
      params.myUserId
    );
    if (!convId) return { ok: false, error: 'Conversation indisponible.' };
    const sent = await messagingService.sendMessage(
      convId,
      params.myUserId,
      message,
      'text',
      undefined,
      {
        story_reply: {
          story_id: params.slide.storyId,
          author_id: params.author.id,
          author_name: params.author.name,
          caption: params.slide.caption ?? null,
        },
      }
    );
    if (!sent) return { ok: false, error: 'Réponse non envoyée — réessayez.' };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Réponse impossible pour le moment.',
    };
  }
}
