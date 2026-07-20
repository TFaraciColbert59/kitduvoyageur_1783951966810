'use client';

import React from 'react';
import MobileProfilePage from '@/components/mobile-nav/MobileProfilePage';

export default function ProfilPage() {
  return (
    <div
      className="md:hidden"
      style={{
        minHeight: '100dvh',
        background: 'var(--background)',
        paddingTop: 'calc(52px + env(safe-area-inset-top))',
        paddingBottom: 'calc(60px + env(safe-area-inset-bottom) + 8px)',
      }}
    >
      <MobileProfilePage />
    </div>
  );
}
