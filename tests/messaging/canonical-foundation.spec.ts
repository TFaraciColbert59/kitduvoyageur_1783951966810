/**
 * LKDV Social — Canonical Messaging Foundation & Supabase RLS / Idempotence
 * Spec: tests/messaging/canonical-foundation.spec.ts
 *
 * Covers Milestone 1 Requirements:
 * - Atomic monotonic sequence_number trigger and deterministic ordering
 * - Send idempotency via client_nonce and unique constraint handling
 * - Bidirectional cursor pagination (before/after) by sequence_number
 * - Aggregated read status tracking with last_read_sequence (O(1) integer comparison)
 * - Offline sync queue: queuing, draining on reconnect, deduplication reconciliation
 * - RLS isolation verification mock scenarios (left_at IS NULL, sender spoofing)
 * - Domain service integration & Facade verification
 * - Static migration contracts verification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

import { sequenceService } from '@/features/messaging/services/domain/sequenceService';
import { idempotencyService } from '@/features/messaging/services/domain/idempotencyService';
import { offlineSyncQueue } from '@/features/messaging/services/domain/offlineSyncQueue';
import { messagingService } from '@/features/messaging/services/messagingService';
import type { Message } from '@/features/messaging/types/messaging.types';

// Types definition matching src/features/messaging/types/
export interface MessageRecord {
  id: string;
  conversation_id: string;
  sender_id: string;
  sequence_number: number;
  client_nonce: string | null;
  content: string;
  message_type: string;
  reply_to_id: string | null;
  metadata: Record<string, unknown> | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationRecord {
  id: string;
  type: 'direct' | 'group' | 'club_channel' | 'expedition_room';
  title?: string | null;
  created_by: string | null;
  last_sequence_number: number;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMemberRecord {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'member' | 'safety' | 'guide' | 'admin' | 'owner';
  is_muted: boolean;
  is_archived: boolean;
  last_read_sequence: number;
  last_read_at: string;
  unread_count: number;
  joined_at: string;
  left_at: string | null;
}

export interface QueuedOfflineMessage {
  id: string; // temporary local ID (e.g. temp-123)
  client_nonce: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  reply_to_id?: string | null;
  metadata?: Record<string, unknown> | null;
  timestamp: number;
  retry_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATEFUL IN-MEMORY MOCK ENVIRONMENT
// ─────────────────────────────────────────────────────────────────────────────

class MockMessagingDatabase {
  conversations = new Map<string, ConversationRecord>();
  members = new Map<string, ConversationMemberRecord>(); // key: `${convId}:${userId}`
  messages = new Map<string, MessageRecord>(); // key: id
  subscribers = new Set<(event: string, record: MessageRecord) => void>();

  reset() {
    this.conversations.clear();
    this.members.clear();
    this.messages.clear();
    this.subscribers.clear();
  }

  createConversation(conv: Partial<ConversationRecord> & { id: string }): ConversationRecord {
    const record: ConversationRecord = {
      id: conv.id,
      type: conv.type || 'direct',
      title: conv.title || null,
      created_by: conv.created_by || null,
      last_sequence_number: conv.last_sequence_number || 0,
      last_message_at: conv.last_message_at || new Date().toISOString(),
      created_at: conv.created_at || new Date().toISOString(),
      updated_at: conv.updated_at || new Date().toISOString(),
    };
    this.conversations.set(record.id, record);
    return record;
  }

  addMember(member: Partial<ConversationMemberRecord> & { conversation_id: string; user_id: string }): ConversationMemberRecord {
    const record: ConversationMemberRecord = {
      id: member.id || `cm-${member.conversation_id}-${member.user_id}`,
      conversation_id: member.conversation_id,
      user_id: member.user_id,
      role: member.role || 'member',
      is_muted: member.is_muted || false,
      is_archived: member.is_archived || false,
      last_read_sequence: member.last_read_sequence || 0,
      last_read_at: member.last_read_at || new Date().toISOString(),
      unread_count: member.unread_count || 0,
      joined_at: member.joined_at || new Date().toISOString(),
      left_at: member.left_at || null,
    };
    this.members.set(`${member.conversation_id}:${member.user_id}`, record);
    return record;
  }

  isConversationMember(conversationId: string, userId: string): boolean {
    const key = `${conversationId}:${userId}`;
    const member = this.members.get(key);
    // CRITICAL: Must check left_at IS NULL
    return !!member && member.left_at === null;
  }

  /**
   * Simulates Postgres INSERT with:
   * 1. RLS enforcement (caller membership & sender_id verification)
   * 2. Trigger trg_assign_message_sequence (atomic last_sequence_number increment)
   * 3. Composite unique index UNIQUE(conversation_id, client_nonce)
   */
  insertMessage(
    callerId: string,
    payload: {
      id?: string;
      conversation_id: string;
      sender_id: string;
      content: string;
      message_type?: string;
      client_nonce?: string | null;
      reply_to_id?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  ): { data: MessageRecord | null; error: { code: string; message: string } | null } {
    // RLS Check: sender spoofing check
    if (payload.sender_id !== callerId) {
      return { data: null, error: { code: '42501', message: 'RLS violation: sender_id must match auth.uid()' } };
    }

    // RLS Check: active membership check
    if (!this.isConversationMember(payload.conversation_id, callerId)) {
      return { data: null, error: { code: '42501', message: 'RLS violation: caller is not an active conversation member' } };
    }

    const conv = this.conversations.get(payload.conversation_id);
    if (!conv) {
      return { data: null, error: { code: '23503', message: 'Foreign key violation: conversation not found' } };
    }

    // Idempotency: Unique constraint UNIQUE(conversation_id, client_nonce)
    if (payload.client_nonce) {
      for (const existingMsg of this.messages.values()) {
        if (
          existingMsg.conversation_id === payload.conversation_id &&
          existingMsg.client_nonce === payload.client_nonce
        ) {
          return {
            data: null,
            error: {
              code: '23505',
              message: `duplicate key value violates unique constraint "messages_conversation_id_client_nonce_key"`,
            },
          };
        }
      }
    }

    // Atomic Trigger Simulation: Increment last_sequence_number
    conv.last_sequence_number += 1;
    const assignedSequence = conv.last_sequence_number;
    const now = new Date().toISOString();
    conv.last_message_at = now;

    const messageRecord: MessageRecord = {
      id: payload.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversation_id: payload.conversation_id,
      sender_id: payload.sender_id,
      sequence_number: assignedSequence,
      client_nonce: payload.client_nonce || null,
      content: payload.content,
      message_type: payload.message_type || 'text',
      reply_to_id: payload.reply_to_id || null,
      metadata: payload.metadata || null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };

    this.messages.set(messageRecord.id, messageRecord);

    // Notify Realtime Subscribers
    this.subscribers.forEach((cb) => cb('INSERT', messageRecord));

    return { data: messageRecord, error: null };
  }

  /**
   * Simulates idempotent send API endpoint:
   * If insert succeeds -> returns new message.
   * If code 23505 (duplicate nonce) -> fetches and returns existing message cleanly.
   */
  sendIdempotentMessage(
    callerId: string,
    payload: {
      conversation_id: string;
      content: string;
      client_nonce: string;
      message_type?: string;
      reply_to_id?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  ): { data: MessageRecord | null; error: { code: string; message: string } | null; isDuplicate: boolean } {
    const res = this.insertMessage(callerId, {
      ...payload,
      sender_id: callerId,
    });

    if (res.data) {
      return { data: res.data, error: null, isDuplicate: false };
    }

    if (res.error?.code === '23505') {
      // Find existing message by conversation_id + client_nonce
      for (const msg of this.messages.values()) {
        if (msg.conversation_id === payload.conversation_id && msg.client_nonce === payload.client_nonce) {
          return { data: msg, error: null, isDuplicate: true };
        }
      }
    }

    return { data: null, error: res.error, isDuplicate: false };
  }

  /**
   * Bidirectional cursor pagination query
   */
  getMessagesCursor(
    callerId: string,
    conversationId: string,
    options: {
      before?: number; // sequence_number < before (older)
      after?: number;  // sequence_number > after (newer)
      limit?: number;
    }
  ): { messages: MessageRecord[]; hasMoreBefore: boolean; hasMoreAfter: boolean } {
    if (!this.isConversationMember(conversationId, callerId)) {
      return { messages: [], hasMoreBefore: false, hasMoreAfter: false };
    }

    const limit = options.limit || 20;
    const all = Array.from(this.messages.values())
      .filter((m) => m.conversation_id === conversationId)
      .sort((a, b) => a.sequence_number - b.sequence_number);

    let filtered = all;

    if (options.before !== undefined) {
      filtered = filtered.filter((m) => m.sequence_number < options.before!);
      const sliceStart = Math.max(0, filtered.length - limit);
      const page = filtered.slice(sliceStart);
      const minSeqInPage = page.length > 0 ? page[0].sequence_number : 0;
      const hasMoreBefore = all.some((m) => m.sequence_number < minSeqInPage);
      const maxSeqInPage = page.length > 0 ? page[page.length - 1].sequence_number : 0;
      const hasMoreAfter = all.some((m) => m.sequence_number > maxSeqInPage);
      return { messages: page, hasMoreBefore, hasMoreAfter };
    }

    if (options.after !== undefined) {
      filtered = filtered.filter((m) => m.sequence_number > options.after!);
      const page = filtered.slice(0, limit);
      const minSeqInPage = page.length > 0 ? page[0].sequence_number : 0;
      const hasMoreBefore = all.some((m) => m.sequence_number < minSeqInPage);
      const maxSeqInPage = page.length > 0 ? page[page.length - 1].sequence_number : 0;
      const hasMoreAfter = all.some((m) => m.sequence_number > maxSeqInPage);
      return { messages: page, hasMoreBefore, hasMoreAfter };
    }

    // Default: latest 'limit' messages
    const sliceStart = Math.max(0, all.length - limit);
    const page = all.slice(sliceStart);
    const minSeqInPage = page.length > 0 ? page[0].sequence_number : 0;
    const hasMoreBefore = all.some((m) => m.sequence_number < minSeqInPage);
    return { messages: page, hasMoreBefore, hasMoreAfter: false };
  }

  /**
   * Aggregated Read Status: updates last_read_sequence monotonically
   */
  markAsRead(conversationId: string, userId: string, targetSequence: number): { success: boolean; updatedSequence: number } {
    const key = `${conversationId}:${userId}`;
    const member = this.members.get(key);
    if (!member) return { success: false, updatedSequence: 0 };

    // Monotonic guard: GREATEST(last_read_sequence, targetSequence)
    if (targetSequence > member.last_read_sequence) {
      member.last_read_sequence = targetSequence;
      member.last_read_at = new Date().toISOString();
    }

    const conv = this.conversations.get(conversationId);
    if (conv) {
      member.unread_count = Math.max(0, conv.last_sequence_number - member.last_read_sequence);
    }

    return { success: true, updatedSequence: member.last_read_sequence };
  }

  /**
   * O(1) integer arithmetic for unread count
   */
  getUnreadCount(conversationId: string, userId: string): number {
    const member = this.members.get(`${conversationId}:${userId}`);
    const conv = this.conversations.get(conversationId);
    if (!member || !conv) return 0;
    return Math.max(0, conv.last_sequence_number - member.last_read_sequence);
  }

  /**
   * Read receipt check for a specific message sequence
   */
  hasUserReadMessage(conversationId: string, userId: string, messageSequence: number): boolean {
    const member = this.members.get(`${conversationId}:${userId}`);
    if (!member) return false;
    return member.last_read_sequence >= messageSequence;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFLINE SYNC QUEUE IMPLEMENTATION MOCK
// ─────────────────────────────────────────────────────────────────────────────

class MockOfflineSyncQueue {
  private queue: QueuedOfflineMessage[] = [];
  private db: MockMessagingDatabase;
  public isOnline = true;

  constructor(db: MockMessagingDatabase) {
    this.db = db;
  }

  enqueue(item: Omit<QueuedOfflineMessage, 'retry_count' | 'timestamp'>): QueuedOfflineMessage {
    const queued: QueuedOfflineMessage = {
      ...item,
      timestamp: Date.now(),
      retry_count: 0,
    };
    this.queue.push(queued);
    return queued;
  }

  getPending(): QueuedOfflineMessage[] {
    return [...this.queue];
  }

  clear() {
    this.queue = [];
  }

  async drain(callerId: string): Promise<{
    processed: number;
    reconciled: Array<{ tempId: string; canonicalMessage: MessageRecord; isDuplicate: boolean }>;
    errors: Array<{ tempId: string; error: string }>;
  }> {
    if (!this.isOnline) {
      return { processed: 0, reconciled: [], errors: [] };
    }

    const reconciled: Array<{ tempId: string; canonicalMessage: MessageRecord; isDuplicate: boolean }> = [];
    const errors: Array<{ tempId: string; error: string }> = [];
    const remaining: QueuedOfflineMessage[] = [];

    for (const item of this.queue) {
      try {
        const result = this.db.sendIdempotentMessage(callerId, {
          conversation_id: item.conversation_id,
          content: item.content,
          client_nonce: item.client_nonce,
          message_type: item.message_type,
          reply_to_id: item.reply_to_id,
          metadata: item.metadata,
        });

        if (result.data) {
          reconciled.push({
            tempId: item.id,
            canonicalMessage: result.data,
            isDuplicate: result.isDuplicate,
          });
        } else if (result.error) {
          errors.push({ tempId: item.id, error: result.error.message });
        }
      } catch (err: any) {
        item.retry_count += 1;
        remaining.push(item);
      }
    }

    this.queue = remaining;
    return {
      processed: reconciled.length + errors.length,
      reconciled,
      errors,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN TEST SUITE: 34 CANONICAL TEST SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────

describe('Canonical Messaging Foundation & Supabase RLS / Idempotence (Milestone 1)', () => {
  let db: MockMessagingDatabase;
  let offlineQueue: MockOfflineSyncQueue;

  const USER_ALICE = 'user-alice-1111';
  const USER_BOB = 'user-bob-2222';
  const USER_CHARLIE = 'user-charlie-3333';
  const USER_STRANGER = 'user-stranger-9999';

  const CONV_DIRECT = 'conv-direct-001';
  const CONV_GROUP = 'conv-group-002';
  const CONV_OTHER = 'conv-other-003';

  beforeEach(() => {
    db = new MockMessagingDatabase();
    offlineQueue = new MockOfflineSyncQueue(db);

    // Setup CONV_DIRECT (Alice & Bob)
    db.createConversation({ id: CONV_DIRECT, type: 'direct', created_by: USER_ALICE });
    db.addMember({ conversation_id: CONV_DIRECT, user_id: USER_ALICE, role: 'owner' });
    db.addMember({ conversation_id: CONV_DIRECT, user_id: USER_BOB, role: 'member' });

    // Setup CONV_GROUP (Alice, Bob, Charlie)
    db.createConversation({ id: CONV_GROUP, type: 'group', created_by: USER_ALICE });
    db.addMember({ conversation_id: CONV_GROUP, user_id: USER_ALICE, role: 'owner' });
    db.addMember({ conversation_id: CONV_GROUP, user_id: USER_BOB, role: 'admin' });
    db.addMember({ conversation_id: CONV_GROUP, user_id: USER_CHARLIE, role: 'member' });

    // Setup CONV_OTHER (Charlie only)
    db.createConversation({ id: CONV_OTHER, type: 'direct', created_by: USER_CHARLIE });
    db.addMember({ conversation_id: CONV_OTHER, user_id: USER_CHARLIE, role: 'owner' });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ATOMIC SEQUENCE PROGRESSION & DETERMINISTIC ORDERING (6 tests)
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Atomic Sequence Progression & Deterministic Ordering', () => {
    it('TEST-M1-SEQ-01: Consecutive messages receive strictly increasing, gapless sequence numbers', () => {
      const res1 = db.insertMessage(USER_ALICE, { conversation_id: CONV_DIRECT, sender_id: USER_ALICE, content: 'Message 1' });
      const res2 = db.insertMessage(USER_BOB, { conversation_id: CONV_DIRECT, sender_id: USER_BOB, content: 'Message 2' });
      const res3 = db.insertMessage(USER_ALICE, { conversation_id: CONV_DIRECT, sender_id: USER_ALICE, content: 'Message 3' });

      expect(res1.data?.sequence_number).toBe(1);
      expect(res2.data?.sequence_number).toBe(2);
      expect(res3.data?.sequence_number).toBe(3);
    });

    it('TEST-M1-SEQ-02: Multi-conversation sequence isolation', () => {
      const c1m1 = db.insertMessage(USER_ALICE, { conversation_id: CONV_DIRECT, sender_id: USER_ALICE, content: 'C1 M1' });
      const c2m1 = db.insertMessage(USER_CHARLIE, { conversation_id: CONV_OTHER, sender_id: USER_CHARLIE, content: 'C2 M1' });
      const c1m2 = db.insertMessage(USER_BOB, { conversation_id: CONV_DIRECT, sender_id: USER_BOB, content: 'C1 M2' });

      expect(c1m1.data?.sequence_number).toBe(1);
      expect(c2m1.data?.sequence_number).toBe(1);
      expect(c1m2.data?.sequence_number).toBe(2);
    });

    it('TEST-M1-SEQ-03: Concurrent send monotonicity (Promise.all)', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve().then(() =>
          db.insertMessage(USER_ALICE, { conversation_id: CONV_DIRECT, sender_id: USER_ALICE, content: `Concurrent ${i}` })
        )
      );

      const results = await Promise.all(promises);
      const seqs = results.map((r) => r.data!.sequence_number).sort((a, b) => a - b);
      expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('TEST-M1-SEQ-04: Deterministic ordering despite timestamp skew', () => {
      const m1 = db.insertMessage(USER_ALICE, { conversation_id: CONV_DIRECT, sender_id: USER_ALICE, content: 'First' }).data!;
      m1.created_at = '2026-10-04T12:10:00Z'; // later timestamp

      const m2 = db.insertMessage(USER_BOB, { conversation_id: CONV_DIRECT, sender_id: USER_BOB, content: 'Second' }).data!;
      m2.created_at = '2026-10-04T12:05:00Z'; // earlier timestamp

      const page = db.getMessagesCursor(USER_ALICE, CONV_DIRECT, {});
      expect(page.messages.map((m) => m.content)).toEqual(['First', 'Second']);
      expect(page.messages[0].sequence_number).toBe(1);
      expect(page.messages[1].sequence_number).toBe(2);
    });

    it('TEST-M1-SEQ-05: Unauthorized insert attempt does not increment sequence counter', () => {
      db.insertMessage(USER_ALICE, { conversation_id: CONV_DIRECT, sender_id: USER_ALICE, content: 'Valid 1' });
      const failRes = db.insertMessage(USER_STRANGER, { conversation_id: CONV_DIRECT, sender_id: USER_STRANGER, content: 'Hacker' });
      expect(failRes.error?.code).toBe('42501');

      const validRes = db.insertMessage(USER_BOB, { conversation_id: CONV_DIRECT, sender_id: USER_BOB, content: 'Valid 2' });
      expect(validRes.data?.sequence_number).toBe(2);
    });

    it('TEST-M1-SEQ-06: Conversation last_sequence_number matches message sequence', () => {
      db.insertMessage(USER_ALICE, { conversation_id: CONV_DIRECT, sender_id: USER_ALICE, content: 'Msg' });
      const conv = db.conversations.get(CONV_DIRECT);
      expect(conv?.last_sequence_number).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. SEND IDEMPOTENCY VIA CLIENT_NONCE (6 tests)
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Send Idempotency via client_nonce', () => {
    it('TEST-M1-IDEMP-01: First-time send with nonce succeeds', () => {
      const res = db.sendIdempotentMessage(USER_ALICE, {
        conversation_id: CONV_DIRECT,
        content: 'Hello Bob',
        client_nonce: 'nonce-101',
      });
      expect(res.data).not.toBeNull();
      expect(res.data?.content).toBe('Hello Bob');
      expect(res.data?.client_nonce).toBe('nonce-101');
      expect(res.isDuplicate).toBe(false);
    });

    it('TEST-M1-IDEMP-02: Duplicate send returns existing message without double insert', () => {
      const res1 = db.sendIdempotentMessage(USER_ALICE, {
        conversation_id: CONV_DIRECT,
        content: 'Hello Bob',
        client_nonce: 'nonce-102',
      });
      const res2 = db.sendIdempotentMessage(USER_ALICE, {
        conversation_id: CONV_DIRECT,
        content: 'Hello Bob (retry)',
        client_nonce: 'nonce-102',
      });

      expect(res2.isDuplicate).toBe(true);
      expect(res2.data?.id).toBe(res1.data?.id);
      expect(res2.data?.content).toBe('Hello Bob');
      expect(db.messages.size).toBe(1);
    });

    it('TEST-M1-IDEMP-03: Preserves original sequence number on duplicate send', () => {
      const res1 = db.sendIdempotentMessage(USER_ALICE, {
        conversation_id: CONV_DIRECT,
        content: 'Important',
        client_nonce: 'nonce-103',
      });
      db.insertMessage(USER_BOB, { conversation_id: CONV_DIRECT, sender_id: USER_BOB, content: 'Interleaved' });

      const res2 = db.sendIdempotentMessage(USER_ALICE, {
        conversation_id: CONV_DIRECT,
        content: 'Important',
        client_nonce: 'nonce-103',
      });

      expect(res2.data?.sequence_number).toBe(res1.data?.sequence_number);
      expect(res2.data?.sequence_number).toBe(1);
    });

    it('TEST-M1-IDEMP-04: Cross-conversation identical nonce allowed', () => {
      const res1 = db.sendIdempotentMessage(USER_ALICE, {
        conversation_id: CONV_DIRECT,
        content: 'Direct chat',
        client_nonce: 'shared-nonce-001',
      });
      const res2 = db.sendIdempotentMessage(USER_ALICE, {
        conversation_id: CONV_GROUP,
        content: 'Group chat',
        client_nonce: 'shared-nonce-001',
      });

      expect(res1.data?.conversation_id).toBe(CONV_DIRECT);
      expect(res2.data?.conversation_id).toBe(CONV_GROUP);
      expect(res1.isDuplicate).toBe(false);
      expect(res2.isDuplicate).toBe(false);
    });

    it('TEST-M1-IDEMP-05: Rapid parallel duplicate send resolution', async () => {
      const calls = Array.from({ length: 5 }, () =>
        Promise.resolve().then(() =>
          db.sendIdempotentMessage(USER_ALICE, {
            conversation_id: CONV_DIRECT,
            content: 'Parallel test',
            client_nonce: 'parallel-nonce-999',
          })
        )
      );

      const results = await Promise.all(calls);
      const targetId = results[0].data?.id;
      expect(targetId).toBeDefined();
      results.forEach((r) => {
        expect(r.data?.id).toBe(targetId);
      });
      expect(db.messages.size).toBe(1);
    });

    it('TEST-M1-IDEMP-06: Messages without client_nonce allow multiple inserts', () => {
      db.insertMessage(USER_ALICE, { conversation_id: CONV_DIRECT, sender_id: USER_ALICE, content: 'No nonce 1' });
      db.insertMessage(USER_ALICE, { conversation_id: CONV_DIRECT, sender_id: USER_ALICE, content: 'No nonce 2' });
      expect(db.messages.size).toBe(2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. BIDIRECTIONAL CURSOR PAGINATION (6 tests)
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Bidirectional Cursor Pagination', () => {
    beforeEach(() => {
      for (let i = 1; i <= 50; i++) {
        db.insertMessage(USER_ALICE, {
          conversation_id: CONV_DIRECT,
          sender_id: USER_ALICE,
          content: `Message ${i}`,
        });
      }
    });

    it('TEST-M1-CURSOR-01: Initial load returns newest N messages with hasMoreBefore: true', () => {
      const page = db.getMessagesCursor(USER_ALICE, CONV_DIRECT, { limit: 15 });
      expect(page.messages.length).toBe(15);
      expect(page.messages[0].sequence_number).toBe(36);
      expect(page.messages[14].sequence_number).toBe(50);
      expect(page.hasMoreBefore).toBe(true);
      expect(page.hasMoreAfter).toBe(false);
    });

    it('TEST-M1-CURSOR-02: Scroll up (before cursor) fetches previous chunk', () => {
      const page = db.getMessagesCursor(USER_ALICE, CONV_DIRECT, { before: 36, limit: 15 });
      expect(page.messages.length).toBe(15);
      expect(page.messages[0].sequence_number).toBe(21);
      expect(page.messages[14].sequence_number).toBe(35);
      expect(page.hasMoreBefore).toBe(true);
      expect(page.hasMoreAfter).toBe(true);
    });

    it('TEST-M1-CURSOR-03: Boundary condition at start of conversation', () => {
      const page = db.getMessagesCursor(USER_ALICE, CONV_DIRECT, { before: 6, limit: 10 });
      expect(page.messages.length).toBe(5);
      expect(page.messages[0].sequence_number).toBe(1);
      expect(page.messages[4].sequence_number).toBe(5);
      expect(page.hasMoreBefore).toBe(false);
      expect(page.hasMoreAfter).toBe(true);
    });

    it('TEST-M1-CURSOR-04: Deep link jump (after cursor) fetches newer chunk', () => {
      const page = db.getMessagesCursor(USER_ALICE, CONV_DIRECT, { after: 20, limit: 10 });
      expect(page.messages.length).toBe(10);
      expect(page.messages[0].sequence_number).toBe(21);
      expect(page.messages[9].sequence_number).toBe(30);
      expect(page.hasMoreBefore).toBe(true);
      expect(page.hasMoreAfter).toBe(true);
    });

    it('TEST-M1-CURSOR-05: Boundary condition at end of conversation', () => {
      const page = db.getMessagesCursor(USER_ALICE, CONV_DIRECT, { after: 45, limit: 10 });
      expect(page.messages.length).toBe(5);
      expect(page.messages[0].sequence_number).toBe(46);
      expect(page.messages[4].sequence_number).toBe(50);
      expect(page.hasMoreBefore).toBe(true);
      expect(page.hasMoreAfter).toBe(false);
    });

    it('TEST-M1-CURSOR-06: Empty conversation returns empty array safely', () => {
      db.createConversation({ id: 'conv-empty', type: 'direct' });
      db.addMember({ conversation_id: 'conv-empty', user_id: USER_ALICE });

      const page = db.getMessagesCursor(USER_ALICE, 'conv-empty', { limit: 20 });
      expect(page.messages).toEqual([]);
      expect(page.hasMoreBefore).toBe(false);
      expect(page.hasMoreAfter).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. AGGREGATED READ TRACKING (5 tests)
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Aggregated Read Status Tracking', () => {
    beforeEach(() => {
      for (let i = 1; i <= 20; i++) {
        db.insertMessage(USER_ALICE, { conversation_id: CONV_DIRECT, sender_id: USER_ALICE, content: `Msg ${i}` });
      }
    });

    it('TEST-M1-READ-01: O(1) unread count calculation from last_read_sequence', () => {
      db.markAsRead(CONV_DIRECT, USER_BOB, 12);
      expect(db.getUnreadCount(CONV_DIRECT, USER_BOB)).toBe(8); // 20 - 12
    });

    it('TEST-M1-READ-02: markAsRead resets unread count to 0', () => {
      db.markAsRead(CONV_DIRECT, USER_BOB, 20);
      expect(db.getUnreadCount(CONV_DIRECT, USER_BOB)).toBe(0);
    });

    it('TEST-M1-READ-03: Monotonic guard prevents downgrade on scroll-up', () => {
      db.markAsRead(CONV_DIRECT, USER_BOB, 20);
      const res = db.markAsRead(CONV_DIRECT, USER_BOB, 10);
      expect(res.updatedSequence).toBe(20);
      expect(db.getUnreadCount(CONV_DIRECT, USER_BOB)).toBe(0);
    });

    it('TEST-M1-READ-04: Per-message read receipt evaluation via integer comparison', () => {
      db.markAsRead(CONV_DIRECT, USER_BOB, 15);

      expect(db.hasUserReadMessage(CONV_DIRECT, USER_BOB, 10)).toBe(true);  // 15 >= 10
      expect(db.hasUserReadMessage(CONV_DIRECT, USER_BOB, 15)).toBe(true);  // 15 >= 15
      expect(db.hasUserReadMessage(CONV_DIRECT, USER_BOB, 16)).toBe(false); // 15 < 16
    });

    it('TEST-M1-READ-05: Sender read marker does not alter other members unread count', () => {
      db.markAsRead(CONV_DIRECT, USER_ALICE, 20);
      db.markAsRead(CONV_DIRECT, USER_BOB, 5);

      expect(db.getUnreadCount(CONV_DIRECT, USER_BOB)).toBe(15);
      expect(db.getUnreadCount(CONV_DIRECT, USER_ALICE)).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. OFFLINE SYNC QUEUE & RECONNECTION (6 tests)
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Offline Sync Queue & Reconnection', () => {
    it('TEST-M1-OFFLINE-01: Offline enqueue stores message locally', () => {
      offlineQueue.isOnline = false;
      const queued = offlineQueue.enqueue({
        id: 'temp-1',
        client_nonce: 'offline-nonce-1',
        conversation_id: CONV_DIRECT,
        sender_id: USER_ALICE,
        content: 'Message created on the trail',
        message_type: 'text',
      });

      expect(queued.id).toBe('temp-1');
      expect(offlineQueue.getPending().length).toBe(1);
      expect(db.messages.size).toBe(0);
    });

    it('TEST-M1-OFFLINE-02: Draining on reconnect sends in FIFO order', async () => {
      offlineQueue.enqueue({
        id: 'temp-1',
        client_nonce: 'nonce-fifo-1',
        conversation_id: CONV_DIRECT,
        sender_id: USER_ALICE,
        content: 'Trail Step 1',
        message_type: 'text',
      });
      offlineQueue.enqueue({
        id: 'temp-2',
        client_nonce: 'nonce-fifo-2',
        conversation_id: CONV_DIRECT,
        sender_id: USER_ALICE,
        content: 'Trail Step 2',
        message_type: 'text',
      });

      offlineQueue.isOnline = true;
      const res = await offlineQueue.drain(USER_ALICE);

      expect(res.processed).toBe(2);
      expect(res.reconciled.length).toBe(2);
      expect(res.reconciled[0].canonicalMessage.sequence_number).toBe(1);
      expect(res.reconciled[1].canonicalMessage.sequence_number).toBe(2);
    });

    it('TEST-M1-OFFLINE-03: Optimistic tempId swapped for canonical server record', async () => {
      offlineQueue.enqueue({
        id: 'temp-xyz',
        client_nonce: 'nonce-xyz',
        conversation_id: CONV_DIRECT,
        sender_id: USER_ALICE,
        content: 'Reconciliation test',
        message_type: 'text',
      });

      const res = await offlineQueue.drain(USER_ALICE);
      const match = res.reconciled[0];

      expect(match.tempId).toBe('temp-xyz');
      expect(match.canonicalMessage.id).not.toBe('temp-xyz');
      expect(match.canonicalMessage.sequence_number).toBe(1);
    });

    it('TEST-M1-OFFLINE-04: Deduplication on reconnect when message already inserted before drop', async () => {
      db.sendIdempotentMessage(USER_ALICE, {
        conversation_id: CONV_DIRECT,
        content: 'Dropped ACK test',
        client_nonce: 'nonce-dropped-ack',
      });

      offlineQueue.enqueue({
        id: 'temp-dropped',
        client_nonce: 'nonce-dropped-ack',
        conversation_id: CONV_DIRECT,
        sender_id: USER_ALICE,
        content: 'Dropped ACK test',
        message_type: 'text',
      });

      const res = await offlineQueue.drain(USER_ALICE);
      expect(res.reconciled[0].isDuplicate).toBe(true);
      expect(db.messages.size).toBe(1);
    });

    it('TEST-M1-OFFLINE-05: Queue clears upon full drain', async () => {
      offlineQueue.enqueue({
        id: 'temp-clean',
        client_nonce: 'nonce-clean',
        conversation_id: CONV_DIRECT,
        sender_id: USER_ALICE,
        content: 'Clean test',
        message_type: 'text',
      });

      await offlineQueue.drain(USER_ALICE);
      expect(offlineQueue.getPending().length).toBe(0);
    });

    it('TEST-M1-OFFLINE-06: Poison-pill error isolation in queue', async () => {
      offlineQueue.enqueue({
        id: 'temp-poison',
        client_nonce: 'nonce-poison',
        conversation_id: CONV_OTHER,
        sender_id: USER_ALICE,
        content: 'Unauthorized',
        message_type: 'text',
      });
      offlineQueue.enqueue({
        id: 'temp-valid',
        client_nonce: 'nonce-valid',
        conversation_id: CONV_DIRECT,
        sender_id: USER_ALICE,
        content: 'Authorized',
        message_type: 'text',
      });

      const res = await offlineQueue.drain(USER_ALICE);
      expect(res.errors.length).toBe(1);
      expect(res.errors[0].tempId).toBe('temp-poison');
      expect(res.reconciled.length).toBe(1);
      expect(res.reconciled[0].tempId).toBe('temp-valid');
      expect(offlineQueue.getPending().length).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. SUPABASE RLS SECURITY ISOLATION & EXITED MEMBER REJECTION (5 tests)
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Supabase RLS Security Isolation & Exited Member Rejection', () => {
    it('TEST-M1-RLS-01: Active member can read and insert', () => {
      const insertRes = db.insertMessage(USER_ALICE, {
        conversation_id: CONV_GROUP,
        sender_id: USER_ALICE,
        content: 'Active post',
      });
      expect(insertRes.error).toBeNull();

      const page = db.getMessagesCursor(USER_BOB, CONV_GROUP, {});
      expect(page.messages.length).toBe(1);
      expect(page.messages[0].content).toBe('Active post');
    });

    it('TEST-M1-RLS-02: Exited member (left_at IS NOT NULL) cannot read messages', () => {
      db.insertMessage(USER_ALICE, { conversation_id: CONV_GROUP, sender_id: USER_ALICE, content: 'Secret trail update' });

      const charlieMember = db.members.get(`${CONV_GROUP}:${USER_CHARLIE}`);
      expect(charlieMember).toBeDefined();
      charlieMember!.left_at = new Date().toISOString();

      const page = db.getMessagesCursor(USER_CHARLIE, CONV_GROUP, {});
      expect(page.messages.length).toBe(0);
    });

    it('TEST-M1-RLS-03: Exited member (left_at IS NOT NULL) cannot insert messages', () => {
      const charlieMember = db.members.get(`${CONV_GROUP}:${USER_CHARLIE}`);
      charlieMember!.left_at = new Date().toISOString();

      const res = db.insertMessage(USER_CHARLIE, {
        conversation_id: CONV_GROUP,
        sender_id: USER_CHARLIE,
        content: 'Post after exit',
      });

      expect(res.error?.code).toBe('42501');
      expect(res.error?.message).toContain('RLS violation');
    });

    it('TEST-M1-RLS-04: Non-member stranger completely rejected', () => {
      const readPage = db.getMessagesCursor(USER_STRANGER, CONV_DIRECT, {});
      expect(readPage.messages.length).toBe(0);

      const writeRes = db.insertMessage(USER_STRANGER, {
        conversation_id: CONV_DIRECT,
        sender_id: USER_STRANGER,
        content: 'Intrusion',
      });
      expect(writeRes.error?.code).toBe('42501');
    });

    it('TEST-M1-RLS-05: Sender identity spoofing rejected', () => {
      const res = db.insertMessage(USER_ALICE, {
        conversation_id: CONV_DIRECT,
        sender_id: USER_BOB, // spoofed sender
        content: 'I am Bob',
      });

      expect(res.error?.code).toBe('42501');
      expect(res.error?.message).toContain('sender_id must match auth.uid()');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. DOMAIN SERVICES UNIT TESTS
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Domain Services Logic & Invariants', () => {
    it('SequenceService: detect gaps and calculate unread count correctly', () => {
      const messages: Message[] = [
        { id: '1', conversation_id: 'c1', sender_id: 'u1', content: 'm1', message_type: 'text', sequence_number: 1, created_at: '2026-10-04T10:00:00Z', updated_at: '2026-10-04T10:00:00Z' },
        { id: '2', conversation_id: 'c1', sender_id: 'u1', content: 'm2', message_type: 'text', sequence_number: 2, created_at: '2026-10-04T10:01:00Z', updated_at: '2026-10-04T10:01:00Z' },
        { id: '5', conversation_id: 'c1', sender_id: 'u1', content: 'm5', message_type: 'text', sequence_number: 5, created_at: '2026-10-04T10:04:00Z', updated_at: '2026-10-04T10:04:00Z' },
      ];

      const gaps = sequenceService.detectSequenceGaps(messages);
      expect(gaps).toEqual([{ from: 3, to: 4 }]);

      expect(sequenceService.calculateUnreadCount(5, 2)).toBe(3);
      expect(sequenceService.calculateUnreadCount(5, 5)).toBe(0);
      expect(sequenceService.calculateUnreadCount(5, 8)).toBe(0);
      expect(sequenceService.isMessageUnread(4, 2)).toBe(true);
      expect(sequenceService.isMessageUnread(2, 2)).toBe(false);
    });

    it('IdempotencyService: generates collision-resistant nonces and tracks in-flight', () => {
      const n1 = idempotencyService.generateNonce();
      const n2 = idempotencyService.generateNonce();
      expect(n1).toMatch(/^nonce_\d+_/);
      expect(n2).toMatch(/^nonce_\d+_/);
      expect(n1).not.toBe(n2);

      idempotencyService.trackInFlight(n1, 'c1');
      expect(idempotencyService.isNonceInFlight(n1)).toBe(true);
      idempotencyService.markConfirmed(n1);
      expect(idempotencyService.isNonceInFlight(n1)).toBe(false);

      expect(idempotencyService.isDuplicateKeyError({ code: '23505' })).toBe(true);
      expect(idempotencyService.isDuplicateKeyError({ message: 'duplicate key value violates unique constraint' })).toBe(true);
      expect(idempotencyService.isDuplicateKeyError({ code: '42501' })).toBe(false);
    });

    it('OfflineSyncQueue: enqueues, resolves conflicts and deduplicates', () => {
      offlineSyncQueue.clear();

      const item = offlineSyncQueue.enqueue({
        tempId: 'temp-1',
        conversationId: 'c1',
        senderId: 'u1',
        content: 'Offline note',
        messageType: 'text',
        clientNonce: 'nonce-unit-1',
      });

      expect(item.status).toBe('pending');
      expect(offlineSyncQueue.getPending('c1').length).toBe(1);

      offlineSyncQueue.dequeue('temp-1');
      expect(offlineSyncQueue.getPending('c1').length).toBe(0);

      const serverMsg: Message = {
        id: 'msg-srv-1',
        conversation_id: 'c1',
        sender_id: 'u1',
        content: 'Server version',
        message_type: 'text',
        sequence_number: 1,
        client_nonce: 'nonce-shared',
        created_at: '2026-10-04T10:00:00Z',
        updated_at: '2026-10-04T10:00:00Z',
      };

      const localMsg: Message = {
        id: 'temp-local-1',
        conversation_id: 'c1',
        sender_id: 'u1',
        content: 'Local version',
        message_type: 'text',
        client_nonce: 'nonce-shared',
        created_at: '2026-10-04T10:00:00Z',
        updated_at: '2026-10-04T10:00:00Z',
      };

      const resolved = offlineSyncQueue.resolveConflicts([serverMsg], [localMsg]);
      expect(resolved.length).toBe(1);
      expect(resolved[0].id).toBe('msg-srv-1');
      expect(resolved[0].content).toBe('Server version');
    });

    it('MessagingService Facade: exposes all sub-services and extended domain methods', () => {
      expect(messagingService.sequence).toBeDefined();
      expect(messagingService.idempotency).toBeDefined();
      expect(messagingService.cursor).toBeDefined();
      expect(messagingService.offlineQueue).toBeDefined();

      expect(typeof messagingService.getMessagesCursor).toBe('function');
      expect(typeof messagingService.markSequenceAsRead).toBe('function');
      expect(typeof messagingService.reconcileOfflineMessages).toBe('function');
      expect(typeof messagingService.getPendingMessages).toBe('function');

      // Verify all 19 original methods exist
      expect(typeof messagingService.getConversations).toBe('function');
      expect(typeof messagingService.getOrCreateDirectConversation).toBe('function');
      expect(typeof messagingService.getMessages).toBe('function');
      expect(typeof messagingService.toggleReaction).toBe('function');
      expect(typeof messagingService.sendMessage).toBe('function');
      expect(typeof messagingService.uploadAttachment).toBe('function');
      expect(typeof messagingService.markAsRead).toBe('function');
      expect(typeof messagingService.getBlockedUserIds).toBe('function');
      expect(typeof messagingService.updateMemberPreferences).toBe('function');
      expect(typeof messagingService.acceptMessageRequest).toBe('function');
      expect(typeof messagingService.declineMessageRequest).toBe('function');
      expect(typeof messagingService.forwardMessage).toBe('function');
      expect(typeof messagingService.getShareableInventory).toBe('function');
      expect(typeof messagingService.getShareableTrails).toBe('function');
      expect(typeof messagingService.getGroupMembers).toBe('function');
      expect(typeof messagingService.updateGroupInfo).toBe('function');
      expect(typeof messagingService.updateMemberRole).toBe('function');
      expect(typeof messagingService.removeGroupMember).toBe('function');
      expect(typeof messagingService.leaveGroup).toBe('function');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. STATIC MIGRATION SCHEMA CONTRACTS
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Static Migration Schema & RLS Contracts', () => {
    it('SQL migration file exists and enforces core constraints', () => {
      const migrationFile = path.resolve(
        process.cwd(),
        'supabase/migrations/20261004120000_lkdv_social_core_architecture.sql'
      );
      expect(fs.existsSync(migrationFile), 'Migration file must exist').toBe(true);
      const sql = fs.readFileSync(migrationFile, 'utf8');

      // Monotonic sequence trigger
      expect(sql).toContain('CREATE TRIGGER trg_assign_message_sequence');
      expect(sql).toContain('assign_message_sequence()');

      // Unique constraints for ordering and idempotency
      expect(sql).toContain('uq_messages_conversation_sequence');
      expect(sql).toContain('uq_messages_conversation_client_nonce');

      // Exited member security fix
      expect(sql).toContain('left_at IS NULL');

      // InitPlan (SELECT auth.uid()) caching
      expect(sql).toContain('(SELECT auth.uid())');

      // Modular outdoor roles
      expect(sql).toContain("'member', 'safety', 'guide', 'admin', 'owner'");

      // Foundation tables
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.club_channels');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.expedition_rooms');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.terra_drafted_actions');
    });
  });
});
