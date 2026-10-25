"use client";

import { useState, useEffect, useCallback } from 'react';
import { messagingService } from '../services/messagingService';
import type { Conversation } from '../types/messaging.types';
import { createClient } from '@/lib/supabase/client';

export function useConversations(userId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await messagingService.getConversations(userId);
      setConversations(data);
      setError(null);
    } catch (err: unknown) {
      console.error('Failed to fetch conversations:', err);
      setError('Impossible de charger vos conversations.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime subscription for conversation updates and unread counts
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channelName = `user-conversations-${userId}-${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_members',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchConversations]);

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  return {
    conversations,
    loading,
    error,
    totalUnread,
    refreshConversations: fetchConversations,
  };
}
