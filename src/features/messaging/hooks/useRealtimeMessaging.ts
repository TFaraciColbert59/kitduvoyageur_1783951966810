"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

const TYPING_SIGNAL_THROTTLE_MS = 1500;

/**
 * F-016 — un seul canal par conversation, partagé entre l'émission et
 * l'écoute (avant : émission sur `typing-{id}`, écoute sur
 * `typing-{id}-{random}` → personne ne recevait jamais l'état de saisie) et
 * émission limitée dans le temps.
 */
export function useRealtimeMessaging(conversationId: string | null, userId: string | undefined, userName?: string) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSignalAtRef = useRef(0);
  const userNameRef = useRef(userName);
  userNameRef.current = userName;

  useEffect(() => {
    if (!conversationId) return;

    setTypingUsers(new Set());
    const supabase = createClient();
    const channelName = `typing-${conversationId}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

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

    channelRef.current = channel;
    lastSignalAtRef.current = 0;

    return () => {
      typingTimeouts.forEach((t) => clearTimeout(t));
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  const sendTypingSignal = useCallback(() => {
    if (!conversationId || !userId) return;

    const now = Date.now();
    if (now - lastSignalAtRef.current < TYPING_SIGNAL_THROTTLE_MS) return;
    lastSignalAtRef.current = now;

    const channel = channelRef.current;
    if (!channel) return;

    void channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, userName: userNameRef.current || 'Un voyageur' },
    });
  }, [conversationId, userId]);

  return {
    isTyping: typingUsers.size > 0,
    typingUserNames: Array.from(typingUsers),
    sendTypingSignal,
  };
}
