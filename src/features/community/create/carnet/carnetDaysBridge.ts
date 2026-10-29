'use client';

import { createContext, useContext } from 'react';

/**
 * Sélecteur des jours du carnet, publié par le formulaire pour qu'un hôte
 * (la carte-drawer « Créer ») l'affiche dans sa capsule en bas à droite.
 * `active` : 0 = réglages, n = jour n.
 */
export interface CarnetDaySelector {
  count: number;
  active: number;
  select: (index: number) => void;
  addDay: () => void;
}

export type CarnetDaysPublisher = (selector: CarnetDaySelector | null) => void;

export const CarnetDaysBridge = createContext<CarnetDaysPublisher | null>(null);

export function useCarnetDaysBridge(): CarnetDaysPublisher | null {
  return useContext(CarnetDaysBridge);
}
