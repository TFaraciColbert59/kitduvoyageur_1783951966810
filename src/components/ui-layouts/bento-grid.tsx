'use client';

// UI Layouts (MIT) — bento mosaïque (box-grid) adapté LKDV : spans déclaratifs,
// collapse mobile 1 colonne, tokens, reduced-motion.
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SpotlightCard } from './spotlight-card';

export type BentoSpan = 3 | 4 | 6 | 8;

export interface BentoCell {
  /** Largeur desktop (lg: 12 cols) : 8 = deux-tiers, 6 = demi, 4 = tiers, 3 = quart. */
  span: BentoSpan;
  node: React.ReactNode;
  key?: string;
}

export interface BentoGridProps {
  cells: BentoCell[];
  className?: string;
  /** grid-template-rows explicite (hub plein écran) — les lignes remplissent le parent. */
  fitRows?: string;
}

const SPAN_CLASS: Record<BentoSpan, string> = {
  // <640 : 1 col · sm(2 cols) : 8/6→pleine, 4/3→demi · lg(12 cols) : span exact
  8: 'sm:col-span-2 lg:col-span-8',
  6: 'sm:col-span-2 lg:col-span-6',
  4: 'sm:col-span-1 lg:col-span-4',
  3: 'sm:col-span-1 lg:col-span-3',
};

/**
 * BentoGrid — grille mosaïque de la racine Hub (UI Layouts, adapté).
 * Toutes les cellules sont pleine hauteur ; la cascade d'entrée respecte
 * le reduced motion. `fitRows` : hauteur pilotée par le parent (hub plein
 * écran sans scroll) au lieu d'empiler naturellement.
 */
export function BentoGrid({ cells, className, fitRows }: BentoGridProps) {
  const reduceMotion = useReducedMotion();
  // Les defs du filtre verre sont rendues UNE SEULE fois dans /hub/layout
  // (les deux shells desktop/mobile partagent la même page).
  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3',
        fitRows ? 'h-full min-h-0' : 'auto-rows-[minmax(150px,auto)]',
        className,
      )}
      style={fitRows ? { gridTemplateRows: fitRows } : undefined}
    >
      {cells.map((cell, i) => (
        <motion.div
          key={cell.key ?? i}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.24,
            delay: reduceMotion ? 0 : Math.min(i * 0.04, 0.3),
            ease: [0.22, 1, 0.36, 1],
          }}
          className={cn('h-full min-h-0', SPAN_CLASS[cell.span])}
        >
          <SpotlightCard className="h-full min-h-0">{cell.node}</SpotlightCard>
        </motion.div>
      ))}
    </div>
  );
}

export default BentoGrid;