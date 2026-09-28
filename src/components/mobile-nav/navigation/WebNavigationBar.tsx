'use client';

import { memo, useEffect, useRef, useState } from 'react';
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
import DayPlateau from './DayPlateau';
import {
  hasDayFocusPlateau,
  useDayFocusStore,
} from '@/components/mobile-nav/dayFocusStore';
import { useNavigationBadges } from './useNavigationBadges';
import { useNavigationPlateau } from './useNavigationPlateau';
import { useProminentAction } from './ProminentAction';
import { isHubSurfacePathname } from '@/features/hub/context/adventureLists';
import BottomNavReservation from './BottomNavReservation';

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

  // Plateau jour : declenche par les DONNEES (le voyage est decoupe en
  // journees), pas par la route - d'ou le store module partage avec
  // AppShell. Meme fonction pure des deux cotes : la reservation et le
  // rendu ne peuvent pas diverger.
  const dayFocusDays = useDayFocusStore((state) => state.days);
  const dayFocusable = useDayFocusStore((state) => state.focusable);
  // `focusable` : un ecran qui n affiche aucun jour (l etape 1 du
  // preparateur) ne doit pas rendre le rail — ce serait un controle qui
  // repond sans rien changer a l ecran.
  const showDayPlateau = hasDayFocusPlateau(pathname, dayFocusDays, dayFocusable);
  // Meme predicat que le rendu du plateau, evalue par la fonction partagee :
  // c est lui qui alimente la reservation publiee plus bas. Doublon
  // volontaire et sans risque, la fonction etant pure.
  const hasDayPlateau = showDayPlateau;

  const plateauController = useNavigationPlateau(pathname);
  const { badgeFor } = useNavigationBadges();
  const openHubSwitcher = useProminentAction(pathname);

  // Restitution du focus au declencheur. Le tiroir « Tes aventures » est un
  // dialog Radix monte ailleurs (HubShell) : sans ce relais, la fermeture
  // laisserait le focus sur <body> et un utilisateur clavier devrait
  // reparcourir toute la page.
  //
  // Deux precautions, apprises en navigation reelle :
  // 1. on ne memorise QUE le declencheur reel (le lien Hub de la barre). Un
  //    `pointerdown` quelconque memorise plus tot ferait restituer le focus
  //    sur un element sans rapport avec l'ouverture ;
  // 2. la restitution passe DERNIERE, en double `requestAnimationFrame` : le
  //    Dialog Radix rend lui aussi le focus a la fermeture, apres notre
  //    evenement d'etat, et ecrasait le declencheur au profit d'un enfant.
  const hubTriggerRef = useRef<HTMLElement | null>(null);
  const drawerWasOpen = useRef(false);
  useEffect(() => {
    const HUB_TRIGGER = 'nav[aria-label="Navigation principale"] a[href="/hub"]';
    const restoreTriggerFocus = (recorded: HTMLElement | null) => {
      const trigger =
        (recorded && recorded.isConnected ? recorded : null) ??
        document.querySelector<HTMLElement>(HUB_TRIGGER);
      if (!trigger) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!trigger.isConnected) return;
          trigger.focus();
        });
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const hubTrigger = target?.closest?.<HTMLElement>(HUB_TRIGGER) ?? null;
      if (hubTrigger) hubTriggerRef.current = hubTrigger;
    };
    const onSwitcherState = (event: Event) => {
      const open = (event as CustomEvent<{ open: boolean }>).detail?.open ?? false;
      if (drawerWasOpen.current && !open) {
        restoreTriggerFocus(hubTriggerRef.current);
        hubTriggerRef.current = null;
      }
      drawerWasOpen.current = open;
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('hub:switcher-state', onSwitcherState);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('hub:switcher-state', onSwitcherState);
    };
  }, []);

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
    <>
      {/* Reservation basse publiee sur la racine du document : toute page
          doit reserver la place du rail, meme hors de AppShell. Sur /prepare
          le rail recouvrait le CTA final, la page lisant un repli trop court. */}
      <BottomNavReservation hasUpperExtension={hasUpperExtension} hasDayPlateau={hasDayPlateau} />
      <NavigationSurface
        label="Navigation principale"
        hidden={plateauController.hiddenByEvent}
        opticalNavigation={opticalNavigation}
        plateau={
          // Un seul plateau a la fois : le rail jour remplace le plateau
          // de section quand il est actif (meme slot, meme geometrie).
          <AnimatePresence>
            {showDayPlateau ? (
              <DayPlateau key="day-plateau" />
            ) : hasUpperExtension ? (
              <NavigationPlateau key="section-plateau" controller={plateauController} />
            ) : null}
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
    </>
  );
}

export default memo(WebNavigationBar);
