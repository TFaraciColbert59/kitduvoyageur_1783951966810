'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tripSectionHref } from '../registry/tripSectionRegistry';
import type { TripSectionId } from '../engine/tripProfileEngine';

/**
 * Y5.4 — Gestion du retour matériel Android (via @capacitor/app).
 * Remonte la hiérarchie du Hub Voyage Unique :
 * - Section active (autre que overview) -> Aperçu (/voyages/[slug])
 * - Aperçu (/voyages/[slug]) -> Liste (/voyages)
 * Ne quitte JAMAIS l'application directement depuis une section du hub.
 */
export function useAndroidTripBackNav(slug: string, activeSection: TripSectionId) {
  const router = useRouter();

  useEffect(() => {
    let removeListener: (() => void) | undefined;

    const setup = async () => {
      try {
        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('backButton', () => {
          if (activeSection !== 'overview') {
            router.push(tripSectionHref(slug, 'overview'));
          } else {
            router.push('/voyages');
          }
        });
        removeListener = () => {
          listener.remove();
        };
      } catch {
        // Environnement web / non natif : pas d'action requise
      }
    };

    setup();

    return () => {
      removeListener?.();
    };
  }, [slug, activeSection, router]);
}
