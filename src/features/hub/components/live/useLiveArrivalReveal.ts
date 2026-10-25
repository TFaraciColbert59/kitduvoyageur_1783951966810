'use client';

// Hub live (§4.5) — portail de visibilité des reveals. Un id reçu par le bus
// T9 n'est proposé au reveal que si sa section était visible à l'instant de
// l'arrivée : rien ne s'anime en arrière-plan ni pendant le scroll, et les
// ids déjà traités ne sont jamais rejoués (seen-set local).
import { useEffect, useRef, useState } from 'react';
import { shouldRevealArrival, useActivityLiveArrivals } from './useActivityLiveArrivals';

export interface LiveArrivalRevealHandle<T extends HTMLElement> {
  /** Ids de la table reçus par le bus pendant que la section était visible. */
  liveIds: ReadonlySet<string>;
  /** Callback ref à poser sur la section qui porte les items revealés. */
  containerRef: (element: T | null) => void;
}

export function useLiveArrivalReveal<T extends HTMLElement = HTMLDivElement>(
  table: string
): LiveArrivalRevealHandle<T> {
  const { arrivals } = useActivityLiveArrivals();
  const [element, setElement] = useState<T | null>(null);
  // Tant que l'observateur n'a pas confirmé la visibilité, rien n'est animé :
  // une section hors écran (ou un historique d'arrivées antérieur au montage)
  // ne rejoue jamais les reveals au scroll.
  const visibleRef = useRef(false);
  const processedRef = useRef<Set<string>>(new Set());
  const liveRef = useRef<Set<string>>(new Set());
  const [liveIds, setLiveIds] = useState<ReadonlySet<string>>(() => new Set<string>());

  useEffect(() => {
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      // Environnement sans IO : on ne bloque pas les reveals.
      visibleRef.current = true;
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        visibleRef.current = entries.some((entry) => entry.isIntersecting);
      },
      { rootMargin: '96px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  useEffect(() => {
    let changed = false;
    for (const arrival of arrivals) {
      if (arrival.table !== table) continue;
      if (processedRef.current.has(arrival.id)) continue;
      // T10 fix — un UPDATE (écho de sa propre action) ne révèle jamais et ne
      // consomme pas l'id : un INSERT ultérieur du même id peut encore révéler.
      if (!shouldRevealArrival(arrival)) continue;
      processedRef.current.add(arrival.id);
      if (visibleRef.current) {
        liveRef.current.add(arrival.id);
        changed = true;
      }
    }
    if (changed) setLiveIds(new Set(liveRef.current));
  }, [arrivals, table]);

  return { liveIds, containerRef: setElement };
}

export default useLiveArrivalReveal;
