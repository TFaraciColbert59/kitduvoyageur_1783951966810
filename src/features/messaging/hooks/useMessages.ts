"use client";

import { useState, useEffect, useCallback } from 'react';
import { messagingService } from '../services/messagingService';
import type { Message, UserProfileSummary, MessageReaction } from '../types/messaging.types';
import { createClient } from '@/lib/supabase/client';

export function useMessages(
  conversationId: string | null,
  currentUserId: string | undefined,
  currentUserProfile?: UserProfileSummary | null
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    const data = await messagingService.getMessages(conversationId);
    setMessages(data);
    setLoading(false);

    if (currentUserId) {
      await messagingService.markAsRead(conversationId, currentUserId);
    }
  }, [conversationId, currentUserId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription for incoming messages & reactions
  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();
    const channelName = `chat-messages-${conversationId}-${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [
              ...prev,
              {
                ...newMsg,
                status: 'sent',
                sender_profile:
                  newMsg.sender_id === currentUserId
                    ? currentUserProfile || undefined
                    : undefined,
              },
            ];
          });

          if (currentUserId && newMsg.sender_id !== currentUserId) {
            await messagingService.markAsRead(conversationId, currentUserId);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        async () => {
          // Soft-refresh messages reactions
          if (conversationId) {
            const fresh = await messagingService.getMessages(conversationId);
            setMessages(fresh);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, currentUserProfile]);

  const sendMessage = async (content: string, replyToId?: string) => {
    if (!conversationId || !currentUserId || !content.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const quotedMsg = replyToId ? messages.find((m) => m.id === replyToId) : null;
    const replyToMessage = quotedMsg
      ? {
          id: quotedMsg.id,
          sender_name: quotedMsg.sender_profile?.full_name || 'Voyageur',
          content: quotedMsg.content,
        }
      : null;

    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content,
      message_type: 'text',
      reply_to_id: replyToId || null,
      reply_to_message: replyToMessage,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sender_profile: currentUserProfile || undefined,
      status: 'sending',
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    const sent = await messagingService.sendMessage(
      conversationId,
      currentUserId,
      content,
      'text',
      replyToId
    );

    if (sent) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...sent, reply_to_message: replyToMessage, sender_profile: currentUserProfile || undefined }
            : m
        )
      );
    } else {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m))
      );
    }
  };

  const toggleReaction = async (messageId: string, reactionValue: string) => {
    if (!currentUserId || !conversationId) return;

    // Optimistic toggle
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;
        const currentReactions = msg.reactions || [];
        const existingIdx = currentReactions.findIndex(
          (r) => r.user_id === currentUserId && r.reaction_value === reactionValue
        );

        let updatedReactions: MessageReaction[];
        if (existingIdx >= 0) {
          updatedReactions = currentReactions.filter((_, idx) => idx !== existingIdx);
        } else {
          updatedReactions = [
            ...currentReactions,
            {
              id: `temp-react-${Date.now()}`,
              message_id: messageId,
              user_id: currentUserId,
              reaction_type: 'emoji',
              reaction_value: reactionValue,
              created_at: new Date().toISOString(),
            },
          ];
        }

        return {
          ...msg,
          reactions: updatedReactions,
        };
      })
    );

    await messagingService.toggleReaction(messageId, currentUserId, reactionValue, conversationId);
  };

  return {
    messages,
    loading,
    sendMessage,
    toggleReaction,
    refreshMessages: fetchMessages,
  };
}
