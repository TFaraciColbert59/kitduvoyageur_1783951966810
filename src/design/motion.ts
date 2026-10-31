/**
 * Mouvement et gestes de l'app — point d'entrée unique côté TypeScript (hors Hub et Compas).
 *
 * Les VALEURS vivent dans `src/styles/tokens.css` (source de vérité du design system) :
 *   courbes  : --motion-ease-standard (feuilles), --ease-glass (entrées), --ease-spring (rebond),
 *              --lkv-ease (neutre), --motion-ease-accelerate (sorties)
 *   durées   : --dur-fast / --dur-med / --dur-slow, --motion-sheet-duration
 * Ne plus écrire de courbe à la main : utiliser ces jetons (verrou : tests/design/motion-unique.spec.ts).
 * Les seuils de gestes viennent de `@/hooks/gestures` (gestureMath) : un seul réglage.
 */
export const EASE_CSS = {
  /** Feuilles, tiroirs, capsules, lentilles (courbe iOS). */
  sheet: 'var(--motion-ease-standard)',
  /** Entrées, hauteurs, fondus, déplacements. */
  out: 'var(--ease-glass)',
  /** Rebond (pop du cœur, pastilles). */
  spring: 'var(--ease-spring)',
  /** Transitions neutres (couleur, opacité). */
  standard: 'var(--lkv-ease)',
  /** Sorties qui accélèrent. */
  in: 'var(--motion-ease-accelerate)',
} as const;

/** Miroir de `--dur-fast`, `--dur-med`, `--dur-slow` (tokens.css). */
export const DURATION = { fast: 180, base: 280, slow: 420 } as const;

/** Délai avant de démonter une feuille ou un panneau qui se ferme (animation de sortie) : `--dur-med`. */
export const SHEET_EXIT_MS = DURATION.base;

/** Vrai si l'utilisateur demande moins de mouvement : fermeture immédiate. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}
