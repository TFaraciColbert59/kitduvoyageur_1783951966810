import React, { Suspense } from 'react';
import Icon from '@/components/ui/Icon';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Chip, LoadingState } from '@/components/ui';
import { TripWizard } from '@/features/trips/wizard/TripWizard';
import { AutoGenTripCreateView } from '@/features/trips/components/autoGen/AutoGenTripCreateView';
import { HUB_NEW_HREF, HUB_NEW_IA_HREF } from '@/features/hub/registry/hubSectionRegistry';

// Page serveur (wizard + mode IA) : dépend des cookies/aventure active —
// jamais prerenderee statiquement (le client Supabase est évalué au runtime).
export const dynamic = 'force-dynamic';

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
      <nav
        aria-label="Mode de création"
        className="flex items-center justify-center gap-2 py-4 px-4"
      >
        <Link href={HUB_NEW_HREF} aria-current={isIa ? undefined : 'page'}>
          <Chip
            selected={!isIa}
            icon={<Icon name="compass" size={14} aria-hidden="true" />}
          >
            Assistant guidé
          </Chip>
        </Link>
        <Link href={HUB_NEW_IA_HREF} aria-current={isIa ? 'page' : undefined}>
          <Chip
            selected={isIa}
            icon={<Icon name="sparkles" size={14} aria-hidden="true" />}
          >
            Génération IA
          </Chip>
        </Link>
      </nav>

      <Suspense
        fallback={<LoadingState label="Chargement du formulaire…" className="min-h-[50vh]" />}
      >
        {isIa ? <AutoGenTripCreateView /> : <TripWizard />}
      </Suspense>
    </div>
  );
}
