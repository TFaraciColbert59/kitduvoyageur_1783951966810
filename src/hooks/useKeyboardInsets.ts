'use client';

import { useEffect, useState } from 'react';

/**
 * Hook d'évitement du clavier virtuel sur iOS WKWebView et navigateurs mobiles.
 *
 * S'appuie sur l'API window.visualViewport pour calculer la hauteur
 * réelle occupée par le clavier logiciel sans casser le layout 100dvh.
 * Met à jour la variable CSS --keyboard-inset pour les drawers et conteneurs.
 */
export function useKeyboardInsets(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    const vv = window.visualViewport;

    const onViewportChange = () => {
      const offset = Math.max(0, window.innerHeight - vv.height);
      setKeyboardHeight(offset);
      if (offset > 0) {
        document.documentElement.style.setProperty('--keyboard-inset', `${offset}px`);
      } else {
        document.documentElement.style.removeProperty('--keyboard-inset');
      }
    };

    vv.addEventListener('resize', onViewportChange);
    vv.addEventListener('scroll', onViewportChange);

    // Initial check
    onViewportChange();

    return () => {
      vv.removeEventListener('resize', onViewportChange);
      vv.removeEventListener('scroll', onViewportChange);
      document.documentElement.style.removeProperty('--keyboard-inset');
    };
  }, []);

  return keyboardHeight;
}
