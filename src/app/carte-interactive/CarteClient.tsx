'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import { Spinner } from '@/components/ui';
import { MapPageLayout } from '@/design';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

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
                <LKDVIcon name="carte" size={17} aria-hidden="true" />
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
