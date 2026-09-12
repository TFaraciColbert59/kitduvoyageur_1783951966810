'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { AffiliateLink } from '../types/affiliate.types';
import type { ResolvedStepBookingLink } from '../engine/stepBookingLink';

export interface TripAffiliateContextValue {
  /** Liens d'affiliation actifs et pertinents du voyage (hub normal). */
  links: AffiliateLink[];
  /**
   * Lien de réservation résolu par étape (`trip_steps.id`) : le slug est choisi
   * côté serveur (destination avant catégorie), les vues clientes le rendent tel quel.
   */
  bookingByStepId: Record<string, ResolvedStepBookingLink>;
}

const EMPTY_TRIP_AFFILIATE: TripAffiliateContextValue = {
  links: [],
  bookingByStepId: {},
};

const TripAffiliateContext = createContext<TripAffiliateContextValue>(EMPTY_TRIP_AFFILIATE);

export interface TripAffiliateProviderProps {
  value: TripAffiliateContextValue;
  children: ReactNode;
}

/**
 * Diffuse les liens d'affiliation du voyage et les intentions de réservation
 * par étape aux vues clientes de l'itinéraire (timeline mobile, onglet
 * desktop) sans modifier les pages de section. Hors hub, le contexte retombe
 * sur une valeur vide : aucune sortie affiliée n'est rendue.
 */
export function TripAffiliateProvider({ value, children }: TripAffiliateProviderProps) {
  return <TripAffiliateContext.Provider value={value}>{children}</TripAffiliateContext.Provider>;
}

export function useTripAffiliate(): TripAffiliateContextValue {
  return useContext(TripAffiliateContext);
}

export default TripAffiliateProvider;
