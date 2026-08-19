'use client';

/**
 * LKDV — Mon Matériel : grille du cockpit « 3×2 » (desktop) / 1 colonne (mobile).
 * Six cartes en strict 3 colonnes × 2 rangées, avec tailles hétérogènes :
 * la première rangée (priorité) est plus haute que la seconde — concentration
 * de l'attention sur les cartes critiques (départ, alertes, inventaire).
 * Le glisser-déposer (poignée) réordonne ; les cartes glissent ensuite vers
 * leur nouvelle position grâce à l'animation `layout` de framer-motion
 * (spring élastique LKDV). `dimmed` efface la grille pendant l'ouverture
 * d'un plein écran (shared element framer-motion).
 */

import React from 'react';
import { motion } from 'framer-motion';

export interface MonMaterielGridProps {
  order: string[];
  renderCard: (id: string) => React.ReactNode;
  dimmed: boolean;
  className?: string;
}

export function MonMaterielGrid({
  order,
  renderCard,
  dimmed,
  className = '',
}: MonMaterielGridProps) {
  return (
    <motion.div
      className={`min-h-0 grid grid-cols-1 gap-3 items-stretch sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[1.15fr_0.85fr] lg:auto-rows-fr lg:flex-1 lg:min-h-0 ${className}`}
      animate={{ opacity: dimmed ? 0.35 : 1, scale: dimmed ? 0.985 : 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: 'center top' }}
      onDragOver={(e) => e.preventDefault()}
    >
      {order.map((id) => renderCard(id))}
    </motion.div>
  );
}