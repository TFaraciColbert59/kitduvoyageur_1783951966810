'use client';

import { useEffect, useState } from 'react';

/** Compteur de notifications non lues du Compte, pour le badge de la cloche. */
export function useAccountUnreadCount(userId?: string): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setUnread(0);
      return;
    }
    fetch('/api/compte/compte/notifications', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && typeof data?.unread === 'number') setUnread(data.unread);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return unread;
}

export default useAccountUnreadCount;
