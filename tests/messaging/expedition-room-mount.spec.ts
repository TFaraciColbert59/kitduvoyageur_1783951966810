/**
 * R3 — Expedition Room : montage réel du cockpit unifié dans ConversationView.
 *
 * Vérifie que la conversation est réunie dans une même vue (discussion +
 * météo + tracé GPX + checklist partagée + points de situation) lorsque le
 * contexte de conversation est 'expedition_room', et que les conversations
 * simples conservent la vue standard.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/image', () => ({
  default: (props: any) => React.createElement('img', { alt: props.alt || '' }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ haptic: vi.fn(), triggerHaptic: vi.fn() }),
}));

vi.mock('@/features/messaging/hooks/useMessages', () => ({
  useMessages: () => ({
    messages: [],
    loading: false,
    sendMessage: vi.fn(),
    toggleReaction: vi.fn(),
    refreshMessages: vi.fn(),
  }),
}));

vi.mock('@/features/messaging/hooks/useRealtimeMessaging', () => ({
  useRealtimeMessaging: () => ({ typingUserNames: [], sendTypingSignal: vi.fn() }),
}));

vi.mock('@/features/messaging/services/messagingService', () => ({
  messagingService: {
    getGroupMembers: vi.fn().mockResolvedValue([]),
    uploadAttachment: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

vi.mock('@/features/messaging/components/MessageList', () => ({
  MessageList: () => React.createElement('div', { 'data-testid': 'mock-message-list' }),
}));

vi.mock('@/features/messaging/components/MessageComposer', () => ({
  MessageComposer: () => React.createElement('div', { 'data-testid': 'mock-message-composer' }),
}));

vi.mock('@/components/ui/ReportBlockModal', () => ({
  default: () => null,
}));

vi.mock('@/features/messaging/components/ForwardMessageSheet', () => ({
  ForwardMessageSheet: () => null,
}));

vi.mock('@/features/messaging/components/ConversationOptionsMenuModal', () => ({
  ConversationOptionsMenuModal: () => null,
}));

vi.mock('@/features/messaging/components/GroupSettingsModal', () => ({
  GroupSettingsModal: () => null,
}));

import { ConversationView } from '@/features/messaging/components/ConversationView';
import type { Conversation } from '@/features/messaging/types/messaging.types';

const baseConversation = {
  id: 'conv-1',
  type: 'group',
  title: 'Traversée des Écrins',
  last_message_at: '2026-10-05T10:00:00.000Z',
  created_at: '2026-10-01T10:00:00.000Z',
  updated_at: '2026-10-05T10:00:00.000Z',
} as Conversation;

describe('R3 — Expedition Room montée dans ConversationView', () => {
  it('EXPROOM-01: rend le cockpit unifié et ses 5 panneaux pour une expedition_room', () => {
    const html = renderToStaticMarkup(
      React.createElement(ConversationView, {
        conversation: { ...baseConversation, context_type: 'expedition_room' },
        currentUserId: 'user-1',
      })
    );

    expect(html).toContain('data-testid="expedition-cockpit-container"');
    expect(html).toContain('Discussion');
    expect(html).toContain('Météo');
    expect(html).toContain('Tracé GPX');
    expect(html).toContain('Checklist');
    expect(html).toContain('Points de situation');
    expect(html).toContain('mock-message-list');
  });

  it('EXPROOM-02: une conversation simple ne monte pas le cockpit', () => {
    const html = renderToStaticMarkup(
      React.createElement(ConversationView, {
        conversation: baseConversation,
        currentUserId: 'user-1',
      })
    );

    expect(html).not.toContain('data-testid="expedition-cockpit-container"');
    expect(html).toContain('mock-message-list');
  });
});
