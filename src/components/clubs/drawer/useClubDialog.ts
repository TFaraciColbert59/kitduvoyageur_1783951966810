'use client';

import { useEffect, useRef } from 'react';

let scrollLockCount = 0;
let previousBodyOverflow = '';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useClubDialog(active: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const opener =
      typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

    const currentContainer = () => containerRef.current;
    const focusables = () =>
      Array.from(currentContainer()?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (element) =>
          (element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0) &&
          !element.closest('[inert]') &&
          element.tabIndex >= 0,
      );

    const first = focusables()[0];
    (first ?? currentContainer())?.focus?.({ preventScroll: true });

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
      const current = document.activeElement as HTMLElement | null;
      const index = current ? list.indexOf(current) : -1;
      const nextIndex = event.shiftKey
        ? index <= 0
          ? list.length - 1
          : index - 1
        : index === -1 || index === list.length - 1
          ? 0
          : index + 1;
      event.preventDefault();
      list[nextIndex]?.focus?.();
    };

    document.addEventListener('keydown', onKeyDown, true);
    if (scrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('lkdv-dialog-open');
      document.querySelector<HTMLElement>('.lkdv-floating-tabbar')?.setAttribute('inert', '');
    }
    scrollLockCount += 1;

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      scrollLockCount = Math.max(0, scrollLockCount - 1);
      if (scrollLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
        document.body.classList.remove('lkdv-dialog-open');
        document.querySelector<HTMLElement>('.lkdv-floating-tabbar')?.removeAttribute('inert');
      }
      if (opener && typeof opener.focus === 'function' && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [active]);

  return containerRef;
}

export const useCarnetDialog = useClubDialog;
