'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../lib/supabase/browser';

export type RealtimeStatus = 'connexion' | 'connecte' | 'indisponible';

/**
 * Canaux privés `admin:*` (file, présence). À la reconnexion, on recharge la base
 * (`router.refresh`) pour ne rien manquer pendant la coupure.
 */
export function useAdminChannel(channel: string, onChange?: () => void): RealtimeStatus {
  const router = useRouter();
  const [status, setStatus] = useState<RealtimeStatus>(
    process.env.NEXT_PUBLIC_CRM_DESIGN_PREVIEW === '1' ? 'connecte' : 'connexion'
  );
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    // Prévisualisation de design : pastille « connecté » sans réseau (jamais en production).
    if (process.env.NEXT_PUBLIC_CRM_DESIGN_PREVIEW === '1') {
      setStatus('connecte');
      return;
    }
    let client: ReturnType<typeof supabaseBrowser>;
    try {
      client = supabaseBrowser();
    } catch {
      setStatus('indisponible');
      return;
    }

    let cancelled = false;
    const instance = client.channel(`admin:${channel}`, {
      config: { private: true, broadcast: { self: false }, presence: { key: `crm-${Math.random().toString(36).slice(2, 10)}` } }
    });

    instance
      .on('broadcast', { event: 'change' }, () => {
        onChangeRef.current?.();
        router.refresh();
      })
      .subscribe((state) => {
        if (cancelled) return;
        if (state === 'SUBSCRIBED') setStatus('connecte');
        else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') setStatus('indisponible');
        else setStatus('connexion');
      });

    const onOnline = () => router.refresh();
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      void client.removeChannel(instance);
    };
  }, [channel, router]);

  return status;
}
