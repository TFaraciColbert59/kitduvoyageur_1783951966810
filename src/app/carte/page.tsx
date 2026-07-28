import React from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';

// Chargement dynamique du composant Carte pour éviter l'erreur SSR avec Leaflet (window is not defined)
const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100vh-64px)] bg-[#F5F3ED] flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#A7D3A6] border-t-[#1C2620] rounded-full animate-spin mb-4" />
      <p className="font-display font-700 text-[#1C2620]">Initialisation de la carte...</p>
    </div>
  ),
});

export const metadata = {
  title: 'Carte Interactive - Le Kit du Voyageur',
  description: 'Explorez les tracés de randonnée, les refuges et les points d\'eau sur la carte interactive.',
};

export default function CartePage() {
  return (
    <div className="min-h-screen bg-[#F5F3ED] flex flex-col">
      <Header />
      <main className="flex-1 pt-16 flex flex-col">
        {/* On retire le padding habituel pour que la carte prenne tout l'espace sous le header */}
        <InteractiveMap />
      </main>
    </div>
  );
}
