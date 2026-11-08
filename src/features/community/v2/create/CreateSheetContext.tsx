'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import type { CreateKindV2 } from './engine/createSchemasV2';

/** Résultat minimal d'une création : sert aux actions de l'île (« Voir »). */
export interface CreateSuccessV2 {
  id: string;
  /** Slug de club, pour ouvrir `/clubs/<slug>`. */
  slug?: string;
  /** Nom lisible (club, kit, sortie) pour le sous-titre et le partage. */
  name?: string;
}

export interface CreateDetailRequest {
  node: ReactNode;
  title: string;
  meta?: string;
}

export interface CreateSheetContextValue {
  user: User | null;
  requireAuth: () => void;
  /** La RPC a réussi : l'île s'affiche, l'appelant nettoie ses brouillons. */
  reportCreated: (kind: CreateKindV2, result: CreateSuccessV2) => void;
  /** Sous-tiroir empilé de la coque (`detail`) : sélecteur de produit du Kit. */
  openDetail: (detail: CreateDetailRequest) => void;
  closeDetail: () => void;
  /**
   * Enchaînement interne : fin de Club « Organiser la première sortie »,
   * fin de Kit « Utiliser pour une sortie ». Bascule sur Sortie sans fermer
   * le tiroir ; la page peut aussi le brancher sur ses propres déclencheurs.
   */
  requestCreate: (kind: CreateKindV2, prefill?: Record<string, unknown>) => void;
}

export const CreateSheetContext = createContext<CreateSheetContextValue | null>(null);

export function useCreateSheet(): CreateSheetContextValue {
  const value = useContext(CreateSheetContext);
  if (!value) {
    throw new Error('useCreateSheet doit être utilisé dans <CreateSheetV2>.');
  }
  return value;
}

export { CreateSheetContext as default };
