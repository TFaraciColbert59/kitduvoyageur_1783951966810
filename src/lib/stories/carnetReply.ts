import { messagingService } from '@/features/messaging/services/messagingService';

export interface CarnetStoryReplyParams {
  carnetId: string;
  momentId?: string;
  dayNumber?: number;
  caption?: string | null;
  author: {
    id: string;
    name: string;
  };
  myUserId: string;
  text: string;
}

/**
 * Carnet V2 — Réponse directe à l'auteur d'une story / moment de carnet.
 * Utilise la messagerie canonique LKDV avec `metadata.carnet_moment_reply`.
 */
export async function replyToCarnetStory(
  params: CarnetStoryReplyParams
): Promise<{ ok: boolean; error?: string }> {
  const message = params.text.trim().slice(0, 500);
  if (!message || !params.carnetId) return { ok: false, error: 'Message vide ou carnet invalide.' };
  if (!params.author.id || params.author.id === params.myUserId) {
    return { ok: false, error: 'Impossible de vous envoyer un message à vous-même.' };
  }

  try {
    const convId = await messagingService.getOrCreateDirectConversation(
      params.author.id,
      params.myUserId
    );
    if (!convId) return { ok: false, error: 'Discussion indisponible.' };

    const sent = await messagingService.sendMessage(
      convId,
      params.myUserId,
      message,
      'text',
      undefined,
      {
        carnet_moment_reply: {
          carnet_id: params.carnetId,
          moment_id: params.momentId ?? null,
          jour_numero: params.dayNumber ?? null,
          author_id: params.author.id,
          author_name: params.author.name,
          caption: params.caption ?? null,
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
