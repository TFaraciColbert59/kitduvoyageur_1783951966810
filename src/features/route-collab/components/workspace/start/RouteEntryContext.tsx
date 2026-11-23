'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ItineraryDeepLink } from '../../../insights/deepLinks';
import type { TripEntry } from '../../../entry';
import type { RouteShapeMode } from '../../../types';

/** Objectif lu dans la phrase libre (distance, forme) : affiché, jamais appliqué en silence. */
export interface RouteGoal {
  readonly distanceKm: number | null;
  readonly shape: RouteShapeMode | null;
  readonly placeLabel: string | null;
}

export type TripLinkState = 'none' | 'ok' | 'not_found' | 'error' | 'invalid';

export interface RouteEntryValue {
  readonly trip: TripEntry | null;
  readonly tripLink: TripLinkState;
  readonly deepLink: Omit<ItineraryDeepLink, 'tripId'>;
  readonly authenticated: boolean;
  readonly goal: RouteGoal | null;
  /** Brouillon gardé sur l'appareil (atelier non enregistré en base). */
  readonly localDraft: boolean;
  /** Raison, dite telle quelle, pour laquelle l'enregistrement serveur n'a pas eu lieu (sinon `null`). */
  readonly saveNote: string | null;
}

const DEFAULT: RouteEntryValue = {
  trip: null,
  tripLink: 'none',
  deepLink: {},
  authenticated: true,
  goal: null,
  localDraft: false,
  saveNote: null,
};

const Ctx = createContext<RouteEntryValue>(DEFAULT);

export function RouteEntryProvider({ value, children }: { value: RouteEntryValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Contexte d'entrée de la page (voyage, liens profonds, compte). Sans fournisseur : valeurs neutres. */
export function useRouteEntry(): RouteEntryValue {
  return useContext(Ctx);
}
