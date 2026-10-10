import { createClient } from '@/lib/supabase/client';
import type { Message, SequenceUnreadResult } from '../../types/messaging.types';

export class SequenceService {
  /**
   * Deterministic comparison between two messages:
   * 1. Monotonic sequence_number (if both present)
   * 2. Timestamp created_at (fallback for optimistic/legacy messages)
   * 3. ID / client_nonce tie-breaker
   */
  compareMessages(a: Message, b: Message): number {
    if (a.sequence_number != null && b.sequence_number != null) {
      if (a.sequence_number !== b.sequence_number) {
        return a.sequence_number - b.sequence_number;
      }
    }

    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
      return timeA - timeB;
    }

    const keyA = a.id || a.client_nonce || '';
    const keyB = b.id || b.client_nonce || '';
    return keyA.localeCompare(keyB);
  }

  /**
   * Sorts an array of messages deterministically without mutating the original array.
   */
  sortMessages(messages: Message[]): Message[] {
    return [...messages].sort((a, b) => this.compareMessages(a, b));
  }

  /**
   * Detects missing sequence intervals in a message collection (e.g. dropped realtime packets).
   */
  detectSequenceGaps(messages: Message[]): Array<{ from: number; to: number }> {
    const sequenced = messages
      .filter((m) => m.sequence_number != null)
      .map((m) => m.sequence_number!)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => a - b);

    const gaps: Array<{ from: number; to: number }> = [];
    for (let i = 0; i < sequenced.length - 1; i++) {
      const current = sequenced[i];
      const next = sequenced[i + 1];
      if (next > current + 1) {
        gaps.push({ from: current + 1, to: next - 1 });
      }
    }
    return gaps;
  }

  /**
   * O(1) integer arithmetic for unread message counts.
   */
  calculateUnreadCount(lastSequenceNumber: number, lastReadSequence: number): number {
    return Math.max(0, (lastSequenceNumber || 0) - (lastReadSequence || 0));
  }

  /**
   * Evaluates if a specific message has not yet been read by a member.
   */
  isMessageUnread(messageSequence: number, lastReadSequence: number): boolean {
    return messageSequence > (lastReadSequence || 0);
  }

  /**
   * Monotonically advances a member's read sequence in Supabase or local demo cache.
   */
  async markSequenceAsRead(
    conversationId: string,
    userId: string,
    sequenceNumber: number
  ): Promise<number> {
    if (conversationId.startsWith('demo-conv-')) {
      return sequenceNumber;
    }

    const supabase = createClient();

    try {
      // 1. Try atomic RPC update_last_read_sequence
      const { data, error } = await supabase.rpc('update_last_read_sequence', {
        p_conversation_id: conversationId,
        p_sequence_number: sequenceNumber,
      } as any);

      if (!error && data != null) {
        return Number(data);
      }
    } catch {
      // Fallback to direct table update if RPC is missing
    }

    try {
      const { data: member } = await supabase
        .from('conversation_members')
        .select('last_read_sequence')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();

      const currentSeq = (member as any)?.last_read_sequence || 0;
      const targetSeq = Math.max(currentSeq, sequenceNumber);

      await supabase
        .from('conversation_members')
        .update({
          last_read_sequence: targetSeq,
          last_read_at: new Date().toISOString(),
          unread_count: 0,
        })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      return targetSeq;
    } catch {
      return sequenceNumber;
    }
  }

  /**
   * Retrieves conversation sequence metadata and unread calculations.
   */
  async getUnreadStatus(conversationId: string, userId: string): Promise<SequenceUnreadResult> {
    if (conversationId.startsWith('demo-conv-')) {
      return {
        conversationId,
        lastReadSequence: 0,
        lastConversationSequence: 0,
        unreadCount: 0,
      };
    }

    const supabase = createClient();
    const [convRes, memberRes] = await Promise.all([
      supabase
        .from('conversations')
        .select('last_sequence_number')
        .eq('id', conversationId)
        .maybeSingle(),
      supabase
        .from('conversation_members')
        .select('last_read_sequence')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const lastConvSeq = (convRes.data as any)?.last_sequence_number || 0;
    const lastReadSeq = (memberRes.data as any)?.last_read_sequence || 0;

    return {
      conversationId,
      lastReadSequence: lastReadSeq,
      lastConversationSequence: lastConvSeq,
      unreadCount: this.calculateUnreadCount(lastConvSeq, lastReadSeq),
    };
  }
}

export const sequenceService = new SequenceService();
