'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
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
  const activeId = getActiveDestinationId(pathname);
  const activeIndex = Math.max(0, DESTINATIONS.findIndex((d) => d.id === activeId));
  const lastCommunityClickRef = useRef<number>(0);

  const handleTabClick = (destId: DestinationId, e: React.MouseEvent) => {
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
                aria-label={destination.id === 'community' ? `${destination.ariaLabel} (double-clic pour Freedom)` : destination.ariaLabel}
                aria-current={active ? 'page' : undefined}
                className={`lkdv-floating-tab${active ? ' is-active' : ''}`}
                onClick={(e) => handleTabClick(destination.id, e)}
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
