import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import type {
  Message,
  CursorPaginationOptions,
  PaginatedMessagesResult,
} from '../../types/messaging.types';
import { sequenceService } from './sequenceService';

export class CursorPaginationService {
  /**
   * Deterministic bidirectional cursor pagination by sequence_number.
   */
  async getMessagesCursor(
    conversationId: string,
    options: CursorPaginationOptions = {}
  ): Promise<PaginatedMessagesResult> {
    const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
    const supabase = createClient();

    let query = supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        sequence_number,
        client_nonce,
        content,
        message_type,
        metadata,
        reply_to_id,
        deleted_at,
        created_at,
        updated_at,
        message_reactions (
          id,
          message_id,
          user_id,
          reaction_type,
          reaction_value,
          created_at
        )
      `)
      .eq('conversation_id', conversationId);

    let hasMoreBefore = false;
    let hasMoreAfter = false;
    let rawMessages: any[] = [];

    if (options.beforeSequence != null) {
      // Scrolling up (fetching older messages before beforeSequence)
      const { data, error } = await query
        .lt('sequence_number', options.beforeSequence)
        .order('sequence_number', { ascending: false })
        .limit(limit + 1);

      if (error || !data) {
        return {
          messages: [],
          hasMoreBefore: false,
          hasMoreAfter: false,
          earliestSequence: null,
          latestSequence: null,
        };
      }

      rawMessages = data;
      if (rawMessages.length > limit) {
        hasMoreBefore = true;
        rawMessages = rawMessages.slice(0, limit);
      }
      // Reverse to display chronologically ascending
      rawMessages.reverse();
      // By definition, when querying beforeSequence, there are newer messages (at least beforeSequence)
      hasMoreAfter = true;
    } else if (options.afterSequence != null) {
      // Scrolling down / catch-up (fetching newer messages after afterSequence)
      const { data, error } = await query
        .gt('sequence_number', options.afterSequence)
        .order('sequence_number', { ascending: true })
        .limit(limit + 1);

      if (error || !data) {
        return {
          messages: [],
          hasMoreBefore: false,
          hasMoreAfter: false,
          earliestSequence: null,
          latestSequence: null,
        };
      }

      rawMessages = data;
      if (rawMessages.length > limit) {
        hasMoreAfter = true;
        rawMessages = rawMessages.slice(0, limit);
      }
      // When querying afterSequence, there are older messages (at least afterSequence)
      hasMoreBefore = true;
    } else {
      // Default: load latest N messages
      const { data, error } = await query
        .order('sequence_number', { ascending: false })
        .limit(limit + 1);

      if (error || !data) {
        return {
          messages: [],
          hasMoreBefore: false,
          hasMoreAfter: false,
          earliestSequence: null,
          latestSequence: null,
        };
      }

      rawMessages = data;
      if (rawMessages.length > limit) {
        hasMoreBefore = true;
        rawMessages = rawMessages.slice(0, limit);
      }
      rawMessages.reverse();
      hasMoreAfter = false;
    }

    if (rawMessages.length === 0) {
      return {
        messages: [],
        hasMoreBefore: false,
        hasMoreAfter: false,
        earliestSequence: null,
        latestSequence: null,
      };
    }

    // Hydrate sender public profiles via canonical query (no foreign key embed)
    const senderIds = rawMessages.map((m) => m.sender_id as string);
    const profileById = await fetchPublicProfilesWith(supabase, senderIds);

    const messageMap = new Map<string, { id: string; sender_name: string; content: string }>();
    rawMessages.forEach((msg) => {
      const profile = profileById[msg.sender_id];
      messageMap.set(msg.id, {
        id: msg.id,
        sender_name: profile?.full_name || 'Voyageur',
        content: msg.content,
      });
    });

    const parsedMessages: Message[] = rawMessages.map((msg) => {
      const profile = profileById[msg.sender_id];
      const reactions = Array.isArray(msg.message_reactions) ? msg.message_reactions : [];
      const replyToMsg = msg.reply_to_id ? messageMap.get(msg.reply_to_id) || null : null;

      return {
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        sequence_number: msg.sequence_number != null ? Number(msg.sequence_number) : undefined,
        client_nonce: msg.client_nonce,
        content: msg.content,
        message_type: msg.message_type || 'text',
        metadata: msg.metadata ?? null,
        reply_to_id: msg.reply_to_id,
        reply_to_message: replyToMsg,
        deleted_at: msg.deleted_at,
        created_at: msg.created_at,
        updated_at: msg.updated_at,
        sender_profile: profile
          ? {
              id: profile.id,
              full_name: profile.full_name || 'Voyageur LKDV',
              avatar_url: profile.avatar_url || '/assets/images/no_image.png',
              username: undefined,
            }
          : undefined,
        reactions: reactions.map((r: any) => ({
          id: r.id,
          message_id: r.message_id,
          user_id: r.user_id,
          reaction_type: r.reaction_type || 'emoji',
          reaction_value: r.reaction_value,
          created_at: r.created_at,
        })),
        status: 'sent',
      };
    });

    const sortedMessages = sequenceService.sortMessages(parsedMessages);
    const earliestSequence = sortedMessages[0]?.sequence_number ?? null;
    const latestSequence = sortedMessages[sortedMessages.length - 1]?.sequence_number ?? null;

    return {
      messages: sortedMessages,
      hasMoreBefore,
      hasMoreAfter,
      earliestSequence,
      latestSequence,
    };
  }
}

export const cursorPaginationService = new CursorPaginationService();
