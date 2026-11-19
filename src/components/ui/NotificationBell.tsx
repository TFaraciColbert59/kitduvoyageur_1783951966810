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
  /** Action locale (ex. ouvrir le drawer Notifications sur /communaute) au lieu de naviguer vers /compte. */
  onClick?: () => void;
}

/**
 * Cloche des notifications du Compte, identique dans toute l'application :
 * même lien (ou action locale), même glyphe (17 px), même nom accessible, même compteur « 99+ ».
 * Seules les classes de l'hôte (boutons ronds de sa barre du haut) changent.
 */
export function NotificationBell({
  userId,
  className = 'gbtn',
  badgeClassName = 'lkdv-notif-badge',
  onClick,
}: NotificationBellProps) {
  const unread = useAccountUnreadCount(userId);
  const label = unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications';
  const classes = `lkdv-notif-wrap ${className}`.trim();
  const content = (
    <>
      <Icon name="bell" size={17} aria-hidden="true" />
      {unread > 0 ? <span className={badgeClassName}>{unread > 99 ? '99+' : unread}</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} aria-label={label}>
        {content}
      </button>
    );
  }

  return (
    <Link href="/compte?tab=notifications" className={classes} aria-label={label}>
      {content}
    </Link>
  );
}

export default NotificationBell;
