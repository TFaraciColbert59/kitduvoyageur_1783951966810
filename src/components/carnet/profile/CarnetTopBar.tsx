'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAccountUnreadCount } from '@/features/community/feed/useAccountUnreadCount';
import { SfIcon } from './sfIcons';

export interface CarnetTopBarProps {
  title: string;
  onOpenCarnet: () => void;
  onCreate?: () => void;
  /** Menu contextuel `···` (CarnetMoreMenu), ancré dans la barre. */
  menu?: React.ReactNode;
  menuOpen?: boolean;
  onOpenMenu?: () => void;
}

/**
 * Barre du haut de la fiche : pilule 40 avec chevron, puis les `.gbtn` 38
 * (créer, notifications) et le menu `···` en dernière position.
 *
 * Le `···` vivait dans le sélecteur du bas ; il remonte ici, à la place de la
 * loupe. Le menu garde exactement ses entrées et son comportement : seule son
 * ancre change.
 */
export function CarnetTopBar({
  title,
  onOpenCarnet,
  onCreate,
  menu = null,
  menuOpen = false,
  onOpenMenu,
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
        <Link
          href="/compte?tab=notifications"
          className="gbtn ckp-notif"
          aria-label={unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'}
        >
          <Icon name="bell" size={17} aria-hidden="true" />
          {unread > 0 ? <span className="ckp-notif-badge">{unread > 99 ? '99+' : unread}</span> : null}
        </Link>
        {onOpenMenu ? (
          <span className="ckp-more-anchor">
            <button
              type="button"
              className="gbtn"
              aria-label="Plus d’options"
              aria-expanded={menuOpen}
              aria-controls={menu ? 'carnet-more-menu' : undefined}
              onClick={onOpenMenu}
            >
              <SfIcon name="ellipsis" size={17} />
            </button>
            {menu}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default CarnetTopBar;
