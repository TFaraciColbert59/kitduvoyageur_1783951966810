'use client';

import { useEffect, useState } from 'react';

/**
 * Hauteur réellement masquée par le clavier virtuel (px).
 * iOS Safari ne redimensionne pas le layout viewport : seul visualViewport bouge.
 * Le seuil de 60px évite de réagir à la rétractation de la barre d'URL.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        setInset(overlap > 60 ? Math.round(overlap) : 0);
      });
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}