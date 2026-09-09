import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, Compass } from 'lucide-react';
import { TripWizard } from '@/features/trips/wizard/TripWizard';
import { AutoGenTripCreateView } from '@/features/trips/components/autoGen/AutoGenTripCreateView';
import { HUB_NEW_HREF, HUB_NEW_IA_HREF } from '@/features/hub/registry/hubSectionRegistry';

export const metadata: Metadata = {
  title: 'Nouvelle aventure | Création | Hub — Le Kit du Voyageur',
  description:
    'Créez votre expédition sur-mesure en 5 étapes simples : étapes GPS réelles, saisonnalité, profil altimétrique et matériel optimisé. Ou laissez le moteur IA la générer.',
};

/**
 * Étape 2 — La création d'activité vit dans le hub. Les anciennes routes
 * /voyages/nouveau et /voyage-ia redirigent ici. Deux modes :
 *  - ?mode=ia : Génération IA (suite autoGen — brief → 12 couches → création)
 *  - défaut  : Wizard guidé en 5 étapes.
 */
export default async function HubNouveauPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const isIa = mode === 'ia';

  return (
    <div>
      {/* Sélecteur de mode de création */}
      <nav aria-label="Mode de création" className="flex items-center justify-center gap-2 py-4 px-4">
        <Link
          href={HUB_NEW_HREF}
          aria-current={isIa ? undefined : 'page'}
          className={`inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
            !isIa
              ? 'bg-[var(--lkv-forest-900)] text-white border-[var(--lkv-forest-900)]'
              : 'glass text-[var(--lkv-text-primary)] border-white/60'
          }`}
        >
          <Compass size={14} aria-hidden="true" />
          <span>Assistant guidé</span>
        </Link>
        <Link
          href={HUB_NEW_IA_HREF}
          aria-current={isIa ? 'page' : undefined}
          className={`inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
            isIa
              ? 'bg-[var(--lkv-forest-900)] text-white border-[var(--lkv-forest-900)]'
              : 'glass text-[var(--lkv-text-primary)] border-white/60'
          }`}
        >
          <Sparkles size={14} aria-hidden="true" />
          <span>Génération IA</span>
        </Link>
      </nav>

      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-lkv-primary border-t-transparent animate-spin" />
          </div>
        }
      >
        {isIa ? <AutoGenTripCreateView /> : <TripWizard />}
      </Suspense>
    </div>
  );
}
