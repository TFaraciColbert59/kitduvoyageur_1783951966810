import { createClient } from '@/lib/supabase/client';
import type { Message, NonceRecord } from '../../types/messaging.types';

export class IdempotencyService {
  private inFlightRegistry = new Map<string, NonceRecord>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Generates a cryptographic / collision-resistant client nonce for send operations.
   */
  generateNonce(): string {
    const timestamp = Date.now();
    let randomPart: string;

    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      randomPart = crypto.randomUUID();
    } else {
      randomPart = `${Math.random().toString(36).substring(2, 11)}_${Math.random().toString(36).substring(2, 11)}`;
    }

    return `nonce_${timestamp}_${randomPart}`;
  }

  /**
   * Checks whether a nonce is currently being transmitted or processed.
   */
  isNonceInFlight(nonce: string): boolean {
    this.pruneStale();
    const record = this.inFlightRegistry.get(nonce);
    return !!record && record.status === 'pending';
  }

  /**
   * Tracks a newly generated or submitted nonce as in-flight.
   */
  trackInFlight(nonce: string, conversationId: string): void {
    this.pruneStale();
    this.inFlightRegistry.set(nonce, {
      clientNonce: nonce,
      conversationId,
      createdAt: Date.now(),
      status: 'pending',
    });
  }

  /**
   * Marks a nonce as successfully confirmed by the server.
   */
  markConfirmed(nonce: string): void {
    const record = this.inFlightRegistry.get(nonce);
    if (record) {
      record.status = 'confirmed';
    }
  }

  /**
   * Marks a nonce as failed (network failure, RLS rejection, etc.).
   */
  markFailed(nonce: string): void {
    const record = this.inFlightRegistry.get(nonce);
    if (record) {
      record.status = 'failed';
    }
  }

  /**
   * Prunes nonces older than the TTL window.
   */
  private pruneStale(): void {
    const now = Date.now();
    for (const [nonce, record] of this.inFlightRegistry.entries()) {
      if (now - record.createdAt > this.TTL_MS) {
        this.inFlightRegistry.delete(nonce);
      }
    }
  }

  /**
   * Recovers existing message when PostgreSQL returns unique_violation error code 23505
   * for duplicate (conversation_id, client_nonce).
   */
  async handleDuplicateSend(
    conversationId: string,
    clientNonce: string
  ): Promise<Message | null> {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          sequence_number,
          client_nonce,
          content,
          message_type,
          reply_to_id,
          metadata,
          deleted_at,
          created_at,
          updated_at
        `)
        .eq('conversation_id', conversationId)
        .eq('client_nonce', clientNonce)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      this.markConfirmed(clientNonce);

      return {
        id: data.id,
        conversation_id: data.conversation_id,
        sender_id: data.sender_id,
        sequence_number: data.sequence_number != null ? Number(data.sequence_number) : undefined,
        client_nonce: data.client_nonce,
        content: data.content,
        message_type: data.message_type || 'text',
        reply_to_id: data.reply_to_id,
        metadata: data.metadata,
        deleted_at: data.deleted_at,
        created_at: data.created_at,
        updated_at: data.updated_at,
        status: 'sent',
      };
    } catch {
      return null;
    }
  }

  /**
   * Utility to check whether a Postgres/Supabase error indicates a 23505 duplicate key violation.
   */
  isDuplicateKeyError(error: any): boolean {
    if (!error) return false;
    return (
      error.code === '23505' ||
      (typeof error.message === 'string' &&
        (error.message.includes('unique constraint') || error.message.includes('duplicate key')))
    );
  }
}

export const idempotencyService = new IdempotencyService();
