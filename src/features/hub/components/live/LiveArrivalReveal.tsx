'use client';

// Hub live (§4.5) — wrapper de liste : l'arrivée n'est révélée que pour un id
// du seen-set (bus T9, INSERT uniquement). T10 fix — un seul type d'élément
// (`motion.div` via ArrivalReveal) quel que soit l'état : le passage
// statique → reveal est une animation, jamais un remount (focus préservé).
import type { ReactNode } from 'react';
import { ArrivalReveal } from './ArrivalReveal';

export interface LiveArrivalRevealProps {
  /** Id DB de la ligne (comparé au seen-set du bus). */
  id: string;
  /** Ids reçus par le bus pendant que la section était visible. */
  liveIds: ReadonlySet<string>;
  /** Position dans la vague (stagger ≤ 0,3 s via ArrivalReveal). */
  index?: number;
  className?: string;
  children: ReactNode;
}

export function LiveArrivalReveal({
  id,
  liveIds,
  index = 0,
  className,
  children,
}: LiveArrivalRevealProps) {
  const live = liveIds.has(id);

  return (
    <ArrivalReveal active={live} index={live ? index : 0} className={className}>
      {children}
    </ArrivalReveal>
  );
}

export default LiveArrivalReveal;
