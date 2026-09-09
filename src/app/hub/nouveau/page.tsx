import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { TripWizard } from '@/features/trips/wizard/TripWizard';

export const metadata: Metadata = {
  title: 'Nouvelle aventure | Création | Hub — Le Kit du Voyageur',
  description:
    'Créez votre expédition sur-mesure en 5 étapes simples : étapes GPS réelles, saisonnalité, profil altimétrique et matériel optimisé.',
};

/**
 * Étape 2 — La création d'activité vit dans le hub. Les anciennes routes
 * /voyages/nouveau et /voyage-ia redirigent ici.
 */
export default function HubNouveauPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-lkv-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <TripWizard />
    </Suspense>
  );
}
