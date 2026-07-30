'use client';

import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function CarteInteractivePage() {
  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div />
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.5)' }}>Carte interactive — à venir</p>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
