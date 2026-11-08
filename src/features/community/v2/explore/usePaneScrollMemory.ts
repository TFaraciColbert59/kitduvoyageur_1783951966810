'use client';

import { useEffect, useRef } from 'react';
import { readSessionMemory, writeSessionMemory } from '../shared/useSessionMemory';

/**
 * Mémoire de défilement d'un volet.
 *
 * La coque est la seule propriétaire du scroller (`.lkdv-cv2-pane`) : le volet
 * se contente de retrouver son ancêtre scrollable et d'y restaurer/écrire la
 * position. Écriture au plus une fois toutes les 200 ms, plus une à l'arrêt.
 */
export function usePaneScrollMemory<T extends HTMLElement = HTMLDivElement>(
  key: string,
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const scroller = node.closest<HTMLElement>('.lkdv-cv2-pane');
    if (!scroller) return;
    const saved = readSessionMemory<number>(`${key}:scroll`, 0);
    if (saved > 0) scroller.scrollTop = saved;
    let timeout: number | null = null;
    const onScroll = () => {
      if (timeout != null) return;
      timeout = window.setTimeout(() => {
        timeout = null;
        writeSessionMemory(`${key}:scroll`, scroller.scrollTop);
      }, 200);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (timeout != null) window.clearTimeout(timeout);
      writeSessionMemory(`${key}:scroll`, scroller.scrollTop);
    };
  }, [key]);

  return ref;
}

export default usePaneScrollMemory;

/**
 * Chargement à l'approche du bas : écoute le scroller de la coque
 * (`.lkdv-cv2-pane`, ancêtre du volet) et appelle `onNearBottom` à 140 px du
 * bas. Ne s'active que si `enabled` (pages suivantes disponibles, pas d'envoi
 * en cours).
 */
export function usePaneNearBottom<T extends HTMLElement = HTMLDivElement>(
  enabled: boolean,
  onNearBottom: () => void,
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const callbackRef = useRef(onNearBottom);
  callbackRef.current = onNearBottom;

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    const scroller = node.closest<HTMLElement>('.lkdv-cv2-pane');
    if (!scroller) return;
    const onScroll = () => {
      if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > 140) return;
      callbackRef.current();
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [enabled]);

  return ref;
}
