'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useToast } from '@/contexts/ToastContext';

/**
 * OfflineBanner — sticky banner shown when the device loses connectivity.
 * Uses navigator.onLine via useOnlineStatus; fires a toast on reconnect.
 */
export default function OfflineBanner() {
  const { isOnline } = useOnlineStatus();
  const { toast } = useToast();
  const wasOfflineRef = useRef(false);

  // Toast on reconnection (only if we were previously offline)
  useEffect(() => {
    if (isOnline && wasOfflineRef.current) {
      wasOfflineRef.current = false;
      toast('Connexion rétablie', 'success');
    } else if (!isOnline) {
      wasOfflineRef.current = true;
    }
  }, [isOnline, toast]);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          key="offline-banner"
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          role="status"
          aria-live="polite"
          className="flex md:hidden"
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
            left: 'max(12px, env(safe-area-inset-left, 0px))',
            right: 'max(12px, env(safe-area-inset-right, 0px))',
            maxWidth: '460px',
            margin: '0 auto',
            zIndex: 100,
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '14px',
            background: 'rgba(23,64,44,0.95)',
            backdropFilter: 'blur(16px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
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
              color: '#FBFAF6',
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.35,
            }}
          >
            Hors ligne — vous consultez le contenu en cache.
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FBFAF6"
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
