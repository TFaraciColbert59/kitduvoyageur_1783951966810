'use client';

import { useEffect, useRef } from 'react';

/**
 * Comportement minimal d'un dialogue LKDV (socle §7.2) : focus piégé,
 * Échap, retour du focus au déclencheur, verrou de scroll à compteur.
 *
 * Le compteur est unique au module : deux surfaces imbriquées ne rendent pas
 * le scroll au document tant que la dernière n'est pas fermée (dette D-08).
 */
let scrollLockCount = 0;
let previousBodyOverflow = '';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useCarnetDialog(active: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    const opener = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (element) => element.offsetWidth > 0 || element.offsetHeight > 0
      );

    const first = focusables()[0];
    (first ?? container)?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = list[0];
      const lastItem = list[list.length - 1];
      const current = document.activeElement;
      if (event.shiftKey) {
        if (current === firstItem || !container?.contains(current)) {
          event.preventDefault();
          lastItem.focus();
        }
      } else if (current === lastItem || !container?.contains(current)) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    if (scrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // La barre flottante se retire pendant une feuille (socle §4.6).
      document.body.classList.add('lkdv-dialog-open');
    }
    scrollLockCount += 1;

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      scrollLockCount = Math.max(0, scrollLockCount - 1);
      if (scrollLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
        document.body.classList.remove('lkdv-dialog-open');
      }
      opener?.focus?.({ preventScroll: true });
    };
  }, [active]);

  return containerRef;
}
