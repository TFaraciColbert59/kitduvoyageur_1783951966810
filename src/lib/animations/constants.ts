/**
 * Animation constants for Framer Motion
 * Unified spring configurations and page transitions
 */

/**
 * Miroirs JS des courbes canoniques de `src/styles/tokens.css`.
 * framer-motion ne consomme pas `var(--…)` pour `ease` : ces tuples sont la
 * seule copie autorisée, alignée sur les tokens (`--ease-glass`,
 * `--motion-ease-decelerate`, `--lkv-ease`).
 */
export const EASE_GLASS: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const EASE_DECELERATE: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_STANDARD: [number, number, number, number] = [0.4, 0, 0.2, 1];

export const springConfigs = {
  smooth: { type: "spring" as const, stiffness: 300, damping: 30 },
  snappy: { type: "spring" as const, stiffness: 400, damping: 25 },
  gentle: { type: "spring" as const, stiffness: 200, damping: 35 }
};

export const pageTransitions = {
  slideUp: {
    initial: { y: 30, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -30, opacity: 0 }
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  slideRight: {
    initial: { x: -30, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 30, opacity: 0 }
  }
};
