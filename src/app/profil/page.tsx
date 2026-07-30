'use client';

import React from 'react';
import MobileProfilePage from '@/components/mobile-nav/MobileProfilePage';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function ProfilPage() {
  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div style={{ minHeight: '100vh', background: 'var(--background)', padding: '100px' }}>
          <p style={{ textAlign: 'center', color: 'rgba(28,38,32,0.5)' }}>Vue disponible uniquement sur mobile</p>
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ minHeight: '100dvh', background: 'var(--background)' }}>
            <MobileProfilePage />
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
