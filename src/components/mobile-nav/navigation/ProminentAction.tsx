'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  HUB_SWITCHER_AUTOPEN_KEY,
  isHubSurfacePathname,
} from '@/features/hub/context/adventureLists';

/**
 * Action proéminente du tab Hub : appui long → sélecteur compact (3 natures).
 * Sur surface hub : le switcher est monté (HubShell écoute l'événement).
 * Ailleurs : signal one-shot consommé au montage du switcher après /hub.
 */
export function useProminentAction(pathname: string | null) {
  const router = useRouter();

  return useCallback(() => {
    if (typeof window === 'undefined') return;
    if (isHubSurfacePathname(pathname)) {
      window.dispatchEvent(new CustomEvent('hub:open-switcher'));
    } else {
      try {
        sessionStorage.setItem(HUB_SWITCHER_AUTOPEN_KEY, '1');
      } catch {
        /* storage indisponible : navigation simple */
      }
      router.push('/hub');
    }
  }, [pathname, router]);
}
