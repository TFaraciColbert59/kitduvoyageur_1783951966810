'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Hub V4 — Grille du MENU : entrée en cascade légère (respectueuse du
 * reduced motion). Les enfants sont des cartes-onglets (MenuCard).
 */
export function HubMenuGrid({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {React.Children.map(children, (child, i) => (
        <motion.div
          key={i}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.24,
            delay: reduceMotion ? 0 : Math.min(i * 0.04, 0.3),
            ease: [0.22, 1, 0.36, 1],
          }}
          className={child && React.isValidElement(child) && (child.props as { wide?: boolean }).wide ? 'sm:col-span-2' : ''}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

export default HubMenuGrid;