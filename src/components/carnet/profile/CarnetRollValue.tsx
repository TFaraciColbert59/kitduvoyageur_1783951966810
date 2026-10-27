'use client';

import React from 'react';

export interface CarnetRollValueProps {
  /** Valeur déjà formatée (`180`, `2 002`, `—`). Jamais recomposée ici. */
  text: string;
  /** Le rouleau ne joue qu'une fois, à l'ouverture du volet. */
  animate?: boolean;
  className?: string;
}

/**
 * Rouleau du chiffre héros : la valeur monte derrière un masque d'une ligne
 * (400 ms), sans dupliquer un seul caractère — le texte lu par un lecteur
 * d'écran et par les tests reste exactement `text`. Un compteur à colonnes de
 * 0 à 9 aurait dupliqué les chiffres dans le DOM ; le masque suffit à la
 * lecture et garde les chiffres tabulaires donc la largeur ne bouge pas.
 */
export function CarnetRollValue({ text, animate = false, className }: CarnetRollValueProps) {
  return (
    <span className={`ckp-roll${animate ? ' is-rolling' : ''}`}>
      <b className={className}>{text}</b>
    </span>
  );
}

export default CarnetRollValue;
