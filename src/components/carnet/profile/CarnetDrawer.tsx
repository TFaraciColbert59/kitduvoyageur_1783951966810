'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Icon from '@/components/ui/Icon';
import { CarnetMediaTabs, type CarnetMediaTab } from './CarnetMediaTabs';
import { useScrollCut, useScrollTail } from './useScrollCut';

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
 * Anatomie mesurée : poignée 42 × 5 à 8 px du bord (6 px sous le doigt) et croix
 * de 36 px — la croix est posée en absolu, elle ne prend plus de ligne dans le
 * flux, donc le contenu commence 16 px sous la poignée. La feuille garde le
 * rayon 24 du châssis en haut et referme le bas à 16, sous un liseré blanc qui
 * suit l'arc supérieur. La hauteur suit son contenu (réserve de 64 px en bas),
 * plafonnée à 503 px ; au-delà, le corps défile et un voile de 24 px ferme le
 * bas. La capsule d'onglets garde la matière, la lentille et le pas de celle de
 * la carte, à 12 px des bords. La page est voilée sous la feuille, et les 12 px
 * du bas portent le curseur `grab` du châssis sans ajouter de geste.
 */
export function CarnetDrawer({ drawer, onDrawerChange, onClose, children }: CarnetDrawerProps) {
  const ref = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const scrolled = useScrollCut(bodyRef);
  const tail = useScrollTail(bodyRef);
  /* Poignée pressée : la barre s'épaissit au doigt comme à la souris. L'état ne
     sert qu'au dessin (`data-press`), il ne déclenche aucun geste. */
  const [pressed, setPressed] = useState(false);
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
    <>
      {/* Voile de la page, sous la feuille : .10 au centre, .28 dans la zone que
          le drawer recouvre. Il n'ajoute aucune surface cliquable. */}
      <span className="ckp-scrim" aria-hidden="true" />
      <section
        className="ckp-card ckp-card--drawer"
        ref={ref as React.RefObject<HTMLElement>}
        tabIndex={-1}
        role="region"
        aria-label="Panneau du carnet"
      >
        <div className="ckp-drawer-head">
          <button
            type="button"
            className="ckp-grabber"
            onClick={onClose}
            aria-label="Fermer le panneau"
            data-press={pressed ? 'true' : undefined}
            onPointerDown={() => setPressed(true)}
            onPointerUp={() => setPressed(false)}
            onPointerCancel={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
          >
            <span aria-hidden="true" />
          </button>
          <button type="button" className="ckp-drawer-close" onClick={onClose} aria-label="Fermer">
            <X size={16} aria-hidden="true" />
          </button>
          <span className="ckp-drawer-cut" data-on={scrolled ? 'true' : undefined} aria-hidden="true" />
        </div>
        <div className="ckp-card-scroll ckp-drawer-body" ref={bodyRef}>
          {children}
        </div>
        {/* Voile de fin de course : 24 px, du transparent vers le blanc .72. */}
        <span className="ckp-drawer-veil" data-on={tail ? 'true' : undefined} aria-hidden="true" />
        {/* La capsule d'onglets du drawer, à 12 px des bords bas et droit :
            même verre, même lentille blanche, même pas de 41,5 px. Sa largeur
            suit le nombre de segments (41,5 × n + 5). */}
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
        {/* Zone de retour tactile : 12 px en bas de la feuille, curseur `grab`,
            aucun geste — la réserve de 64 px la garde sous le contenu. */}
        <span className="ckp-drawer-grip" aria-hidden="true" />
      </section>
    </>
  );
}

export default CarnetDrawer;
