'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const Carte3D = dynamic(() => import('./Carte3D'), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen flex items-center justify-center bg-[#0c0d10] text-[#f4efe6] font-mono">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#d9480f] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs tracking-wider">CHARGEMENT DU JUMEAU GÉOSPATIAL 3D LKDV...</span>
      </div>
    </div>
  ),
});

export default function Carte3DPage() {
  return <Carte3D />;
}
