'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useToast } from '@/contexts/ToastContext';
import { zIndex } from '@/lib/ui/zIndex';

/**
 * P1-3 (C-17 suite) — framer-motion retiré du graphe du layout racine :
 * fade+slide en CSS pur (keyframes .lkv-offline-in), mêmes tokens et
 * visibilité (H8). L'apparition reste animée, calme, system-like.
 *
 * M05 — la bannière ne prétend JAMAIS à du contenu en cache non démontré :
 * le message « contenu en cache disponible » n'apparaît que si un service
 * worker contrôle la page ET qu'un cache LKDV contient réellement des
 * entrées. Sinon, message factuel « certaines fonctions sont indisponibles ».
 */
const OFFLINE_MESSAGE_NO_CACHE = 'Hors ligne — certaines fonctions sont indisponibles.';
const OFFLINE_MESSAGE_CACHED = 'Hors ligne — contenu en cache disponible.';

export default function OfflineBanner() {
  const { isOnline } = useOnlineStatus();
  const { toast } = useToast();
  const wasOfflineRef = useRef(false);
  // null = état non vérifié (ou hors ligne non actif) ; true/false = vérifié.
  const [hasVerifiedCache, setHasVerifiedCache] = useState<boolean | null>(null);

  // Toast on reconnection (only if we were previously offline)
  useEffect(() => {
    if (isOnline && wasOfflineRef.current) {
      wasOfflineRef.current = false;
      toast('Connexion rétablie', 'success');
    } else if (!isOnline) {
      wasOfflineRef.current = true;
    }
  }, [isOnline, toast]);

  useEffect(() => {
    if (isOnline) {
      setHasVerifiedCache(null);
      return;
    }

    let cancelled = false;
    const verifyCacheState = async () => {
      const swActive =
        typeof navigator !== 'undefined' &&
        'serviceWorker' in navigator &&
        Boolean(navigator.serviceWorker.controller);

      let cached = false;
      if (swActive && typeof caches !== 'undefined') {
        try {
          const keys = await caches.keys();
          for (const key of keys.filter((k) => k.startsWith('lkdv-'))) {
            const cache = await caches.open(key);
            const entries = await cache.keys();
            if (entries.length > 0) {
              cached = true;
              break;
            }
          }
        } catch {
          cached = false;
        }
      }

      if (!cancelled) setHasVerifiedCache(swActive && cached);
    };

    verifyCacheState();
    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  return (
    !isOnline && (
      <div
        key="offline-banner"
        role="status"
        aria-live="polite"
        className="lkv-offline-in flex pointer-events-none"
        style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
            left: 'max(12px, env(safe-area-inset-left, 0px))',
            right: 'max(12px, env(safe-area-inset-right, 0px))',
            maxWidth: '460px',
            margin: '0 auto',
            zIndex: zIndex.toast,
            touchAction: 'none',
            overscrollBehavior: 'none',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '14px',
            background: 'rgba(23,64,44,0.95)',
            backdropFilter: 'blur(var(--glass-blur-lg)) saturate(var(--glass-sat))',
            WebkitBackdropFilter: 'blur(var(--glass-blur-lg)) saturate(var(--glass-sat))',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 24px rgba(23,64,44,0.25)',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#A6C1A0',
              boxShadow: '0 0 0 3px rgba(163,196,163,0.2)',
              flexShrink: 0,
            }}
            aria-hidden="true"
          />
          <span
            style={{
              flex: 1,
              fontSize: '13px',
              fontWeight: 600,
              color: '#EEF3EC',
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.35,
            }}
          >
            {hasVerifiedCache === true ? OFFLINE_MESSAGE_CACHED : OFFLINE_MESSAGE_NO_CACHE}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#EEF3EC"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 13a10 10 0 0 1 14 0" />
            <path d="M8.5 16.5a5 5 0 0 1 7 0" />
            <path d="M2 2l20 20" />
            <path d="M12 20h.01" />
          </svg>
      </div>
    )
  );
}
