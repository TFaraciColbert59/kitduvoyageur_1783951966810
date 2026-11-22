import type { ReactNode } from 'react';

/**
 * Portée des primitives du Compas v5 (`Grp`, `Li`, `Chip`, `PBtn`, `Switch`, îlot…) dans l'itinéraire.
 * Les jetons `--v5-*` et la remise à zéro des boutons vivent sur la classe `.v5` de l'écran du Compas ; l'écran
 * est une grille pleine page, ici `.rcw-v5` (workspace/chrome/chrome.css) la ramène à une simple portée sans
 * boîte (`display: contents`) pour ne prêter que les jetons.
 */
export function V5Scope({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`v5 rcw-v5 ${className}`.trim()}>{children}</div>;
}
