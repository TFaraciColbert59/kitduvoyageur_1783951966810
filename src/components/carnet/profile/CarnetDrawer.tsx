'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Icon from '@/components/ui/Icon';
import { CarnetMediaTabs, type CarnetMediaTab } from './CarnetMediaTabs';
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
 * Anatomie mesurée : poignée 42 × 5 à 8 px du bord et croix de 36 px (le
 * glissement n'est jamais le seul moyen de fermer) — ce sont les deux seuls
 * éléments du haut. La capsule d'onglets ne vit plus sous la poignée : elle
 * reprend la place et la matière de celle de la carte d'identité, en bas à
 * droite de la feuille (10 px des deux bords, 30 px de haut, 41,5 px par
 * segment + 5 px de padding). Un voile `backdrop-blur(12px)` + hairline
 * apparaît dès 8 px de défilement, en fondu de 160 ms. Aucun titre.
 */
export function CarnetDrawer({ drawer, onDrawerChange, onClose, children }: CarnetDrawerProps) {
  const ref = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const scrolled = useScrollCut(bodyRef);
  const available = PANES;
  const activeIndex = Math.max(0, available.findIndex((pane) => pane.id === drawer));
  const items: CarnetMediaTab[] = available.map((pane) => ({
    id: pane.id,
    label: pane.label,
    icon: <Icon name={pane.icon} size={16} aria-hidden="true" />,
  }));

  /* Le focus initial et l'écoute d'Échap posent une seule fois, à l'ouverture :
     `onClose` change d'identité à chaque rendu du parent, et rejouer l'effet
     volait le focus de la capsule à chaque changement de volet. */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

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
          <button type="button" className="ckp-drawer-close" onClick={onClose} aria-label="Fermer">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <span className="ckp-drawer-cut" data-on={scrolled ? 'true' : undefined} aria-hidden="true" />
      </div>
      <div className="ckp-card-scroll ckp-drawer-body" ref={bodyRef}>
        {children}
      </div>
      {/* La capsule d'onglets du drawer, à la place exacte de celle de la carte :
          `right/bottom: 10px`, 30 px de haut, même verre, même lentille blanche.
          Sa largeur suit le nombre de segments (41,5 × n + 5). */}
      <div className="ckp-drawer-foot">
        <div className="ckp-capsule" style={{ '--n': items.length } as React.CSSProperties}>
          <span
            className="ckp-th"
            aria-hidden="true"
            style={{ '--i': activeIndex } as React.CSSProperties}
          />
          <CarnetMediaTabs
            items={items}
            activeIndex={activeIndex}
            onChange={(index) => onDrawerChange(available[index].id)}
            ariaLabel="Volets du carnet"
            idPrefix="carnet-drawer-tab"
            panelIdFor={() => undefined}
          />
        </div>
      </div>
    </section>
  );
}

export default CarnetDrawer;
