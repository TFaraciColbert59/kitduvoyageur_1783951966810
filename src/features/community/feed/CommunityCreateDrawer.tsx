'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { CommunityDrawer } from '@/features/community/sections/CommunityDrawer';

export interface CommunityCreateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStory: () => void;
}

const TILES = [
  { href: '/carnets/nouveau', icon: 'book-open', title: 'Carnet', subtitle: 'Raconte ton expédition' },
  { href: '/voyages', icon: 'map', title: 'Sortie GPS', subtitle: 'Trace, planifie, importe' },
  { href: '/materiel', icon: 'backpack', title: 'Kit', subtitle: 'Compose ton sac' },
  { href: '/clubs/nouveau', icon: 'users', title: 'Club', subtitle: 'Rassemble ta cordée' },
];

export function CommunityCreateDrawer({ open, onOpenChange, onStory }: CommunityCreateDrawerProps) {
  return (
    <CommunityDrawer
      open={open}
      onClose={() => onOpenChange(false)}
      title="Créer"
      ariaLabel="Créer dans l’application"
    >
      <p className="-mt-1 mb-1 text-[11px] text-[#56665D]">Choisis un format, tout reste dans ton univers.</p>
      <div className="lkdv-create-grid">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className="lkdv-create-tile" onClick={() => onOpenChange(false)}>
            <span className="ico" aria-hidden="true"><Icon name={tile.icon} size={21} /></span>
            <b>{tile.title}</b>
            <small>{tile.subtitle}</small>
          </Link>
        ))}
        <button
          type="button"
          className="lkdv-create-tile lkdv-create-story"
          onClick={() => {
            onOpenChange(false);
            onStory();
          }}
        >
          <span className="ico" aria-hidden="true"><Icon name="plus" size={21} /></span>
          <span className="min-w-0 flex-1">
            <b className="block text-[14px]">Story</b>
            <small>Épingle un moment terrain, 24 h</small>
          </span>
          <Icon name="arrow-right" size={17} aria-hidden="true" />
        </button>
      </div>
    </CommunityDrawer>
  );
}

export default CommunityCreateDrawer;
