'use client';

/**
 * LKDV — Mon Matériel : grille du cockpit « 3×2 » (desktop) / 1 colonne (mobile).
 * Six cartes en strict 3 colonnes × 2 rangées, avec tailles hétérogènes :
 * la première rangée (priorité) est plus haute que la seconde — concentration
 * de l'attention sur les cartes critiques (départ, alertes, inventaire).
 *
 * Drag & drop ANIMÉ via framer-motion `Reorder` :
 * - chaque carte est un `Reorder.Item` qui se déplace SEUL et prend sa place
 *   automatiquement pendant le glisser (contraintes = grille) ;
 * - le drag est déclenché par la poignée (dragControls.start / pointer) ;
 * - spring élastique LKDV sur l'animation de retour/layout ;
 * - persistance inchangée : `widgetOrder` (lkdv_cockpit_widget_order).
 *
 * `dimmed` efface la grille pendant l'ouverture d'un plein écran
 * (shared element framer-motion).
 */

import React from 'react';
import { Reorder, useDragControls } from 'framer-motion';

export interface MonMaterielGridProps {
  order: string[];
  onReorder: (next: string[]) => void;
  renderCard: (id: string) => React.ReactNode;
  dimmed: boolean;
  className?: string;
}

interface GridDragItemProps {
  id: string;
  children: React.ReactNode;
}

function GridDragItem({ id, children }: GridDragItemProps) {
  const controls = useDragControls();
  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<{ onDragHandlePointerDown?: (e: React.PointerEvent<HTMLElement>) => void }>, {
        onDragHandlePointerDown: (e: React.PointerEvent<HTMLElement>) => controls.start(e),
      })
    : children;

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      dragElastic={0.12}
      whileDrag={{ scale: 1.02, zIndex: 30 }}
      className="h-full min-h-0"
    >
      {child}
    </Reorder.Item>
  );
}

export function MonMaterielGrid({
  order,
  onReorder,
  renderCard,
  dimmed,
  className = '',
}: MonMaterielGridProps) {
  return (
    <Reorder.Group
      as="div"
      values={order}
      onReorder={onReorder}
      className={`min-h-0 grid grid-cols-1 gap-3 items-stretch sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[1.15fr_0.85fr] lg:auto-rows-fr lg:flex-1 lg:min-h-0 ${className}`}
      animate={{ opacity: dimmed ? 0.35 : 1, scale: dimmed ? 0.985 : 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: 'center top' }}
    >
      {order.map((id) => (
        <GridDragItem key={id} id={id}>
          {renderCard(id)}
        </GridDragItem>
      ))}
    </Reorder.Group>
  );
}