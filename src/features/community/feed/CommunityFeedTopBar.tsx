'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import type { SectionTabId } from '@/features/community/sections/CommunityTabSelector';
import { NotificationBell } from '@/components/ui/NotificationBell';

export interface CommunityFeedTopBarProps {
  user: any;
  onCreate: () => void;
  onOpenSection: (id: SectionTabId) => void;
  onSearch: () => void;
}

/**
 * « Explorer » (ouvre directement la recherche de l'Explorer) ; +, recherche,
 * cloche (drawer Notifications du Compte).
 */
export function CommunityFeedTopBar({ user, onCreate, onOpenSection, onSearch }: CommunityFeedTopBarProps) {
  return (
    <>
      <div className="lkdv-pourtoi-wrap gap-1.5">
        <button
          type="button"
          className="lkdv-pourtoi-pill"
          aria-label="Explorer et rechercher"
          onClick={() => onOpenSection('carnets')}
        >
          <span>Explorer</span>
        </button>
      </div>

      <div className="lkdv-top-actions">
        <button type="button" className="gbtn" aria-label="Créer dans l’application" onClick={onCreate}>
          <Icon name="plus" size={18} aria-hidden="true" />
        </button>
        <button type="button" className="gbtn" aria-label="Rechercher dans la communauté" onClick={onSearch}>
          <Icon name="search" size={17} aria-hidden="true" />
        </button>
        <NotificationBell userId={user?.id} />
      </div>
    </>
  );
}

export default CommunityFeedTopBar;
