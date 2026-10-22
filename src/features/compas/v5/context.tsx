'use client';

import { createContext, useContext } from 'react';
import type { Locale } from '@/lib/i18n/locale';
import type { CompasData } from '../server/getCompasData';
import type { CompasCtl, CompasT } from '../components/compasTypes';
import type { V5Extras, V5Space } from './types';

/**
 * Ce que chaque tiroir v5 reçoit : les données réelles du voyage, ce que le serveur y ajoute (nuits possibles,
 * photos, trajets), le contrôleur partagé (écritures annonçables et annulables) et la navigation entre tiroirs.
 */
export interface V5Api {
  data: CompasData;
  extras: V5Extras;
  /** Contrôleur partagé avec l'écran actuel : `run` écrit, annonce et propose « Annuler ». */
  ctl: CompasCtl;
  t: CompasT;
  locale: Locale;
  canEdit: boolean;
  /** Un seul voyageur (ou taille non renseignée) : le Compas parle de « toi ». */
  solo: boolean;
  /** Nombre de personnes du voyage (au moins 1). */
  people: number;
  /** Tiroir ouvert, son onglet et son jour. */
  space: V5Space | null;
  tab: number;
  day: number;
  openSpace: (space: V5Space, opts?: { tab?: number; day?: number }) => void;
  closeSpace: () => void;
  setTab: (tab: number) => void;
  /** Annonce dans l'îlot, sans écriture. */
  announce: (message: string, sub?: string, tone?: 'bad') => void;
}

export const V5Context = createContext<V5Api | null>(null);

export function useV5(): V5Api {
  const api = useContext(V5Context);
  if (!api) throw new Error('useV5 : à utiliser dans <CompasV5Screen>');
  return api;
}

export type { Locale, CompasT };
