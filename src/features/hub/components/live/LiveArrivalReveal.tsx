'use client';

// Hub live (§4.5) — wrapper de liste : ArrivalReveal n'est réellement joué
// que pour un id du seen-set d'arrivées (bus T9). Hors seen-set, même structure
// de boîte (`div` + className) sans animation ; à l'activation, le remount du
// wrapper joue le cycle unique d'ArrivalReveal — un id jamais rejoué ensuite.
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
  if (!liveIds.has(id)) {
    return <div className={className}>{children}</div>;
  }

  return (
    <ArrivalReveal index={index} className={className}>
      {children}
    </ArrivalReveal>
  );
}

export default LiveArrivalReveal;
