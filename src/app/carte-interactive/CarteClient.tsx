'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import { Spinner } from '@/components/ui';
import { MapPageLayout } from '@/design';

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[var(--space-3)] bg-[color:var(--lkv-surface-primary)]">
      <Spinner size="lg" label="Initialisation de la carte" />
      <p className="font-display font-bold text-[color:var(--lkv-text-primary)]">
        Initialisation de la carte...
      </p>
    </div>
  ),
});

export default function CarteClient() {
  const [active, setActive] = useState(false);

  return (
    <MapPageLayout
      className="lkdv-map-page"
      hasBottomNav={true}
      map={
        <div className="relative h-full w-full">
          <img
            src="/assets/images/carte-poster.webp"
            alt="Aperçu de la carte des itinéraires"
            width={430}
            height={932}
            fetchPriority="high"
            decoding="async"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
          {active ? (
            <div className="absolute inset-0">
              <InteractiveMap />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setActive(true)}
              aria-label="Activer la carte interactive"
              className="absolute inset-0 z-[2] flex items-end justify-center pb-[calc(var(--map-control-bottom,88px)+64px)] outline-none"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-5 py-3 text-[13px] font-bold text-[#17402C] shadow-lg backdrop-blur-md">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z" />
                  <path d="M9 3v15M15 6v15" />
                </svg>
                Explorer la carte
              </span>
            </button>
          )}
        </div>
      }
      header={
        <div className="hidden md:block">
          <Header />
        </div>
      }
    />
  );
}
