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
      hasBottomNav={false}
      map={<InteractiveMap />}
      header={
        <div className="hidden md:block">
          <Header />
        </div>
      }
    />
  );
}
