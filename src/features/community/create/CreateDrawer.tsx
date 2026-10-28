'use client';

import React, { useEffect, useState } from 'react';
import { CapsuleTabs } from '@/components/ui/CapsuleTabs';
import { CommunityDrawer } from '@/features/community/sections/CommunityDrawer';
import { PostCreateForm } from './PostCreateForm';
import { StoryCreateForm } from './StoryCreateForm';
import { CarnetCreateForm } from './CarnetCreateForm';
import { SortieCreateForm } from './SortieCreateForm';
import { KitCreateForm } from './KitCreateForm';
import { ClubCreateForm } from './ClubCreateForm';
import { EmbeddedFormContext } from './EmbeddedFormContext';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export type CreateKind = 'post' | 'carnet' | 'sortie' | 'kit' | 'club' | 'story';

const TYPES: Array<{ id: CreateKind; label: string; icon: React.ReactNode }> = [
  { id: 'post', label: 'Publication', icon: <LKDVIcon name="modifier" size={18} aria-hidden="true" /> },
  { id: 'carnet', label: 'Carnet', icon: <LKDVIcon name="preparateur" size={18} aria-hidden="true" /> },
  { id: 'sortie', label: 'Sortie', icon: <LKDVIcon name="carte" size={18} aria-hidden="true" /> },
  { id: 'kit', label: 'Kit', icon: <LKDVIcon name="sac" size={18} aria-hidden="true" /> },
  { id: 'club', label: 'Club', icon: <LKDVIcon name="communaute" size={18} aria-hidden="true" /> },
  { id: 'story', label: 'Story', icon: <LKDVIcon name="plus" size={18} aria-hidden="true" /> },
];

export interface CreateDrawerProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: CreateKind, id: string) => void;
  initialKind?: CreateKind;
}

/** Un seul drawer de création : sélecteur en haut, formulaire adapté à l'intérieur. */
export function CreateDrawer({ open, onClose, user, onCreated, initialKind = 'post' }: CreateDrawerProps) {
  const [kind, setKind] = useState<CreateKind>(initialKind);

  useEffect(() => {
    if (open) setKind(initialKind);
  }, [initialKind, open]);

  const index = Math.max(0, TYPES.findIndex((item) => item.id === kind));
  const common = { open, onClose, user, onCreated };

  return (
    <CommunityDrawer
      open={open}
      onClose={onClose}
      title="Créer"
      ariaLabel="Créer dans l’application"
    >
      <div className="pt-1">
        <CapsuleTabs
          items={TYPES}
          activeIndex={index}
          onIndexChange={(next) => {
            const type = TYPES[next];
            if (type) setKind(type.id);
          }}
          ariaLabel="Type de création"
          className="lkdv-create-selector"
        />
      </div>
      <EmbeddedFormContext.Provider value>
        {kind === 'post' ? <PostCreateForm {...common} /> : null}
        {kind === 'story' ? <StoryCreateForm {...common} /> : null}
        {kind === 'carnet' ? <CarnetCreateForm {...common} /> : null}
        {kind === 'sortie' ? <SortieCreateForm {...common} /> : null}
        {kind === 'kit' ? <KitCreateForm {...common} /> : null}
        {kind === 'club' ? <ClubCreateForm {...common} /> : null}
      </EmbeddedFormContext.Provider>
    </CommunityDrawer>
  );
}

export default CreateDrawer;
