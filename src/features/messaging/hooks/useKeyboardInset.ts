'use client';

import { useEffect, useState } from 'react';

/**
 * Hauteur réellement masquée par le clavier virtuel (px).
 * iOS Safari ne redimensionne pas le layout viewport : seul visualViewport bouge.
 * Écoute à la fois @capacitor/keyboard et window.visualViewport.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    let unmounted = false;

    // 1. Capacitor Keyboard listener (native iOS)
    let capacitorRemove: (() => void) | null = null;
    import('@capacitor/keyboard')
      .then(({ Keyboard }) => {
        if (unmounted) return;
        const showSub = Keyboard.addListener('keyboardWillShow', (info) => {
          if (!unmounted && info.keyboardHeight > 0) {
            setInset(Math.round(info.keyboardHeight));
          }
        });
        const hideSub = Keyboard.addListener('keyboardWillHide', () => {
          if (!unmounted) {
            setInset(0);
          }
        });
        capacitorRemove = () => {
          showSub.then((s) => s.remove()).catch(() => {});
          hideSub.then((s) => s.remove()).catch(() => {});
        };
      })
      .catch(() => {});

    // 2. VisualViewport fallback / web listener
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    let raf = 0;
    const update = () => {
      if (!vv) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        if (overlap > 60) {
          setInset(Math.round(overlap));
        } else if (overlap <= 10) {
          setInset(0);
        }
      });
    };

    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      update();
    }

    return () => {
      unmounted = true;
      if (capacitorRemove) capacitorRemove();
      if (vv) {
        cancelAnimationFrame(raf);
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
    };
  }, []);

  return inset;
}
