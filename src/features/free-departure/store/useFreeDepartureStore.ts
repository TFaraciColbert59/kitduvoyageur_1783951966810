'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LocationPermission } from '../engine/location';

/** Version du format : changee uniquement a la migration. */
export const FREE_DEPARTURE_VERSION = 1;

export interface FreeDepartureState {
  /**
   * Activite retenue par l'utilisateur, ou `null` pour « detection
   * automatique ». Un choix manuel prime TOUJOURS sur la proposition, meme
   * apres la fin de la session : l'utilisateur reste maitre du type.
   */
  activityId: string | null;
  /** L'utilisateur a-t-il corrige la proposition finale ? */
  confirmed: boolean;
  permission: LocationPermission;
  /** Signaux figes au moment de l'arret, pour la proposition d'activite. */
  finishedAt: number | null;
}

export interface FreeDepartureActions {
  setActivity: (activityId: string | null) => void;
  setPermission: (permission: LocationPermission) => void;
  confirmActivity: (activityId: string) => void;
  markFinished: (at: number) => void;
  reset: () => void;
}

const initial: FreeDepartureState = {
  activityId: null,
  confirmed: false,
  permission: 'inconnue',
  finishedAt: null,
};

export const useFreeDepartureStore = create<FreeDepartureState & FreeDepartureActions>()(
  persist(
    (set) => ({
      ...initial,
      setActivity: (activityId) => set({ activityId, confirmed: activityId !== null }),
      setPermission: (permission) => set({ permission }),
      confirmActivity: (activityId) => set({ activityId, confirmed: true }),
      markFinished: (at) => set({ finishedAt: at }),
      reset: () => set({ ...initial }),
    }),
    {
      name: `lkdv_free_departure_v${FREE_DEPARTURE_VERSION}`,
      version: FREE_DEPARTURE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activityId: state.activityId,
        confirmed: state.confirmed,
        permission: state.permission,
        finishedAt: state.finishedAt,
      }),
    }
  )
);
