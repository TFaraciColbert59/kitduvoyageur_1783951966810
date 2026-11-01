'use client';

import { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { warmFreedomReels } from '@/features/community/reels/freedomReelsService';
import { evaluateCurrentPrefetchPolicy } from '@/lib/perf/networkPrefs';
import {
  DESTINATIONS,
  getActiveDestinationId,
  type DestinationId,
} from './destinationRegistry';
import BottomNavReservation from './navigation/BottomNavReservation';
import {
  HUB_SWITCHER_AUTOPEN_KEY,
  isHubSurfacePathname,
} from '@/features/hub/context/adventureLists';

const TAB_ICON: Record<DestinationId, string> = {
  adventures: 'home',
  community: 'users',
  explorer: 'compass',
  messages: 'send',
  me: 'user-circle',
};

/** Taille unique du glyphe : les 5 onglets ont exactement la même empreinte. */
const ICON_SIZE = 26;

/**
 * Barre flottante Apple Liquid Glass (iOS 26/27).
 *
 * Référence : variante « floating » de Liquid Glass Tab Bars.
 * - une seule capsule de verre, 52 px, padding 4 ;
 * - 5 onglets, icône seule (le nom reste dans `aria-label`), même taille
 *   pour tous : la pastille ne change jamais de dimension ;
 * - lentille de sélection qui glisse avec ressort physique ;
 * - double-clic sur Communauté -> visionneuse Freedom Reels ;
 * - appui long sur Hub -> ouverture du sélecteur d'aventures ;
 * - barre UNIQUE pour toute l'application.
 */
export function FloatingLiquidTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const activeId = getActiveDestinationId(pathname);
  const activeIndex = Math.max(0, DESTINATIONS.findIndex((d) => d.id === activeId));
  const lastCommunityClickRef = useRef<number>(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef<boolean>(false);

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

  // Freedom (double-clic sur Communauté) doit s'ouvrir instantanément : on
  // précharge la route et la liste des reels (au repos si le réseau le permet, sinon au premier appui).
  const warmFreedom = useCallback(() => {
    try {
      router.prefetch('/communaute/reels');
    } catch {}
    void warmFreedomReels().catch(() => {});
  }, [router]);

  useEffect(() => {
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    // Au repos, seulement si la politique réseau autorise le préchargement de données (4G connue, sans
    // économie de données) : les vidéos mises en mémoire (≈ 1,4 Mo) volaient sinon la bande passante de la
    // page en cours, sur toutes les pages. Ailleurs, l'appui sur Communauté (premier tap du double tap qui
    // ouvre Freedom) déclenche le même préchargement, à l'intention de la personne.
    const warmIfAllowed = () => {
      if (evaluateCurrentPrefetchPolicy().allowData) warmFreedom();
    };
    const handle = w.requestIdleCallback ? w.requestIdleCallback(warmIfAllowed) : window.setTimeout(warmIfAllowed, 1200);
    return () => {
      if (w.cancelIdleCallback && w.requestIdleCallback) w.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [warmFreedom]);

  const triggerHubSwitcher = useCallback(() => {
    try {
      if ('vibrate' in navigator) navigator.vibrate(25);
    } catch {}

    if (isHubSurfacePathname(pathname)) {
      window.dispatchEvent(new CustomEvent('hub:open-switcher'));
    } else {
      try {
        sessionStorage.setItem(HUB_SWITCHER_AUTOPEN_KEY, '1');
      } catch {}
      router.push('/hub');
    }
  }, [pathname, router]);

  const handlePointerDown = (destId: DestinationId) => {
    if (destId === 'community') warmFreedom();
    if (destId === 'adventures') {
      longPressFiredRef.current = false;
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        triggerHubSwitcher();
      }, 500);
    }
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTabClick = (destId: DestinationId, e: React.MouseEvent) => {
    clearLongPress();
    if (destId === 'adventures' && longPressFiredRef.current) {
      e.preventDefault();
      longPressFiredRef.current = false;
      return;
    }

    if (destId === 'community') {
      const now = Date.now();
      const diff = now - lastCommunityClickRef.current;
      lastCommunityClickRef.current = now;
      if (diff > 0 && diff < 450) {
        e.preventDefault();
        lastCommunityClickRef.current = 0;
        router.push('/communaute/reels');
      }
    }
  };

  return (
    <>
      <BottomNavReservation hasUpperExtension={false} hasDayPlateau={false} />
      <nav className="lkdv-floating-tabbar" aria-label="Navigation principale">
        <div className="lkdv-floating-tabbar-surface">
          <span
            className="lkdv-floating-lens"
            aria-hidden="true"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
          {DESTINATIONS.map((destination) => {
            const active = activeId === destination.id;
            return (
              <Link
                key={destination.id}
                href={destination.href}
                prefetch={false}
                aria-label={
                  destination.id === 'community'
                    ? `${destination.ariaLabel} (double-clic pour Freedom)`
                    : destination.id === 'adventures'
                    ? `${destination.ariaLabel} (maintien pour changer d'aventure)`
                    : destination.ariaLabel
                }
                aria-current={active ? 'page' : undefined}
                className={`lkdv-floating-tab${active ? ' is-active' : ''}`}
                onPointerDown={() => handlePointerDown(destination.id)}
                onPointerUp={clearLongPress}
                onPointerLeave={clearLongPress}
                onContextMenu={(e) => {
                  if (destination.id === 'adventures') {
                    e.preventDefault();
                    triggerHubSwitcher();
                  }
                }}
                onClick={(e) => handleTabClick(destination.id, e)}
              >
                <span className="lkdv-floating-tab-icon" aria-hidden="true">
                  <Icon name={TAB_ICON[destination.id]} size={ICON_SIZE} strokeWidth={active ? 2.25 : 1.75} />
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export default FloatingLiquidTabBar;
