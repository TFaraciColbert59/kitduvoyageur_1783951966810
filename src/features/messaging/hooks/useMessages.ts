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
  const MESSAGES_PAGE_SIZE = 50;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const data = await messagingService.getMessages(conversationId, MESSAGES_PAGE_SIZE);
      setMessages(data);
      setHasMore(data.length >= MESSAGES_PAGE_SIZE);

      if (currentUserId) {
        await messagingService.markAsRead(conversationId, currentUserId);
      }
      setError(null);
    } catch (err: unknown) {
      console.error('Failed to fetch messages:', err);
      setError('Impossible de charger les messages.');
    } finally {
      setLoading(false);
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

            // F-017 : si Realtime arrive avant la réponse HTTP, remplacer le
            // message optimiste (même expéditeur, même contenu) au lieu de
            // créer un doublon temp + serveur.
            const optimisticIndex = prev.findIndex(
              (m) =>
                m.id.startsWith('temp-') &&
                m.status === 'sending' &&
                m.sender_id === newMsg.sender_id &&
                m.content === newMsg.content &&
                (m.reply_to_id ?? null) === (newMsg.reply_to_id ?? null)
            );
            if (optimisticIndex >= 0) {
              const next = [...prev];
              next[optimisticIndex] = {
                ...newMsg,
                status: 'sent',
                reply_to_message: prev[optimisticIndex].reply_to_message,
                sender_profile:
                  newMsg.sender_id === currentUserId
                    ? currentUserProfile || prev[optimisticIndex].sender_profile
                    : undefined,
              };
              return next;
            }

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
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // F-018 : éditions et suppressions (tombstone deleted_at) suivies
          // sur les autres appareils, sans rechargement.
          const updated = payload.new as Message;
          setMessages((prev) => {
            if (updated.deleted_at) {
              return prev.map((m) =>
                m.id === updated.id
                  ? { ...m, deleted_at: updated.deleted_at, content: '', reactions: [] }
                  : m
              );
            }
            return prev.map((m) =>
              m.id === updated.id
                ? { ...m, content: updated.content, updated_at: updated.updated_at, metadata: updated.metadata ?? m.metadata }
                : m
            );
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const removedId = (payload.old as { id?: string }).id;
          if (!removedId) return;
          setMessages((prev) => prev.filter((m) => m.id !== removedId));
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

  const loadEarlier = useCallback(async () => {
    if (!conversationId || loadingEarlier) return;
    const oldest = messages[0]?.created_at;
    if (!oldest) return;

    setLoadingEarlier(true);
    try {
      const older = await messagingService.getMessages(conversationId, MESSAGES_PAGE_SIZE, oldest);
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !seen.has(m.id)), ...prev];
      });
      setHasMore(older.length >= MESSAGES_PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load earlier messages:', err);
      setError('Impossible de charger l’historique.');
    } finally {
      setLoadingEarlier(false);
    }
  }, [conversationId, messages, loadingEarlier]);

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
      setMessages((prev) => {
        const hasTemp = prev.some((m) => m.id === tempId);
        if (hasTemp) {
          return prev.map((m) =>
            m.id === tempId
              ? { ...sent, reply_to_message: replyToMessage, sender_profile: currentUserProfile || undefined }
              : m
          );
        }
        // F-017 : Realtime a déjà remplacé le message optimiste — fusionner les
        // métadonnées d'affichage sans dupliquer la bulle.
        return prev.map((m) =>
          m.id === sent.id
            ? { ...m, reply_to_message: m.reply_to_message ?? replyToMessage, sender_profile: m.sender_profile ?? currentUserProfile ?? undefined }
            : m
        );
      });
    } else {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m))
      );
    }
  };

  const retryMessage = async (localMessageId: string) => {
    if (!conversationId || !currentUserId) return;

    const target = messages.find((m) => m.id === localMessageId && m.status === 'error');
    if (!target) return;

    setMessages((prev) =>
      prev.map((m) => (m.id === localMessageId ? { ...m, status: 'sending' } : m))
    );

    const sent = await messagingService.sendMessage(
      conversationId,
      currentUserId,
      target.content,
      target.message_type,
      target.reply_to_id ?? undefined,
      (target.metadata as Record<string, unknown> | null) ?? undefined
    );

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== localMessageId) return m;
        if (sent) {
          return {
            ...sent,
            reply_to_message: target.reply_to_message,
            sender_profile: target.sender_profile,
          };
        }
        return { ...m, status: 'error' };
      })
    );
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
    error,
    hasMore,
    loadingEarlier,
    loadEarlier,
    sendMessage,
    retryMessage,
    toggleReaction,
    refreshMessages: fetchMessages,
  };
}
