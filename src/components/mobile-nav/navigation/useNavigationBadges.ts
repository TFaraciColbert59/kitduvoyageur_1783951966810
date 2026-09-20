'use client';

import { useUnreadBadge } from '@/hooks/useUnreadBadge';
import { useActiveAdventure } from '@/features/hub/context/ActiveAdventureContext';
import { useCartCount } from '@/hooks/useCartCount';
import type { Destination } from '@/components/mobile-nav/destinationRegistry';

export function useNavigationBadges() {
  const badges = useUnreadBadge();
  const { groups } = useActiveAdventure();
  const cartCount = useCartCount();

  const badgeFor = (destination: Destination): number => {
    // H5 : badge hub = agrégat (à préparer serveur + alertes matériel).
    if (destination.id === 'adventures') {
      return badges.materiel + (groups.possession[0]?.alertsCount ?? 0);
    }
    if (destination.id === 'me') return badges.profil;
    if (destination.id === 'community') return badges.communaute;
    return 0;
  };

  return { badgeFor, messagerieBadge: badges.messages, cartCount };
}
