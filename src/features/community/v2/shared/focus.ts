/**
 * Communauté v2 — restitution du focus après fermeture d'une couche interne
 * (Peek & Pop, détail empilé). FID-081.
 *
 * Pourquoi un module : la coque `CommunitySheetShell` restitue le focus au
 * déclencheur du tiroir avec des reprises `requestAnimationFrame` + timers
 * courts (J-13 : en WebKit le commit de nettoyage `inert` arrive après la
 * frame). Les couches internes doivent suivre la même règle, mais leur
 * déclencheur n'est pas toujours focusable : une tuile est un `<article>` qui
 * porte l'appui long — le focus doit alors aller à son lien/bouton interne.
 */

/** Sélecteur aligné sur celui de la coque (`CommunitySheetShell.focusableWithin`). */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Premier élément focusable visible sous `root`. */
export function firstFocusable(root: ParentNode | null | undefined): HTMLElement | null {
  if (!root) return null;
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
  return nodes.find((node) => node.getClientRects().length > 0) ?? nodes[0] ?? null;
}

/**
 * Cible de focus pour un déclencheur : l'élément lui-même s'il est focusable,
 * sinon son premier descendant focusable (tuile → lien), sinon `null`.
 */
export function resolveFocusTarget(element: HTMLElement | null | undefined): HTMLElement | null {
  if (!element) return null;
  if (typeof document === 'undefined' || !document.contains(element)) return null;
  if (element.matches(FOCUSABLE)) return element;
  return firstFocusable(element);
}

export interface RestoreFocusOptions {
  /** Nombre de reprises après la première frame (WebKit, J-13). Défaut : 4. */
  attempts?: number;
  /** Délai de base entre deux reprises, multiplié par le numéro d'essai. */
  retryDelayMs?: number;
}

/**
 * Rend le focus à `getTarget()` après la frame de commit, puis réessaie si le
 * navigateur n'a pas encore acheté le changement (même stratégie que la coque).
 * `getTarget` est réévalué à chaque essai : la cible peut être un nœud recréé
 * par React entre deux rendus. Renvoie une fonction d'annulation.
 */
export function restoreFocus(
  getTarget: () => HTMLElement | null,
  { attempts = 4, retryDelayMs = 40 }: RestoreFocusOptions = {},
): () => void {
  if (typeof window === 'undefined') return () => {};
  const timers: number[] = [];
  let frame = 0;
  let cancelled = false;

  const attempt = (index: number) => {
    if (cancelled) return;
    const target = getTarget();
    if (!target) return;
    if (document.activeElement === target) return;
    target.focus({ preventScroll: true });
    if (document.activeElement !== target && index < attempts) {
      timers.push(window.setTimeout(() => attempt(index + 1), retryDelayMs * (index + 1)));
    }
  };

  frame = window.requestAnimationFrame(() => attempt(0));

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(frame);
    timers.forEach((timer) => window.clearTimeout(timer));
  };
}
