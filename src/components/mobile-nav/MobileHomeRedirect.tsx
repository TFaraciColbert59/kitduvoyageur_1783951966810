'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

/**
 * Touch-device landing: the app opens directly on the Aventures (Explorer) screen.
 * Desktop (pointer: fine) and narrow desktop windows are not redirected —
 * the full homepage remains available for marketing/SEO.
 * Renders nothing visible on touch devices apart from a safe loading shell.
 */
export default function MobileHomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    if (isTouchDevice) {
      router.replace('/explorer');
    }
  }, [router]);

  return (
    <MobilePageShell>
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '0 32px',
        }}
      >
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '999px',
            border: '2px solid rgba(23,64,44,0.12)',
            borderTopColor: '#17402C',
            animation: 'lkdv-spin 0.8s linear infinite',
          }}
        />
        <p style={{ fontSize: '12px', color: '#6B7A72', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Aventures
        </p>
        <style jsx>{`
          @keyframes lkdv-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </MobilePageShell>
  );
}
