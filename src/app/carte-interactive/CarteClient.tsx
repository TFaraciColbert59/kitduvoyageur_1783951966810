'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import { Spinner } from '@/components/ui';
import { MapPageLayout } from '@/design';

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[var(--space-3)]">
      <Spinner size="lg" label="Initialisation de la carte" />
      <p className="font-display font-bold text-[color:var(--lkv-text-primary)]">
        Initialisation de la carte...
      </p>
    </div>
  ),
});

export default function CarteClient() {
  return (
    <MapPageLayout
      className="lkdv-map-page"
      hasBottomNav={true}
      map={
        <div className="relative h-full w-full">
          <img
            src="/assets/images/carte-poster.webp"
            alt=""
            width={430}
            height={932}
            fetchPriority="high"
            decoding="async"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0">
            <InteractiveMap />
          </div>
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
