// src/components/messaging/messagesModel.ts
//
// Modèle pur de la liste des discussions : titre, aperçu, filtre et geste de
// rangée. Aucun accès React ni réseau — testable en isolation (vitest).

import type { Conversation } from '@/features/messaging/types/messaging.types';

export type FilterId = 'all' | 'direct' | 'group' | 'requests';

/** Largeur révélée par le glissement d'une rangée (deux actions de 54 px). */
export const SWIPE_REVEAL = 96;

export function conversationTitle(conv: Conversation): string {
  if (conv.title) return conv.title;
  if (conv.other_member?.full_name) return conv.other_member.full_name;
  return conv.type === 'group' ? "Groupe d'expédition" : 'Voyageur LKDV';
}

export function lastPreview(conv: Conversation): string {
  const last = conv.last_message;
  if (!last) return 'Aucun message';
  const prefix = conv.type === 'group' && last.sender_name ? `${last.sender_name.split(' ')[0]} : ` : '';
  switch (last.message_type) {
    case 'image':
      return `${prefix}Photo`;
    case 'audio':
      return `${prefix}Note vocale`;
    case 'gpx':
      return `${prefix}Trace GPX`;
    case 'file':
      return `${prefix}Fichier`;
    case 'product':
      return `${prefix}Équipement`;
    case 'trail':
      return `${prefix}Randonnée`;
    case 'kit':
      return `${prefix}Kit`;
    default:
      return `${prefix}${last.content}`;
  }
}

/**
 * Fils visibles pour l'utilisateur : les fils qu'il a supprimés pour lui
 * (`left_at`) sortent, puis le segment et la recherche s'appliquent.
 */
export function filterConversations(
  list: Conversation[],
  opts: { filter: FilterId; query: string }
): Conversation[] {
  const text = opts.query.trim().toLowerCase();
  return list.filter((conversation) => {
    if (conversation.left_at) return false;
    if (opts.filter === 'requests') {
      if (conversation.status !== 'pending') return false;
    } else {
      if (conversation.status === 'pending' || conversation.status === 'rejected') return false;
      if (opts.filter === 'direct' && conversation.type !== 'direct') return false;
      if (opts.filter === 'group' && conversation.type !== 'group') return false;
    }
    if (!text) return true;
    return [conversationTitle(conversation), lastPreview(conversation)]
      .join(' ')
      .toLowerCase()
      .includes(text);
  });
}

/** Glissement vers la GAUCHE : les actions (Supprimer, Notifs) vivent à
 *  droite de la rangée. Borné à la largeur révélée. */
export function clampSwipe(dx: number, base: number): number {
  return Math.max(-SWIPE_REVEAL, Math.min(base + dx, 0));
}

/** Au relâchement : ouvert si le geste dépasse 40 % de la largeur révélée. */
export function resolveSwipeEnd(dx: number): { open: boolean; dx: number } {
  const open = dx < -SWIPE_REVEAL * 0.4;
  return { open, dx: open ? -SWIPE_REVEAL : 0 };
}
