'use client';

// UI Layouts (MIT) — spotlight (halo radial suivant la souris) adapté LKDV.
// Desktop uniquement (hover fin) ; désactivé sur tactile et reduced-motion.
import React, { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useReducedMotion } from 'framer-motion';

export interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  /** Rayon du halo (px). */
  radius?: number;
  /** Couleur du halo (rgba). */
  color?: string;
}

/**
 * SpotlightCard — halo radial doux qui suit le curseur (desktop).
 * Le contenu est rendu tel quel ; l'overlay est pointer-events-none.
 */
export function SpotlightCard({
  children,
  className,
  radius = 320,
  color = 'rgba(91,127,85,0.14)',
}: SpotlightCardProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)');
  const reduceMotion = useReducedMotion();
  const enabled = fine && !reduceMotion;

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!enabled) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    [enabled],
  );

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setPos(null)}
    >
      {enabled && pos && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background: `radial-gradient(${radius}px circle at ${pos.x}px ${pos.y}px, ${color}, transparent 70%)`,
          }}
        />
      )}
      <div className="relative z-20 h-full">{children}</div>
    </div>
  );
}

export default SpotlightCard;