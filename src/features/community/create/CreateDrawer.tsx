'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { CapsuleTabs } from '@/components/ui/CapsuleTabs';
import { CommunityDrawer } from '@/features/community/sections/CommunityDrawer';
import { PostCreateForm } from './PostCreateForm';
import { StoryCreateForm } from './StoryCreateForm';
import { CarnetCreateForm } from './CarnetCreateForm';
import { SortieCreateForm } from './SortieCreateForm';
import { KitCreateForm } from './KitCreateForm';
import { ClubCreateForm } from './ClubCreateForm';
import { EmbeddedFormContext } from './EmbeddedFormContext';
import { CREATE_STEPS } from './shared/StepPager';

export type CreateKind = 'post' | 'carnet' | 'sortie' | 'kit' | 'club' | 'story';

const TYPES: Array<{ id: CreateKind; label: string; icon: React.ReactNode }> = [
  { id: 'post', label: 'Publication', icon: <Icon name="pencil" size={18} aria-hidden="true" /> },
  { id: 'carnet', label: 'Carnet', icon: <Icon name="book-open" size={18} aria-hidden="true" /> },
  { id: 'sortie', label: 'Sortie', icon: <Icon name="map" size={18} aria-hidden="true" /> },
  { id: 'kit', label: 'Kit', icon: <Icon name="backpack" size={18} aria-hidden="true" /> },
  { id: 'club', label: 'Club', icon: <Icon name="users" size={18} aria-hidden="true" /> },
  { id: 'story', label: 'Story', icon: <Icon name="plus" size={18} aria-hidden="true" /> },
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
  const [step, setStep] = useState(0);
  const steps = CREATE_STEPS[kind];

  useEffect(() => {
    if (open) {
      setKind(initialKind);
      setStep(0);
    }
  }, [initialKind, open]);

  const index = Math.max(0, TYPES.findIndex((item) => item.id === kind));
  const common = { open, onClose, user, onCreated };
  const selectStep = (next: number) =>
    setStep(Math.max(0, Math.min(steps.length - 1, next)));

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
            if (type) {
              setKind(type.id);
              setStep(0);
            }
          }}
          ariaLabel="Type de création"
          className="lkdv-create-selector lkdv-slot-selector"
        />
      </div>
      <EmbeddedFormContext.Provider value>
        {kind === 'post' ? (
          <PostCreateForm {...common} step={step} onStepChange={selectStep} />
        ) : null}
        {kind === 'story' ? (
          <StoryCreateForm {...common} step={step} onStepChange={selectStep} />
        ) : null}
        {kind === 'carnet' ? (
          <CarnetCreateForm {...common} step={step} onStepChange={selectStep} />
        ) : null}
        {kind === 'sortie' ? (
          <SortieCreateForm {...common} step={step} onStepChange={selectStep} />
        ) : null}
        {kind === 'kit' ? (
          <KitCreateForm {...common} step={step} onStepChange={selectStep} />
        ) : null}
        {kind === 'club' ? (
          <ClubCreateForm {...common} step={step} onStepChange={selectStep} />
        ) : null}
      </EmbeddedFormContext.Provider>
    </CommunityDrawer>
  );
}

export default CreateDrawer;
