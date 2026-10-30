'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAccountUnreadCount } from '@/features/community/feed/useAccountUnreadCount';

export interface NotificationBellProps {
  userId?: string;
  /** Classes de la surface hôte (`gbtn`, `lg ig-top-btn`…). */
  className?: string;
  /** Classe du badge de l'hôte ; `lkdv-notif-badge` par défaut. */
  badgeClassName?: string;
}

/**
 * Cloche des notifications du Compte, identique dans toute l'application :
 * même lien, même glyphe (17 px), même nom accessible, même compteur « 99+ ».
 * Seules les classes de l'hôte (boutons ronds de sa barre du haut) changent.
 */
export function NotificationBell({
  userId,
  className = 'gbtn',
  badgeClassName = 'lkdv-notif-badge',
}: NotificationBellProps) {
  const unread = useAccountUnreadCount(userId);

  return (
    <Link
      href="/compte?tab=notifications"
      className={`lkdv-notif-wrap ${className}`.trim()}
      aria-label={unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'}
    >
      <Icon name="bell" size={17} aria-hidden="true" />
      {unread > 0 ? <span className={badgeClassName}>{unread > 99 ? '99+' : unread}</span> : null}
    </Link>
  );
}

export default NotificationBell;
