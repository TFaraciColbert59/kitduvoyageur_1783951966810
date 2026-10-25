'use client';

import React, { useEffect, useRef } from 'react';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';
import Icon from '@/components/ui/Icon';
import type { CarnetDetail } from '@/features/carnet/detail/types';

/**
 * Un seul drawer : les statistiques (un sous-drawer à trois volets),
 * les Commentaires, les J’aime, le Partage et Gérer (propriétaire).
 */
export type CarnetDrawerId = 'stats' | 'comments' | 'likes' | 'share' | 'manage';

export interface CarnetDrawerProps {
  detail: CarnetDetail;
  drawer: CarnetDrawerId;
  onDrawerChange: (id: CarnetDrawerId) => void;
  onClose: () => void;
  children: React.ReactNode;
}

const PANES: { id: CarnetDrawerId; label: string; icon: string }[] = [
  { id: 'stats', label: 'Statistiques', icon: 'trending-up' },
  { id: 'comments', label: 'Commentaires', icon: 'message-square' },
  { id: 'likes', label: 'J’aime', icon: 'heart' },
  { id: 'share', label: 'Partage', icon: 'send' },
  { id: 'manage', label: 'Gérer', icon: 'pencil' },
];

/**
 * Coquille de drawer du Compte : la carte devient le panneau.
 * Poignée 18 px, capsule 48, contenu scrollable à l'intérieur de la carte.
 */
export function CarnetDrawer({ detail, drawer, onDrawerChange, onClose, children }: CarnetDrawerProps) {
  const ref = useRef<HTMLElement | null>(null);
  const available = PANES.filter((pane) => pane.id !== 'manage' || detail.isOwner);
  const items: CapsuleTabItem[] = available.map((pane) => ({
    id: pane.id,
    label: pane.label,
    icon: <Icon name={pane.icon} size={18} aria-hidden="true" />,
  }));

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <section
      className="ckp-card ckp-card--drawer"
      ref={ref as React.RefObject<HTMLElement>}
      tabIndex={-1}
      role="region"
      aria-label="Panneau du carnet"
    >
      <button type="button" className="ckp-grabber" onClick={onClose} aria-label="Fermer le panneau">
        <span aria-hidden="true" />
      </button>
      <div className="ckp-drawer-tabs">
        <CapsuleTabs
          items={items}
          activeIndex={Math.max(0, available.findIndex((pane) => pane.id === drawer))}
          onIndexChange={(index) => onDrawerChange(available[index].id)}
          ariaLabel="Volets du carnet"
        />
      </div>
      <div className="ckp-card-scroll ckp-drawer-body">{children}</div>
    </section>
  );
}

export default CarnetDrawer;
