'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Icon from '@/components/ui/Icon';
import { CarnetMediaTabs, type CarnetMediaTab } from './CarnetMediaTabs';
import { CarnetSubCapsule, type CarnetSubCapsuleItem } from './CarnetSubCapsule';
import { useScrollCut, useScrollTail } from './useScrollCut';

/**
 * Un seul drawer, réduit à ce qui n'est pas dans le sélecteur du bas :
 * les statistiques (sous-drawer à trois volets), le Partage, et les Moments
 * (la liste qui vivait sous la grille). Commentaires, J’aime et Gérer sont
 * devenus des pages du carrousel.
 */
export type CarnetDrawerId = 'stats' | 'share' | 'moments';

/** Navigation des sous-volets du volet actif : capsule 30 px en bas à droite. */
export interface CarnetDrawerSubNav {
  /** Nom accessible du groupe (`aria-label`). */
  label: string;
  items: CarnetSubCapsuleItem[];
  /** `''` ou un id absent : aucune lentille, aucune pastille active. */
  active: string;
  onChange: (id: string) => void;
}

export interface CarnetDrawerProps {
  drawer: CarnetDrawerId;
  onDrawerChange: (id: CarnetDrawerId) => void;
  onClose: () => void;
  /**
   * Sous-volets du volet affiché (Statistiques : Distance / Dénivelé / Jours).
   * Absent ou vide : le pied du drawer ne peint aucune capsule.
   */
  subNav?: CarnetDrawerSubNav | null;
  children: React.ReactNode;
}

const PANES: { id: CarnetDrawerId; label: string; icon: string }[] = [
  { id: 'stats', label: 'Statistiques', icon: 'trending-up' },
  { id: 'moments', label: 'Moments', icon: 'clock' },
  { id: 'share', label: 'Partage', icon: 'send' },
];

/**
 * Coquille de drawer du Compte : la carte devient le panneau.
 *
 * Anatomie mesurée : poignée 42 × 5 à 8 px du bord (6 px sous le doigt) et croix
 * de 36 px — la croix est posée en absolu, elle ne prend plus de ligne dans le
 * flux. Sous ces deux repères, le **sélecteur 44 px** du niveau drawer occupe
 * toute la largeur (16 px des bords) : un segment par volet, icône 18 + libellé
 * 12,5/600, lentille blanche qui glisse au pas des segments. Le corps commence
 * 24 px plus bas, réserve de 64 px en bas, plafond de 503 px : au-delà, le corps
 * défile et un voile de 24 px ferme le bas. Les sous-volets du volet actif se
 * naviguent dans une capsule 30 px ancrée à 12 px du bord droit et du bas, hors
 * du flux, donc jamais masquée par le défilement. La page est voilée sous la
 * feuille, et les 12 px du bas portent le curseur `grab` du châssis sans ajouter
 * de geste.
 */
