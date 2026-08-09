'use client';

import React from 'react';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import TerrainHub from '@/components/terrain/TerrainHub';

export default function TerrainPage() {
  return (
    <>
      {/* Desktop redirect or placeholder */}
      <div className="hidden md:flex md:items-center md:justify-center md:min-h-screen md:bg-stone-50">
        <div className="max-w-md text-center p-8">
          <h1 className="text-3xl font-bold text-forest-900 mb-4 font-display">
            Mode Terrain
          </h1>
          <p className="text-ink-300 mb-6">
            Le mode terrain est optimisé pour mobile. Accédez-y depuis votre
            téléphone pour profiter de toutes les fonctionnalités GPS et hors
            ligne.
          </p>
          <a
            href="/explorer"
            className="inline-block px-6 py-3 bg-forest-800 text-white rounded-lg font-semibold hover:bg-forest-700 transition"
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
