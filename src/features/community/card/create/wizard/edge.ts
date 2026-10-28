'use client';

import { createContext, useContext } from 'react';

/**
 * Passage de relais quand un glissement atteint le bord d'un parcours en étapes :
 * glisser vers la droite sur la première étape ouvre l'onglet précédent, glisser
 * vers la gauche sur la dernière ouvre le suivant. Renvoie `false` s'il n'y a rien
 * de l'autre côté (le cadre joue alors son rebond).
 */
export type WizardEdgeHandler = (direction: 'prev' | 'next') => boolean;

export const WizardEdgeContext = createContext<WizardEdgeHandler | null>(null);

export function useWizardEdge(): WizardEdgeHandler | null {
  return useContext(WizardEdgeContext);
}
