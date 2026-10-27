"use client";

import { useState, useEffect, useCallback } from 'react';
import { messagingService } from '../services/messagingService';
import type { Conversation } from '../types/messaging.types';
import { createClient } from '@/lib/supabase/client';

const CACHE_PREFIX = 'lkdv:messagerie:conversations:';

/** Liste mise en cache : le fil s'affiche immédiatement au retour sur l'écran,
 *  puis se rafraîchit en tâche de fond. */
function readCache(userId: string | undefined): Conversation[] {
  if (!userId || typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(`${CACHE_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCache(userId: string | undefined, data: Conversation[]) {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(data));
  } catch {
    /* quota ou mode privé : le cache est un bonus, jamais un prérequis */
  }
}

export function useConversations(userId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>(() => readCache(userId));
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
      writeCache(userId, data);
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
