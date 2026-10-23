'use client';

import { useCallback, useEffect, useState } from 'react';

export interface ShareConversation {
  id: string;
  title?: string | null;
  name?: string | null;
  type?: 'direct' | 'group' | string;
  avatar_url?: string | null;
}

export function usePostShareTargets(userId?: string) {
  const [conversations, setConversations] = useState<ShareConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    fetch('/api/compte/share-post', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { conversations: [] }))
      .then((data) => {
        if (!cancelled) setConversations(Array.isArray(data?.conversations) ? data.conversations : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const send = useCallback(async (postId: string, conversationId: string) => {
    if (!postId || !conversationId) return false;
    setSending(conversationId);
    try {
      const response = await fetch('/api/compte/share-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, conversationId }),
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      setSending(null);
    }
  }, []);

  return { conversations, loading, sending, send };
}

export default usePostShareTargets;
