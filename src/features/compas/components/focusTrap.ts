import { useLayoutEffect } from 'react';

/* =============================================================================
   Focus des tiroirs (WCAG 2.4.3, 2.1.2) : Tab et Maj+Tab bouclent dans le
   tiroir, et à la fermeture le focus revient à l'élément qui l'avait ouvert.
   ============================================================================= */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Hors du tiroir mais qui doit rester atteignable : le bouton « Annuler » de
 * l'îlot d'annonce (sinon le clavier ne pourrait plus annuler qu'avec Ctrl+Z).
 */
const EXTRA_STOPS = '.cp-island__btn';

function usable(el: HTMLElement): boolean {
  if (el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

/** Arrêts de tabulation, dans l'ordre du document : ceux du tiroir, puis l'îlot. */
export function tabStops(root: HTMLElement): { own: HTMLElement[]; extra: HTMLElement[] } {
  const own = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(usable);
  const extra = Array.from(document.querySelectorAll<HTMLElement>(EXTRA_STOPS)).filter(
    (el) => !root.contains(el) && usable(el)
  );
  return { own, extra };
}

/**
 * Garde Tab dans le tiroir. À brancher sur `keydown` ; ne fait rien d'autre
 * que ramener le focus : le défilement et la saisie gardent leur sens. Entre
 * deux arrêts du tiroir, l'ordre natif du navigateur est conservé.
 */
export function trapTab(e: KeyboardEvent, root: HTMLElement | null): void {
  if (e.key !== 'Tab' || !root || e.defaultPrevented) return;
  const { own, extra } = tabStops(root);
  const stops = [...own, ...extra];
  if (stops.length === 0) {
    e.preventDefault();
    root.focus({ preventScroll: true });
    return;
  }
  const active = document.activeElement as HTMLElement | null;
  const at = active ? stops.indexOf(active) : -1;
  const inside = !!active && (at >= 0 || root.contains(active));
  let target: HTMLElement | null = null;
  if (!inside) target = e.shiftKey ? stops[stops.length - 1] : stops[0];
  else if (e.shiftKey) {
    if (at === 0 || active === root) target = stops[stops.length - 1];
    // Frontière tiroir / îlot : l'ordre du document n'est pas garanti entre les deux.
    else if (at === own.length && own.length > 0) target = own[own.length - 1];
  } else if (at === stops.length - 1) target = stops[0];
  else if (at === own.length - 1 && extra.length > 0) target = extra[0];
  if (!target) return;
  e.preventDefault();
  target.focus({ preventScroll: true });
}

/**
 * Élément d'origine, passé d'un tiroir au suivant quand un tiroir en remplace
 * un autre dans le même rendu (empilement, retour) : seul le dernier tiroir
 * fermé rend le focus.
 */
let carried: HTMLElement | null = null;

/**
 * Mémorise l'élément focalisé à l'ouverture et le refocalise à la fermeture,
 * sauf si la page a déjà posé le focus ailleurs entre-temps ou si l'élément
 * n'existe plus.
 */
export function useFocusReturn(): void {
  useLayoutEffect(() => {
    const active = document.activeElement;
    const origin =
      carried ?? (active instanceof HTMLElement && active !== document.body ? active : null);
    carried = null;
    return () => {
      if (!origin) return;
      carried = origin;
      // Après le rendu en cours : un tiroir qui prend la suite reprend l'origine.
      queueMicrotask(() => {
        if (carried !== origin) return;
        carried = null;
        const now = document.activeElement;
        const lost = !now || now === document.body || now === document.documentElement;
        if (lost && origin.isConnected) origin.focus({ preventScroll: true });
      });
    };
  }, []);
}
