import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { TripWizard } from '@/features/trips/wizard/TripWizard';

export const metadata: Metadata = {
  title: 'Nouveau Voyage | Planificateur d’Expédition | Le Kit du Voyageur',
  description:
    'Créez votre expédition sur-mesure en 5 étapes simples : étapes GPS réelles, saisonnalité, profil altimétrique et matériel optimisé.',
};

export default function NouveauVoyagePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#17402C] border-t-transparent animate-spin" />
        </div>
      }
    >
      <TripWizard />
    </Suspense>
  );
}
