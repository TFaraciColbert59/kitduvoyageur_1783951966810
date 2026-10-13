"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const REFRESH_INTERVAL_MS = 45_000;

/**
 * F-028 — vrai indicateur de présence : true uniquement si la personne cible
 * a émis un battement de cœur il y a moins de 2 minutes (voir PresenceTracker,
 * horodatage imposé côté base).
 */
export function useUserPresence(userId: string | null | undefined): boolean {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!userId) {
      setOnline(false);
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    const check = async () => {
      const { data, error } = await supabase
        .from('user_presence')
        .select('last_seen_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data?.last_seen_at) {
        setOnline(false);
        return;
      }
      const lastSeen = new Date(data.last_seen_at).getTime();
      setOnline(Number.isFinite(lastSeen) && Date.now() - lastSeen < ONLINE_WINDOW_MS);
    };

    void check();
    const interval = setInterval(() => {
      void check();
    }, REFRESH_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId]);

  return online;
}
