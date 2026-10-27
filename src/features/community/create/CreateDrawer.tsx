'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, BookOpen, Map, Backpack, Users, Plus } from 'lucide-react';
import { CapsuleTabs } from '@/components/ui/CapsuleTabs';
import { CommunityDrawer } from '@/features/community/sections/CommunityDrawer';
import { PostCreateForm } from './PostCreateForm';
import { StoryCreateForm } from './StoryCreateForm';
import { CarnetMapDrawer } from './CarnetMapDrawer';
import { SortieCreateForm } from './SortieCreateForm';
import { KitCreateForm } from './KitCreateForm';
import { ClubCreateForm } from './ClubCreateForm';
import { EmbeddedFormContext } from './EmbeddedFormContext';
import { CREATE_STEPS } from './shared/StepPager';
import { CloseDraftConfirm } from './shared/CloseDraftConfirm';
import {
  flushCreateDraft,
  hasCreateDraftContent,
  isCreateDraftSubmitting,
} from './engine/useCreateDraft';

export type CreateKind = 'post' | 'carnet' | 'sortie' | 'kit' | 'club' | 'story';

const TYPES: Array<{ id: CreateKind; label: string; icon: React.ReactNode }> = [
  { id: 'post', label: 'Publication', icon: <Pencil size={19} aria-hidden="true" /> },
  { id: 'carnet', label: 'Carnet', icon: <BookOpen size={19} aria-hidden="true" /> },
  { id: 'sortie', label: 'Sortie', icon: <Map size={19} aria-hidden="true" /> },
  { id: 'kit', label: 'Kit', icon: <Backpack size={19} aria-hidden="true" /> },
  { id: 'club', label: 'Club', icon: <Users size={19} aria-hidden="true" /> },
  { id: 'story', label: 'Story', icon: <Plus size={19} aria-hidden="true" /> },
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
  const [confirmingClose, setConfirmingClose] = useState(false);
  const steps = CREATE_STEPS[kind];

  useEffect(() => {
    if (open) {
      setKind(initialKind);
      setStep(0);
      setConfirmingClose(false);
    } else {
      setConfirmingClose(false);
    }
  }, [initialKind, open]);

  const requestClose = useCallback(() => {
    // Une publication en cours appelle `onClose` après l’insertion : la
    // confirmation ne doit pas s’interposer sur un succès.
    if (isCreateDraftSubmitting(kind) || !hasCreateDraftContent(kind, kind)) {
      onClose();
      return;
    }
    flushCreateDraft(kind, kind);
    setConfirmingClose(true);
  }, [kind, onClose]);

  const confirmClose = useCallback(() => {
    flushCreateDraft(kind, kind);
    setConfirmingClose(false);
    onClose();
  }, [kind, onClose]);

  const index = Math.max(0, TYPES.findIndex((item) => item.id === kind));
  const common = { open, onClose: requestClose, user, onCreated };
  const selectStep = (next: number) =>
    setStep(Math.max(0, Math.min(steps.length - 1, next)));

  return (
    <>
      <CommunityDrawer
        open={open}
        onClose={requestClose}
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
            <CarnetMapDrawer {...common} />
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
      <CloseDraftConfirm
        open={confirmingClose}
        kind={kind}
        onKeepEditing={() => setConfirmingClose(false)}
        onConfirm={confirmClose}
      />
    </>
  );
}

export default CreateDrawer;
