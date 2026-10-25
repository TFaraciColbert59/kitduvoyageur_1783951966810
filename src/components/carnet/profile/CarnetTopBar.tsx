'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAccountUnreadCount } from '@/features/community/feed/useAccountUnreadCount';

export interface CarnetTopBarProps {
  title: string;
  onOpenCarnet: () => void;
  onCreate?: () => void;
  onSearch?: () => void;
}

/**
 * Barre du haut de la Communauté : pilule 40 avec chevron, puis trois `.gbtn`
 * 38 (créer, rechercher, notifications) et le menu `···`.
 */
export function CarnetTopBar({
  title,
  onOpenCarnet,
  onCreate,
  onSearch,
}: CarnetTopBarProps) {
  const unread = useAccountUnreadCount(undefined);

  return (
    <div className="ckp-topbar">
      <button
        type="button"
        className="ckp-title-pill"
        onClick={onOpenCarnet}
        aria-label={`Carnet ${title}`}
      >
        <b>{title}</b>
        <svg
          className="ckp-title-chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M7 10l5 5 5-5" />
        </svg>
      </button>

      <div className="ckp-top-actions">
        <button type="button" className="gbtn" aria-label="Créer" onClick={onCreate}>
          <Icon name="plus" size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="gbtn"
          aria-label="Rechercher dans la communauté"
          onClick={onSearch}
        >
          <Icon name="search" size={17} aria-hidden="true" />
        </button>
        <Link
          href="/compte?tab=notifications"
          className="gbtn ckp-notif"
          aria-label={unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'}
        >
          <Icon name="bell" size={17} aria-hidden="true" />
          {unread > 0 ? <span className="ckp-notif-badge">{unread > 99 ? '99+' : unread}</span> : null}
        </Link>
      </div>
    </div>
  );
}

export default CarnetTopBar;
