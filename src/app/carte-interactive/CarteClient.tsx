'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100vh-64px)] bg-[#F5F3ED] flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#A7D3A6] border-t-[#1C2620] rounded-full animate-spin mb-4" />
      <p className="font-display font-700 text-[#1C2620]">Initialisation de la carte...</p>
    </div>
  ),
});

export default function CarteClient() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F5F3ED] flex flex-col">
      <div className="hidden md:block">
        <Header />
      </div>
      <main className="flex-1 md:pt-16 flex flex-col relative w-full h-full">
        <InteractiveMap />
      </main>
    </div>
  );
}
