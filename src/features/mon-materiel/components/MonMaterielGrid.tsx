'use client';

/**
 * LKDV — Mon Matériel : grille du cockpit asymétrique (desktop) / 1 colonne (mobile).
 *
 * Disposition desktop (lg) — Option B :
 *   Colonnes : 3 | Rangées : 2 auto
 *   - Cartes 0 et 1 (grandes) : row-span-2 → occupent chacune 1 col × 2 rangées,
 *     côte à côte sur les colonnes 1 et 2.
 *   - Cartes 2, 3, 4, 5 (petites) : row-span-1 → remplissent la colonne 3
 *     en 2 rangées de 2 (wrapping naturel).
 *
 * Drag & drop ANIMÉ via framer-motion Reorder.
 * `dimmed` efface la grille pendant l'ouverture d'un plein écran.
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
  isLarge?: boolean;
}

function GridDragItem({ id, children, isLarge = false }: GridDragItemProps) {
  const controls = useDragControls();
  const child = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement<{
          onDragHandlePointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
        }>,
        { onDragHandlePointerDown: (e: React.PointerEvent<HTMLElement>) => controls.start(e) }
      )
    : children;

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      dragElastic={0.12}
      whileDrag={{ scale: 1.02, zIndex: 30 }}
      layout
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className={isLarge ? 'min-h-0 lg:row-span-2' : 'min-h-0'}
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
      className={[
        'grid grid-cols-1 gap-6 items-stretch',
        'sm:grid-cols-2',
        'lg:grid-cols-3 lg:grid-rows-2 lg:auto-rows-fr lg:flex-1 lg:min-h-0',
        className,
      ].join(' ')}
      animate={{ opacity: dimmed ? 0.35 : 1, scale: dimmed ? 0.985 : 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: 'center top' }}
    >
      {order.map((id, index) => (
        <GridDragItem key={id} id={id} isLarge={index < 2}>
          {renderCard(id)}
        </GridDragItem>
      ))}
    </Reorder.Group>
  );
}
