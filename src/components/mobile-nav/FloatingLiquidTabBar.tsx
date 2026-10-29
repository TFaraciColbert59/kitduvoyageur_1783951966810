'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { HUB_SWITCHER_AUTOPEN_KEY, isHubSurfacePathname } from '@/features/hub/context/adventureLists';
import {
  DESTINATIONS,
  getActiveDestinationId,
  type DestinationId,
} from './destinationRegistry';
import BottomNavReservation from './navigation/BottomNavReservation';

const TAB_ICON: Record<DestinationId, string> = {
  adventures: 'home',
  community: 'users',
  explorer: 'compass',
  messages: 'send',
  me: 'user-circle',
};

/**
 * Barre flottante Apple Liquid Glass (iOS 26/27).
 *
 * Référence : variante « floating » de Liquid Glass Tab Bars.
 * - une seule capsule de verre, 68 px, padding 7 ;
 * - l’onglet actif s’élargit et affiche son libellé ; les autres restent icône seule ;
 * - la sélection est une capsule teintée qui se morphe avec la largeur ;
 * - aucune ombre/rayon d’écran : tout est porté par la barre.
 */
export function FloatingLiquidTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  // La lentille part vers l'onglet touché tout de suite, sans attendre la page.
  const [pendingId, setPendingId] = useState<DestinationId | null>(null);
  useEffect(() => setPendingId(null), [pathname]);
  const activeId = pendingId ?? getActiveDestinationId(pathname);
  // Dès que le doigt se pose sur un onglet, la page est demandée : le temps du
  // toucher (≈100 ms) suffit souvent à l'avoir prête au relâchement.
  const warm = (href: string) => {
    if (href !== pathname) router.prefetch(href);
  };
  const activeIndex = Math.max(0, DESTINATIONS.findIndex((d) => d.id === activeId));

  // Appui long sur Hub : sélecteur d'aventures (écouté par HubShell sur le Hub ;
  // ailleurs, signal consommé à l'arrivée sur /hub).
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };
  const startLongPress = () => {
    cancelLongPress();
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      if (isHubSurfacePathname(pathname)) {
        window.dispatchEvent(new CustomEvent('hub:open-switcher'));
      } else {
        try {
          sessionStorage.setItem(HUB_SWITCHER_AUTOPEN_KEY, '1');
        } catch {
          /* stockage indisponible : navigation simple */
        }
        router.push('/hub');
      }
    }, 500);
  };
  useEffect(() => cancelLongPress, []);

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
                onPointerDown={() => {
                  warm(destination.href);
                  if (destination.id === 'adventures') startLongPress();
                }}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onContextMenu={(event) => {
                  if (destination.id === 'adventures') event.preventDefault();
                }}
                onMouseEnter={() => warm(destination.href)}
                onClick={(event) => {
                  if (longPressFired.current) {
                    longPressFired.current = false;
                    event.preventDefault();
                    return;
                  }
                  if (destination.href !== pathname) setPendingId(destination.id);
                }}
                aria-label={destination.ariaLabel}
                aria-current={active ? 'page' : undefined}
                className={`lkdv-floating-tab${active ? ' is-active' : ''}`}
              >
                <span className="lkdv-floating-tab-icon" aria-hidden="true">
                  <Icon name={TAB_ICON[destination.id]} size={24} strokeWidth={active ? 2.25 : 1.75} />
                </span>
                <span className="lkdv-floating-tab-label">{destination.label.fr}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export default FloatingLiquidTabBar;