export function CarnetDrawer({
  drawer,
  onDrawerChange,
  onClose,
  subNav = null,
  children,
}: CarnetDrawerProps) {
  const ref = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const scrolled = useScrollCut(bodyRef);
  const tail = useScrollTail(bodyRef);
  /* Poignée pressée : la barre s'épaissit au doigt comme à la souris. L'état ne
     sert qu'au dessin (`data-press`), il ne déclenche aucun geste. */
  const [pressed, setPressed] = useState(false);
  /* Sortie de 160 ms : la feuille joue son fondu avant que l'écran ne la
     démonte, donc la fermeture ne claque jamais. Aucune animation en boucle. */
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const available = PANES;
  /* Trois volets, trois segments : la lentille est toujours sur l'un d'eux. */
  const activeIndex = available.findIndex((pane) => pane.id === drawer);
  const items: CarnetMediaTab[] = available.map((pane) => ({
    id: pane.id,
    label: pane.label,
    icon: <Icon name={pane.icon} size={18} aria-hidden="true" />,
  }));
  const hasSubNav = Boolean(subNav && subNav.items.length > 0);

  /* Le focus initial et l'écoute d'Échap posent une seule fois, à l'ouverture :
     `onClose` change d'identité à chaque rendu du parent, et rejouer l'effet
     volait le focus de la capsule à chaque changement de volet. */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    timerRef.current = window.setTimeout(() => onCloseRef.current(), 160);
  }, []);

  useEffect(() => {
    /* 48 — le focus revient au déclencheur à la fermeture, jamais au hasard. */
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus({ preventScroll: true });
    /* 47 — le fond ne défile plus tant que la feuille est ouverte. */
    const root = document.documentElement;
    const hadLock = root.hasAttribute('data-ckp-sheet');
    root.setAttribute('data-ckp-sheet', 'true');
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (!hadLock) root.removeAttribute('data-ckp-sheet');
      trigger?.focus({ preventScroll: true });
    };
  }, [requestClose]);

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
        aria-hidden={closing ? 'true' : undefined}
        data-closing={closing ? 'true' : undefined}
      >
        {/* Chrome du drawer : poignée + croix, puis le sélecteur des volets.
            Le voile de coupe est posé sous l'ensemble, jamais sur un segment. */}
        <div className="ckp-drawer-chrome">
          <div className="ckp-drawer-head">
            <button
              type="button"
              className="ckp-grabber"
              onClick={requestClose}
              aria-label="Fermer le panneau"
              data-press={pressed ? 'true' : undefined}
              onPointerDown={() => setPressed(true)}
              onPointerUp={() => setPressed(false)}
              onPointerCancel={() => setPressed(false)}
              onPointerLeave={() => setPressed(false)}
            >
              <span aria-hidden="true" />
            </button>
            <button type="button" className="ckp-drawer-close" onClick={requestClose} aria-label="Fermer">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {/* Sélecteur du niveau drawer : 44 px, pleine largeur, 16 px des bords.
              Un segment par volet — la lentille blanche glisse de l'un à l'autre
              en 220 ms, au pas exact de la barre. */}
          <div
            className="ckp-drawer-select"
            style={{ '--n': items.length } as React.CSSProperties}
          >
            <span
              className="ckp-th"
              aria-hidden="true"
              data-off={activeIndex < 0 ? 'true' : undefined}
              style={{ '--i': Math.max(0, activeIndex) } as React.CSSProperties}
            />
            <CarnetMediaTabs
              items={items}
              activeIndex={activeIndex}
              onChange={(index) => onDrawerChange(available[index].id)}
              ariaLabel="Volets du carnet"
              idPrefix="carnet-drawer-tab"
              panelIdFor={() => undefined}
              showLabel
            />
          </div>
          <span className="ckp-drawer-cut" data-on={scrolled ? 'true' : undefined} aria-hidden="true" />
        </div>
        <div className="ckp-card-scroll ckp-drawer-body" ref={bodyRef}>
          {children}
        </div>
        {/* Voile de fin de course : 24 px, du transparent vers le blanc .72. */}
        <span className="ckp-drawer-veil" data-on={tail ? 'true' : undefined} aria-hidden="true" />
        {/* Sous-volets du volet actif : capsule 30 px à 12 px du bord droit et
            du bas, hors du flux — la même matière, la même lentille et le même
            pas de 41,5 px que la capsule de la carte (`n × 41,5 + 5`). */}
        {hasSubNav && subNav ? (
          <div className="ckp-drawer-foot">
            <CarnetSubCapsule
              items={subNav.items}
              active={subNav.active}
              onChange={subNav.onChange}
              ariaLabel={subNav.label}
            />
          </div>
        ) : null}
        {/* Zone de retour tactile : 12 px en bas de la feuille, curseur `grab`,
            aucun geste — la réserve de 64 px la garde sous le contenu. */}
        <span className="ckp-drawer-grip" aria-hidden="true" />
      </section>
    </>
  );
}

export default CarnetDrawer;
