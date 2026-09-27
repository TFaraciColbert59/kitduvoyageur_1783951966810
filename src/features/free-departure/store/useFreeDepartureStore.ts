'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LocationPermission } from '../engine/location';
import type { FreeSessionSummary } from '../engine/freeSession';

/**
 * Version du format : changee uniquement a la migration.
 *
 * v2 ajoute la phase et le resume fige. La migration est explicite et non
 * destructive : une session terminee avant la mise a jour reste affichable,
 * elle perd simplement ses mesures — ce qui vaut mieux qu'un ecran « apres »
 * qui afficherait des zeros qu'aucun capteur n'a produits.
 */
export const FREE_DEPARTURE_VERSION = 2;

/**
 * Les trois etats de « Partir librement ».
 *
 * `avant`   — l'explication, avant toute demande de localisation.
 * `pendant` — le suivi en cours : l'ecran le plus simple de l'application.
 * `apres`   — le resume fige, la proposition a confirmer, la vie privee.
 *
 * Une phase et une seule a la fois : c'est ce qui garantit qu'un ecran ne
 * montre jamais simultanement un chrono qui tourne et une demande de
 * confirmation.
 */
export type FreeDeparturePhase = 'avant' | 'pendant' | 'apres';

export interface FreeDepartureState {
  /** Etat courant de la machine a trois etats. */
  phase: FreeDeparturePhase;
  /**
   * Activite retenue par l'utilisateur, ou `null` pour « detection
   * automatique ». Un choix manuel prime TOUJOURS sur la proposition, meme
   * apres la fin de la session : l'utilisateur reste maitre du type.
   */
  activityId: string | null;
  /** L'utilisateur a-t-il tranche — choisi ou corrige ? */
  confirmed: boolean;
  permission: LocationPermission;
  /** Signaux figes au moment de l'arret, pour la proposition d'activite. */
  finishedAt: number | null;
  /**
   * Mesures de la session terminee.
   *
   * `null` ne veut pas dire « session sans mesure » : cela veut dire
   * « session dont on n'a rien garde ». L'ecran 62 sait distinguer les deux
   * et l'explique, plutot que d'afficher des zeros.
   */
  summary: FreeSessionSummary | null;
  /** L'utilisateur conserve-t-il la trace sur son appareil ? */
  keepTrace: boolean;
  /** A-t-il demande le partage de sa position ? `false` = rien ne sort. */
  shareWithGroup: boolean;
  /** Combien de participants pourraient la rejoindre. `0` = sortie individuelle. */
  groupSize: number;
}

export interface FreeDepartureActions {
  setPhase: (phase: FreeDeparturePhase) => void;
  setActivity: (activityId: string | null) => void;
  setPermission: (permission: LocationPermission) => void;
  confirmActivity: (activityId: string) => void;
  /** Fige les mesures de fin. Aboutit toujours a l'ecran 62. */
  markFinished: (summary: FreeSessionSummary) => void;
  setKeepTrace: (keepTrace: boolean) => void;
  setShareWithGroup: (shareWithGroup: boolean) => void;
  setGroupSize: (groupSize: number) => void;
  /** Efface la session et revient a l'ecran d'avant-depart. */
  reset: () => void;
}

const initial: FreeDepartureState = {
  phase: 'avant',
  activityId: null,
  confirmed: false,
  permission: 'inconnue',
  finishedAt: null,
  summary: null,
  keepTrace: true,
  shareWithGroup: false,
  groupSize: 0,
};

/** Un nombre de participants inexploitable vaut 0 : sortie individuelle. */
function sanitizeGroupSize(size: number): number {
  return Number.isFinite(size) && size > 0 ? Math.trunc(size) : 0;
}

/**
 * Mesures d'une session terminee avant la version 2.
 *
 * L'ancien format ne conservait que l'horodatage d'arret : il n'y a donc rien
 * a convertir, et surtout aucune distance a reconstruire de memoire. On pose
 * `summary: null` — l'ecran 62 dira alors qu'aucune mesure n'a ete conservee,
 * ce qui est vrai, plutot que d'affirmer des zéros.
 */
export function migrateToV2(persisted: unknown): FreeDepartureState {
  const before = (persisted ?? {}) as Partial<FreeDepartureState>;
  return {
    ...initial,
    activityId: typeof before.activityId === 'string' ? before.activityId : null,
    confirmed: before.confirmed === true,
    permission: before.permission ?? 'inconnue',
    finishedAt: typeof before.finishedAt === 'number' ? before.finishedAt : null,
    // Le partage repart toujours a zero : une session terminee ne peut pas
    // laisser un partage actif que l'utilisateur aurait oublie, et il n'a
    // aucune raison de savoir qui l'etait. Il le redemandera s'il le veut.
    shareWithGroup: false,
  };
}

export const useFreeDepartureStore = create<FreeDepartureState & FreeDepartureActions>()(
  persist(
    (set) => ({
      ...initial,
      setPhase: (phase) => set({ phase }),
      setActivity: (activityId) => set({ activityId, confirmed: activityId !== null }),
      setPermission: (permission) => set({ permission }),
      confirmActivity: (activityId) => set({ activityId, confirmed: true }),
      markFinished: (summary) =>
        set({
          summary,
          finishedAt: summary.endedAt,
          phase: 'apres',
          // Une session sans un seul point n'a pas de trace a conserver, et
          // encore moins a partager. On le dit dans l'ecran plutot que de
          // laisser une bascule active sur un contenu vide.
          keepTrace: summary.trace.length > 0,
          shareWithGroup: false,
        }),
      setKeepTrace: (keepTrace) =>
        // Couper la conservation coupe le partage dans la meme action : une
        // trace effacee ne peut pas rester envoyee ailleurs.
        set((state) => ({ keepTrace, shareWithGroup: keepTrace ? state.shareWithGroup : false })),
      setShareWithGroup: (shareWithGroup) => set({ shareWithGroup }),
      setGroupSize: (groupSize) => set({ groupSize: sanitizeGroupSize(groupSize) }),
      reset: () => set({ ...initial }),
    }),
    {
      name: `lkdv_free_departure_v${FREE_DEPARTURE_VERSION}`,
      version: FREE_DEPARTURE_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted, version) =>
        version < FREE_DEPARTURE_VERSION
          ? migrateToV2(persisted)
          : (persisted as FreeDepartureState),
      partialize: (state) => ({
        phase: state.phase,
        activityId: state.activityId,
        confirmed: state.confirmed,
        permission: state.permission,
        finishedAt: state.finishedAt,
        summary: state.summary,
        keepTrace: state.keepTrace,
        shareWithGroup: state.shareWithGroup,
        groupSize: state.groupSize,
      }),
    }
  )
);
