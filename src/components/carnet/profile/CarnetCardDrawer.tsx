'use client';

import React, { useEffect, useRef } from 'react';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';
import Icon from '@/components/ui/Icon';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export type CarnetPaneId = 'comments' | 'share' | 'parcours' | 'manage';

export interface CarnetCardDrawerProps {
  detail: CarnetDetail;
  pane: CarnetPaneId;
  onPaneChange: (pane: CarnetPaneId) => void;
  onClose: () => void;
  children: React.ReactNode;
}

const ICONS: Record<CarnetPaneId, string> = {
  comments: 'message-square',
  share: 'send',
  parcours: 'map',
  manage: 'pencil',
};

const LABELS: Record<CarnetPaneId, string> = {
  comments: 'Commentaires',
  share: 'Partage',
  parcours: 'Parcours',
  manage: 'Gérer',
};

/**
 * Carte-drawer du Compte : la carte devient la surface du panneau.
 * Poignée 18 px, capsule 48 en tête (icônes seules), aucun voile, aucun titre.
 */
export function CarnetCardDrawer({
  detail,
  pane,
  onPaneChange,
  onClose,
  children,
}: CarnetCardDrawerProps) {
  const cardRef = useRef<HTMLElement | null>(null);

  const panes: CarnetPaneId[] = detail.isOwner
    ? ['comments', 'share', 'parcours', 'manage']
    : ['comments', 'share', 'parcours'];

  const items: CapsuleTabItem[] = panes.map((id) => ({
    id,
    label: LABELS[id],
    icon: <Icon name={ICONS[id]} size={18} aria-hidden="true" />,
  }));

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <section
      className="ckp-card ckp-card--drawer"
      ref={cardRef as React.RefObject<HTMLElement>}
      tabIndex={-1}
      aria-label={`${LABELS[pane]} du carnet`}
      role="region"
    >
      <button type="button" className="ckp-grabber" onClick={onClose} aria-label="Fermer le panneau">
        <span aria-hidden="true" />
      </button>

      <CapsuleTabs
        items={items}
        activeIndex={Math.max(0, panes.indexOf(pane))}
        onIndexChange={(index) => onPaneChange(panes[index])}
        ariaLabel="Volets du carnet"
      />

      <div className="ckp-drawer-body">{children}</div>
    </section>
  );
}

export default CarnetCardDrawer;
