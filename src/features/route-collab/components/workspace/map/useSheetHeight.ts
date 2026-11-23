'use client';

import { useEffect, useState } from 'react';

/**
 * Hauteur réelle du tiroir (2.8), mesurée sur l'élément plutôt que supposée : elle suit les trois crans, la
 * poignée tirée au doigt et un éventuel changement de gabarit du tiroir. `0` quand le tiroir est fermé.
 * Retardée de 120 ms pour ne pas recadrer la carte à chaque image de l'animation du tiroir.
 */
export function useSheetHeight(container: HTMLElement | null): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (!container || typeof window === 'undefined') return;
    const root = container.closest('.rcw-explorer-root') ?? container.parentElement;
    if (!root) return;
    let timer: number | null = null;
    let observed: Element | null = null;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => schedule()) : null;

    function measure() {
      const sheet = root?.querySelector('.v5-sheet[data-dock]') ?? null;
      if (sheet !== observed) {
        if (observed) ro?.unobserve(observed);
        observed = sheet;
        if (sheet) ro?.observe(sheet);
      }
      const h = sheet ? Math.round(sheet.getBoundingClientRect().height) : 0;
      setHeight((prev) => (prev === h ? prev : h));
    }
    function schedule() {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(measure, 120);
    }

    measure();
    // Le tiroir s'ouvre et se ferme : on guette son apparition dans le conteneur de l'atelier.
    const mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (timer != null) window.clearTimeout(timer);
      mo.disconnect();
      ro?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [container]);
  return height;
}
