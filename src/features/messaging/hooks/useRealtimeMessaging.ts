"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useRealtimeMessaging(conversationId: string | null, userId: string | undefined, userName?: string) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  const sendTypingSignal = useCallback(() => {
    if (!conversationId || !userId) return;
    const supabase = createClient();
    const channelName = `typing-${conversationId}`;
    const channel = supabase.channel(channelName);
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, userName: userName || 'Un voyageur' },
    });
  }, [conversationId, userId, userName]);

  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();
    const channelName = `typing-${conversationId}-${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase.channel(channelName);

    const typingTimeouts = new Map<string, NodeJS.Timeout>();

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const typingId = payload.payload.userId;
        const name = payload.payload.userName;

        if (typingId === userId) return;

        setTypingUsers((prev) => new Set(prev).add(name));

        if (typingTimeouts.has(typingId)) {
          clearTimeout(typingTimeouts.get(typingId)!);
        }

        const timeout = setTimeout(() => {
          setTypingUsers((prev) => {
            const updated = new Set(prev);
            updated.delete(name);
            return updated;
          });
          typingTimeouts.delete(typingId);
        }, 3000);

        typingTimeouts.set(typingId, timeout);
      })
      .subscribe();

    return () => {
      typingTimeouts.forEach((t) => clearTimeout(t));
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  return {
    isTyping: typingUsers.size > 0,
    typingUserNames: Array.from(typingUsers),
    sendTypingSignal,
  };
}
