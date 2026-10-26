// src/components/messaging/__tests__/messagesModel.test.ts
import { describe, expect, it } from 'vitest';
import {
  SWIPE_REVEAL,
  clampSwipe,
  filterConversations,
  lastPreview,
  resolveSwipeEnd,
} from '../messagesModel';
import type { Conversation } from '@/features/messaging/types/messaging.types';

const conv = (over: Partial<Conversation> = {}): Conversation =>
  ({
    id: 'c1',
    type: 'direct',
    last_message_at: '2026-10-26T08:00:00Z',
    created_at: '2026-10-25T08:00:00Z',
    updated_at: '2026-10-26T08:00:00Z',
    unread_count: 0,
    status: 'active',
    other_member: { id: 'u2', full_name: 'Alexandre' } as Conversation['other_member'],
    last_message: {
      id: 'm1',
      conversation_id: 'c1',
      sender_id: 'u2',
      sender_name: 'Alexandre',
      content: 'Salut',
      message_type: 'text',
      created_at: '2026-10-26T08:00:00Z',
    } as Conversation['last_message'],
    ...over,
  }) as Conversation;

describe('filterConversations', () => {
  it('écarte les fils supprimés pour moi', () => {
    const rows = [conv({ id: 'a' }), conv({ id: 'b', left_at: '2026-10-26T07:00:00Z' })];
    expect(filterConversations(rows, { filter: 'all', query: '' }).map((c) => c.id)).toEqual(['a']);
  });

  it('filtre par segment puis par texte', () => {
    const rows = [
      conv({ id: 'direct', type: 'direct' }),
      conv({ id: 'group', type: 'group', title: 'Dolomites — août' }),
    ];
    expect(filterConversations(rows, { filter: 'group', query: '' }).map((c) => c.id)).toEqual(['group']);
    expect(filterConversations(rows, { filter: 'all', query: 'dolo' }).map((c) => c.id)).toEqual(['group']);
  });

  it('les demandes en attente ne sortent que dans le segment Demandes', () => {
    const rows = [conv({ id: 'pending', status: 'pending' })];
    expect(filterConversations(rows, { filter: 'all', query: '' })).toHaveLength(0);
    expect(filterConversations(rows, { filter: 'requests', query: '' })).toHaveLength(1);
  });
});

describe('lastPreview', () => {
  it('nomme les pièces jointes plutôt que de montrer un identifiant', () => {
    const row = conv({
      last_message: {
        id: 'm2',
        conversation_id: 'c1',
        sender_id: 'u2',
        sender_name: 'Alexandre',
        content: 'https://cdn/x.jpg',
        message_type: 'image',
        created_at: '2026-10-26T08:00:00Z',
      } as Conversation['last_message'],
    });
    expect(lastPreview(row)).toBe('Photo');
  });
});

describe('geste de rangée', () => {
  it('borne le glissement vers la droite', () => {
    expect(clampSwipe(40, 0)).toBe(40);
    expect(clampSwipe(-20, 0)).toBe(0);
    expect(clampSwipe(400, 0)).toBe(SWIPE_REVEAL);
    expect(clampSwipe(-40, SWIPE_REVEAL)).toBe(SWIPE_REVEAL - 40);
  });

  it('ouvre au-delà de 40 % de la largeur révélée', () => {
    expect(resolveSwipeEnd(SWIPE_REVEAL * 0.5)).toEqual({ open: true, dx: SWIPE_REVEAL });
    expect(resolveSwipeEnd(SWIPE_REVEAL * 0.2)).toEqual({ open: false, dx: 0 });
  });
});
