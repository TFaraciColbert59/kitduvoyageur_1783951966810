"use client";

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * F-028 — publie la présence réelle de la personne connectée : un battement
 * de cœur (upsert de sa ligne user_presence, horodatage imposé par trigger)
 * au montage, au retour de visibilité, puis toutes les 60 s tant que
 * l'application est visible. Aucun timer en arrière-plan (la présence expire
 * naturellement au bout de 2 minutes).
 */
export default function PresenceTracker() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const supabase = createClient();
    const beat = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const { error } = await supabase
        .from('user_presence')
        .upsert({ user_id: user.id }, { onConflict: 'user_id' });
      if (error) {
        console.error('Présence : battement refusé —', error.message);
      }
    };

    void beat();

    const restartInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        void beat();
      }, HEARTBEAT_INTERVAL_MS);
    };
    restartInterval();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void beat();
        restartInterval();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [user?.id]);

  return null;
}
