import type { CSSProperties } from 'react';

/**
 * Marqueur d'état « non coché » dessiné en CSS (anneau, couleur du texte courant).
 * Ce n'est pas un pictogramme : la base LKDV V2 n'a pas de cercle vide, et on n'en emprunte pas ailleurs.
 */
export function EmptyCircle({ size, className = '', style }: { size?: number | string; className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full border-2 border-current ${className}`}
      style={{ width: size, height: size, ...style }}
    />
  );
}
