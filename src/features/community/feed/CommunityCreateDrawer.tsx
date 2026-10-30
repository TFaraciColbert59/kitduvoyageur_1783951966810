'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { CommunityDrawer } from '@/features/community/sections/CommunityDrawer';

export type CreateKind = 'post' | 'carnet' | 'sortie' | 'kit' | 'club' | 'story';

export interface CommunityCreateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenForm: (kind: CreateKind) => void;
}

const TILES: Array<{ kind: CreateKind; icon: string; title: string; subtitle: string }> = [
  { kind: 'post', icon: 'pencil', title: 'Publication', subtitle: 'Photo, billet, question' },
  { kind: 'carnet', icon: 'book-open', title: 'Carnet', subtitle: 'Raconte ton expédition' },
  { kind: 'sortie', icon: 'map', title: 'Sortie GPS', subtitle: 'Date, lieu, participants' },
  { kind: 'kit', icon: 'backpack', title: 'Kit', subtitle: 'Compose ton sac' },
  { kind: 'club', icon: 'users', title: 'Club', subtitle: 'Rassemble ta cordée' },
  { kind: 'story', icon: 'plus', title: 'Story', subtitle: 'Un moment, 24 h' },
];

export function CommunityCreateDrawer({ open, onOpenChange, onOpenForm }: CommunityCreateDrawerProps) {
  return (
    <CommunityDrawer
      open={open}
      onClose={() => onOpenChange(false)}
      title="Créer"
      ariaLabel="Créer dans l’application"
    >
      <div className="lkdv-create-grid">
        {TILES.map((tile) => (
          <button
            key={tile.kind}
            type="button"
            className="lkdv-create-tile"
            aria-label={`${tile.title} — ${tile.subtitle}`}
            onClick={() => {
              onOpenChange(false);
              onOpenForm(tile.kind);
            }}
          >
            <span className="ico" aria-hidden="true"><Icon name={tile.icon} size={22} /></span>
          </button>
        ))}
      </div>
    </CommunityDrawer>
  );
}

export default CommunityCreateDrawer;
