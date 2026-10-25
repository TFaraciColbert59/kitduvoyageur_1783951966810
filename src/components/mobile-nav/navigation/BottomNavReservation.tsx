'use client';

import { useEffect } from 'react';
import { applyBottomNavReservation, bottomNavHeightToken } from './bottom-nav-reservation';

interface BottomNavReservationProps {
  hasUpperExtension: boolean;
  hasDayPlateau: boolean;
}

/**
 * Publie la reservation basse sur la RACINE du document.
 *
 * Defaut reproduit sur /prepare (393x852, etape 3) : le rail de jours
 * recouvrait le CTA "Enregistrer mon aventure". Le jeton n etait publie que
 * par AppShell, sur son propre div, et /prepare rend l ecran directement
 * sous main, hors de ce shell. La feuille du preparateur retombait donc sur
 * son repli de 60 px, soit 48 px de moins que la hauteur du rail.
 *
 * Publier depuis la barre, elle-meme, ferme le trou : la barre est le seul
 * endroit qui sait si le plateau est rendu, et sa publication vaut partout,
 * page encapsulee dans AppShell ou non. Les deux cotes evaluent la meme
 * fonction pure, donc rendu et reservation ne peuvent plus diverger.
 *
 * Le composant ne rend rien : c est un effet de bord de layout, pas du DOM.
 */
export default function BottomNavReservation({
  hasUpperExtension,
  hasDayPlateau,
}: BottomNavReservationProps) {
  useEffect(() => {
    const cleanup = applyBottomNavReservation(
      typeof document === 'undefined' ? null : document.documentElement,
      bottomNavHeightToken({ hasBottomNav: true, hasUpperExtension, hasDayPlateau }),
    );
    return cleanup;
  }, [hasUpperExtension, hasDayPlateau]);

  return null;
}
