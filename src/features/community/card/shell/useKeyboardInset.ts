'use client';

import { useEffect, useState } from 'react';

const KEYBOARD_MIN_PX = 80;

/**
 * Hauteur occupée par le clavier logiciel (0 si fermé ou si l'API manque).
 * iOS ne redimensionne pas le viewport de mise en page : seule
 * `visualViewport` voit le clavier.
 */
export function keyboardInsetFrom(innerHeight: number, viewportHeight: number, offsetTop: number): number {
  const inset = innerHeight - viewportHeight - offsetTop;
  return inset > KEYBOARD_MIN_PX ? Math.round(inset) : 0;
}

export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active || typeof window === 'undefined' || !window.visualViewport) {
      setInset(0);
      return;
    }
    const viewport = window.visualViewport;
    const update = () => setInset(keyboardInsetFrom(window.innerHeight, viewport.height, viewport.offsetTop));
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [active]);

  return inset;
}
