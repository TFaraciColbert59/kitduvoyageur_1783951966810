'use client';

import { memo, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { evaluateCurrentPrefetchPolicy } from '@/lib/perf/networkPrefs';
import {
  DESTINATIONS,
  getActiveDestinationId,
  getDestinationByHref,
  hasExtendedNav,
} from '@/components/mobile-nav/destinationRegistry';
import TabItem from './TabItem';
import NavigationSurface from './NavigationSurface';
import NavigationPlateau from './NavigationPlateau';
import { useNavigationBadges } from './useNavigationBadges';
import { useNavigationPlateau } from './useNavigationPlateau';
import { useProminentAction } from './ProminentAction';
import { isHubSurfacePathname } from '@/features/hub/context/adventureLists';

function WebNavigationBar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [pressedTab, setPressedTab] = useState<string | null>(null);
  // M08 — le prefetch des Link suit la politique réseau existante
  // (réseau inconnu = traité comme limité, jamais de prefetch aveugle).
  const [prefetchAllowed, setPrefetchAllowed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPrefetchAllowed(evaluateCurrentPrefetchPolicy().allow);
  }, []);

  useEffect(() => {
    setPressedTab(null);
  }, [pathname]);

  // Source unique (destinationRegistry) — strictement alignée sur l'offset
  // réservé par AppShell : le plateau et le padding ne peuvent plus diverger.
  const hasUpperExtension = hasExtendedNav(pathname);

  const plateauController = useNavigationPlateau(pathname);
  const { badgeFor } = useNavigationBadges();
  const openHubSwitcher = useProminentAction(pathname);

  // M02 — état actif UNIQUE : le registre résout une seule destination.
  // Le tap en cours (pressedTab) prime le temps de la navigation.
  const pressedDestinationId = pressedTab
    ? getDestinationByHref(pressedTab)?.id ?? null
    : null;
  const activeDestinationId = pressedDestinationId ?? getActiveDestinationId(pathname);
  const opticalNavigation = isHubSurfacePathname(pathname);

  if (!mounted) {
    return (
      <NavigationSurface
        loading
        label="Chargement de la navigation"
        opticalNavigation={opticalNavigation}
      />
    );
  }

  return (
    <NavigationSurface
      label="Navigation principale"
      hidden={plateauController.hiddenByEvent}
      opticalNavigation={opticalNavigation}
      plateau={
        <AnimatePresence>
          {hasUpperExtension && <NavigationPlateau controller={plateauController} />}
        </AnimatePresence>
      }
    >
      {DESTINATIONS.map((destination) => (
        <TabItem
          key={destination.id}
          destination={destination}
          isActive={activeDestinationId === destination.id}
          prefetch={prefetchAllowed}
          onPress={setPressedTab}
          badge={badgeFor(destination)}
          onLongPress={destination.id === 'adventures' ? openHubSwitcher : undefined}
          optical={opticalNavigation}
        />
      ))}
    </NavigationSurface>
  );
}

export default memo(WebNavigationBar);
