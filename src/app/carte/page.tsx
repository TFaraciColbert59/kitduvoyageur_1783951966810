import React from 'react';
import CarteClient from './CarteClient';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export const metadata = {
  title: 'Carte Interactive - Le Kit du Voyageur',
  description: 'Explorez les tracés de randonnée, les refuges et les points d\'eau sur la carte interactive.',
};

export default function CartePage() {
  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <CarteClient />
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <CarteClient />
        </MobilePageShell>
        
      </div>
    </>
  );
}
