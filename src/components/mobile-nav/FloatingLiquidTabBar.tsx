'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  messages: 'message-square',
  me: 'user',
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
  const activeId = getActiveDestinationId(pathname);

  return (
    <>
      <BottomNavReservation hasUpperExtension={false} hasDayPlateau={false} />
      <nav className="lkdv-floating-tabbar" aria-label="Navigation principale">
        <div className="lkdv-floating-tabbar-surface">
          {DESTINATIONS.map((destination) => {
            const active = activeId === destination.id;
            return (
              <Link
                key={destination.id}
                href={destination.href}
                prefetch={false}
                aria-label={destination.ariaLabel}
                aria-current={active ? 'page' : undefined}
                className={`lkdv-floating-tab${active ? ' is-active' : ''}`}
              >
                <span className="lkdv-floating-tab-icon" aria-hidden="true">
                  <Icon name={TAB_ICON[destination.id]} size={22} />
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
