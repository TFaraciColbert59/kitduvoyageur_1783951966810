'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#FAF8F5] flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-sage-300 border-t-[#17402C] rounded-full animate-spin mb-4" />
      <p className="font-display font-bold text-[#17402C]">Initialisation de la carte...</p>
    </div>
  ),
});

export default function CarteClient() {
  return (
    <div className="h-dvh w-screen overflow-hidden bg-[#FAF8F5] flex flex-col">
      <div className="hidden md:block">
        <Header />
      </div>
      <main className="flex-1 md:pt-16 flex flex-col relative w-full h-full min-h-0">
        <InteractiveMap />
      </main>
    </div>
  );
}
