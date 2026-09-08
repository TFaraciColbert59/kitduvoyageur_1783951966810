'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { HubSectionId } from '../engine/hubProfileEngine';

/**
 * H6.1 — Retour matériel Android du hub (via @capacitor/app, miroir Y5.4).
 * Chaîne : section → aperçu (/hub) → sélecteur (ouvre) → sélecteur (ferme).
 * Ne quitte JAMAIS l'application depuis le hub. Web non natif : no-op.
 * La transition est pure et testée (hubBackTransition) ; le hook ne fait
 * que le câblage Capacitor + dialogue d'état avec l'AdventureSwitcher.
 */

export type HubBackAction = 'to-overview' | 'open-switcher' | 'close-switcher';

export function hubBackTransition(
  activeSection: HubSectionId | null,
  switcherOpen: boolean,
): HubBackAction {
  if (activeSection !== null) return 'to-overview';
  return switcherOpen ? 'close-switcher' : 'open-switcher';
}

export function useAndroidHubBackNav(
  activeSection: HubSectionId | null,
  isSwitcherOpen: boolean,
): void {
  const router = useRouter();

  useEffect(() => {
    let removeListener: (() => void) | undefined;

    const setup = async () => {
      try {
        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('backButton', () => {
          const action = hubBackTransition(activeSection, isSwitcherOpen);
          if (action === 'to-overview') {
            router.push('/hub');
          } else if (action === 'open-switcher') {
            window.dispatchEvent(new CustomEvent('hub:open-switcher'));
          } else {
            window.dispatchEvent(new CustomEvent('hub:close-switcher'));
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
  }, [activeSection, isSwitcherOpen, router]);
}
