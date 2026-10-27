'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';
import Icon from '@/components/ui/Icon';
import { useScrollCut } from './useScrollCut';

/**
 * Un seul drawer, réduit à ce qui n'est pas dans le sélecteur du bas :
 * les statistiques (sous-drawer à trois volets) et le Partage.
 * Commentaires, J’aime et Gérer sont devenus des pages du carrousel.
 */
export type CarnetDrawerId = 'stats' | 'share';

export interface CarnetDrawerProps {
  drawer: CarnetDrawerId;
  onDrawerChange: (id: CarnetDrawerId) => void;
  onClose: () => void;
  children: React.ReactNode;
}

const PANES: { id: CarnetDrawerId; label: string; icon: string }[] = [
  { id: 'stats', label: 'Statistiques', icon: 'trending-up' },
  { id: 'share', label: 'Partage', icon: 'send' },
];

/**
 * Coquille de drawer du Compte : la carte devient le panneau.
 *
 * Anatomie mesurée : poignée 42 × 5 à 8 px du bord, sélecteur à sa droite une
 * croix de 36 px (le glissement n'est jamais le seul moyen de fermer), et un
 * voile `backdrop-blur(12px)` + hairline qui apparaît dès 8 px de défilement,
 * en fondu de 160 ms. Aucun titre au-dessus du contenu.
 */
export function CarnetDrawer({ drawer, onDrawerChange, onClose, children }: CarnetDrawerProps) {
  const ref = useRef<HTMLElement | null>(null);
  const scrolled = useScrollCut(ref);
  const available = PANES;
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
      <div className="ckp-drawer-head">
        <button type="button" className="ckp-grabber" onClick={onClose} aria-label="Fermer le panneau">
          <span aria-hidden="true" />
        </button>
        <div className="ckp-drawer-row">
          <div className="ckp-drawer-tabs">
            <CapsuleTabs
              items={items}
              activeIndex={Math.max(0, available.findIndex((pane) => pane.id === drawer))}
              onIndexChange={(index) => onDrawerChange(available[index].id)}
              ariaLabel="Volets du carnet"
            />
          </div>
          <button type="button" className="ckp-drawer-close" onClick={onClose} aria-label="Fermer">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <span className="ckp-drawer-cut" data-on={scrolled ? 'true' : undefined} aria-hidden="true" />
      </div>
      <div className="ckp-card-scroll ckp-drawer-body">{children}</div>
    </section>
  );
}

export default CarnetDrawer;
