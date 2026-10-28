'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import {
  DrawerShell,
  type DrawerSecondaryItem,
  type DrawerTab,
} from '@/components/compte/drawer/shell/DrawerShell';
import { CommunityCardDrawer } from '@/features/community/shell/CommunityCardDrawer';
import { PostCreateForm, type PostKind } from './PostCreateForm';
import { StoryCreateForm } from './StoryCreateForm';
import { SortieCreateForm } from './SortieCreateForm';
import { KitCreateForm } from './KitCreateForm';
import { ClubCreateForm } from './ClubCreateForm';
import { CARNET_EDITOR_HREF } from './carnetEditor';
import { WizardEdgeContext, type WizardEdgeHandler } from './wizard/edge';

export type CreateKind = 'post' | 'carnet' | 'sortie' | 'kit' | 'club' | 'story';

/** Ordre de la capsule : icônes seules, `label` sert à `aria-label` et `title`. */
export const CREATE_KINDS: ReadonlyArray<{ id: CreateKind; label: string; icon: string }> = [
  { id: 'post', label: 'Publication', icon: 'pencil' },
  { id: 'carnet', label: 'Carnet', icon: 'book-open' },
  { id: 'sortie', label: 'Sortie', icon: 'map' },
  { id: 'kit', label: 'Kit', icon: 'backpack' },
  { id: 'club', label: 'Club', icon: 'users' },
  { id: 'story', label: 'Story', icon: 'plus' },
];

/** Formats de publication, dans la sous-capsule de 30 px de l'onglet Publication. */
const POST_FORMATS: ReadonlyArray<{ id: PostKind; label: string; icon: string }> = [
  { id: 'photo', label: 'Photo ou vidéo', icon: 'image-plus' },
  { id: 'billet', label: 'Billet', icon: 'file-text' },
  { id: 'question', label: 'Question', icon: 'help-circle' },
  { id: 'event', label: 'Événement', icon: 'calendar' },
];

export interface CreateDrawerProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: CreateKind, id: string) => void;
  initialKind?: CreateKind;
}

function indexOfKind(kind: CreateKind): number {
  return Math.max(
    0,
    CREATE_KINDS.findIndex((item) => item.id === kind)
  );
}

/**
 * Un seul drawer de création, en place dans la carte : capsule de 6 types
 * (icônes seules) en haut, un formulaire par volet. Un re-clic sur l'onglet
 * actif ferme le drawer.
 */
export function CreateDrawer({
  open,
  onClose,
  user,
  onCreated,
  initialKind = 'post',
}: CreateDrawerProps) {
  const router = useRouter();
  const [index, setIndex] = useState(() => indexOfKind(initialKind));
  const [formatIndex, setFormatIndex] = useState(0);

  // `onClose` et `router` changent à chaque rendu du parent : on les lit par référence pour que
  // l'onglet ne soit réinitialisé qu'à l'ouverture ou au changement de type demandé.
  const latest = useRef({ onClose, router });
  latest.current = { onClose, router };

  useEffect(() => {
    if (!open) return;
    if (initialKind === 'carnet') {
      latest.current.onClose();
      latest.current.router.push(CARNET_EDITOR_HREF);
      return;
    }
    setIndex(indexOfKind(initialKind));
  }, [initialKind, open]);

  const common = { open: true, onClose, user, onCreated };

  // Glissement au bord d'un parcours : onglet voisin, en sautant « Carnet » (qui quitte le drawer).
  const edge: WizardEdgeHandler = (direction) => {
    const step = direction === 'next' ? 1 : -1;
    for (let target = index + step; target >= 0 && target < CREATE_KINDS.length; target += step) {
      if (CREATE_KINDS[target]?.id === 'carnet') continue;
      setIndex(target);
      return true;
    }
    return false;
  };

  const renderers: Record<CreateKind, () => React.ReactNode> = {
    post: () => <PostCreateForm {...common} format={POST_FORMATS[formatIndex]?.id ?? 'photo'} />,
    story: () => <StoryCreateForm {...common} />,
    // Le carnet a sa propre page de création (/carnets/nouveau) : l'onglet y mène, il n'a pas de formulaire ici.
    carnet: () => null,
    sortie: () => <SortieCreateForm {...common} />,
    kit: () => <KitCreateForm {...common} />,
    club: () => <ClubCreateForm {...common} />,
  };

  const tabs: DrawerTab[] = CREATE_KINDS.map((item) => ({
    id: item.id,
    label: item.label,
    icon: <Icon name={item.icon} size={18} aria-hidden="true" />,
    render: renderers[item.id],
  }));

  const secondaryItems: DrawerSecondaryItem[] = POST_FORMATS.map((format) => ({
    id: format.id,
    label: format.label,
    icon: <Icon name={format.icon} size={15} aria-hidden="true" />,
  }));

  return (
    <CommunityCardDrawer open={open} onClose={onClose} ariaLabel="Créer dans l’application" strict>
      <WizardEdgeContext.Provider value={edge}>
        <DrawerShell
          tabs={tabs}
          activeIndex={index}
          secondary={
            CREATE_KINDS[index]?.id === 'post'
              ? {
                  items: secondaryItems,
                  active: formatIndex,
                  onChange: setFormatIndex,
                  label: 'Format de publication',
                }
              : undefined
          }
          onIndexChange={(next) => {
            if (next === index) onClose();
            else if (CREATE_KINDS[next]?.id === 'carnet') {
              onClose();
              router.push(CARNET_EDITOR_HREF);
            } else setIndex(next);
          }}
        />
      </WizardEdgeContext.Provider>
    </CommunityCardDrawer>
  );
}

export default CreateDrawer;
