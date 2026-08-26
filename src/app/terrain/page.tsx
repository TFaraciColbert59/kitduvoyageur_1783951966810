'use client';

import React from 'react';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import TerrainHub from '@/components/terrain/TerrainHub';

export default function TerrainPage() {
  return (
    <>
      {/* Desktop redirect or placeholder */}
      <div className="hidden md:flex md:items-center md:justify-center md:h-[100dvh] md:overflow-hidden md:bg-stone-50">
        <div className="max-w-md text-center p-8">
          <h1 className="text-3xl font-bold text-[#17402C] mb-4 font-display tracking-tight">
            Mode Terrain
          </h1>
          <p className="text-[#365233] mb-6 leading-relaxed">
            Le mode terrain est optimisé pour mobile. Accédez-y depuis votre
            téléphone pour profiter de toutes les fonctionnalités GPS et hors
            ligne.
          </p>
          <a
            href="/explorer"
            className="glass-capsule-btn"
          >
            Explorer sur desktop
          </a>
        </div>
      </div>

      {/* Mobile view */}
      <div className="block md:hidden">
        <MobilePageShell>
          <TerrainHub />
        </MobilePageShell>
      </div>
    </>
  );
}
