'use client';

import { useCallback } from 'react';
import {
  addTravelerAction,
  deleteMomentAction,
  deleteNightAction,
  deleteStepAction,
  removeTravelerAction,
  saveNightAction,
  saveStepAction,
  saveVerdictAction,
  updateMomentAction,
  updateTravelerAction,
} from './editActions';
import {
  addParticipant,
  applyVerdict,
  removeEtape,
  removeNight,
  removeParticipant,
  updateMomentText,
  upsertEtape,
  upsertNight,
} from './detailEdits';
import type {
  CarnetDetail,
  CarnetEtapeDay,
  CarnetKitVerdictItem,
  CarnetNightItem,
  CarnetParticipant,
} from './types';
import type { TravelerRole } from './editSchemas';

export type EditResult = { ok: true } | { ok: false; error: string };

export interface UseCarnetStructureEditsOptions {
  carnetId: string;
  setDetail: (update: (detail: CarnetDetail) => CarnetDetail) => void;
  /** Lecture à l'instant de l'écriture (pour défaire à partir de l'état précédent). */
  getDetail: () => CarnetDetail;
  onIsland?: (message: string, undo?: () => void, subtitle?: string) => void;
}

const stepInput = (carnetId: string, etape: CarnetEtapeDay) => ({
  carnetId,
  dayNumber: etape.dayNumber,
  from: etape.from ?? '',
  to: etape.to ?? '',
  distanceKm: etape.distanceKm ?? undefined,
  elevationM: etape.elevationM ?? undefined,
  durationText: etape.durationText ?? undefined,
  note: etape.note ?? undefined,
});

const nightInput = (carnetId: string, night: CarnetNightItem) => ({
  carnetId,
  dayNumber: night.dayNumber,
  name: night.name,
  type: night.type,
  altitudeM: night.altitudeM ?? undefined,
  infos: night.infos ?? undefined,
});

const verdictInput = (carnetId: string, itemId: string, v: CarnetKitVerdictItem | null) => ({
  carnetId,
  itemId,
  verdict: v?.verdict ?? null,
  note: v?.verdictNote ?? undefined,
  days: v?.joursUtilises ?? [],
});

/**
 * Écritures du mode modification qui passent par des Server Actions validées
 * par zod : étape, nuit, verdict, voyageur, texte d'un moment. Chaque succès
 * met la fiche à jour et propose d'annuler par l'île (Ctrl/⌘+Z compris).
 */
export function useCarnetStructureEdits({
  carnetId,
  setDetail,
  getDetail,
  onIsland,
}: UseCarnetStructureEditsOptions) {
  // ── Étape ────────────────────────────────────────────────────────────────
  const saveEtape = useCallback(
    async (input: Record<string, unknown>, previous?: CarnetEtapeDay): Promise<EditResult> => {
      const result = await saveStepAction({ ...input, carnetId, id: previous?.id });
      if (!result.ok) return result;
      const etape = result.etape;
      setDetail((d) => upsertEtape(d, etape));
      onIsland?.(
        previous ? 'Étape modifiée' : 'Étape ajoutée',
        () => {
          if (previous) {
            void saveStepAction({ ...stepInput(carnetId, previous), id: previous.id }).then((back) => {
              if (back.ok) setDetail((d) => upsertEtape(d, { ...back.etape, overnight: previous.overnight }));
            });
          } else {
            void deleteStepAction({ carnetId, id: etape.id }).then((gone) => {
              if (gone.ok) setDetail((d) => removeEtape(d, etape.id));
            });
          }
        },
        `${etape.from ?? ''} → ${etape.to ?? ''}`
      );
      return { ok: true };
    },
    [carnetId, onIsland, setDetail]
  );

  const deleteEtape = useCallback(
    async (etape: CarnetEtapeDay): Promise<EditResult> => {
      const result = await deleteStepAction({ carnetId, id: etape.id });
      if (!result.ok) return result;
      setDetail((d) => removeEtape(d, etape.id));
      onIsland?.(
        'Étape supprimée',
        () => {
          void saveStepAction(stepInput(carnetId, etape)).then((back) => {
            if (back.ok) setDetail((d) => upsertEtape(d, { ...back.etape, overnight: etape.overnight }));
          });
        },
        etape.to ?? etape.label
      );
      return { ok: true };
    },
    [carnetId, onIsland, setDetail]
  );

  // ── Nuit ─────────────────────────────────────────────────────────────────
  const saveNight = useCallback(
    async (input: Record<string, unknown>, previous?: CarnetNightItem): Promise<EditResult> => {
      const dayNumber = Number(input.dayNumber);
      const replaced = getDetail().nights?.find((n) => n.dayNumber === dayNumber && n.id !== previous?.id);
      const result = await saveNightAction({ ...input, carnetId, id: previous?.id });
      if (!result.ok) return result;
      const night = result.night;
      setDetail((d) => upsertNight(d, night, previous?.id));
      onIsland?.(
        previous ? 'Nuit modifiée' : 'Nuit ajoutée',
        () => {
          const restore = previous ?? replaced ?? null;
          if (restore) {
            void saveNightAction(nightInput(carnetId, restore)).then((back) => {
              if (back.ok) setDetail((d) => upsertNight(d, back.night, night.id));
            });
          } else {
            void deleteNightAction({ carnetId, dayNumber: night.dayNumber }).then((gone) => {
              if (gone.ok) setDetail((d) => removeNight(d, night.id));
            });
          }
        },
        `${night.name} · J${night.dayNumber}`
      );
      return { ok: true };
    },
    [carnetId, getDetail, onIsland, setDetail]
  );

  const deleteNight = useCallback(
    async (night: CarnetNightItem): Promise<EditResult> => {
      const result = await deleteNightAction({ carnetId, dayNumber: night.dayNumber });
      if (!result.ok) return result;
      setDetail((d) => removeNight(d, night.id));
      onIsland?.(
        'Nuit supprimée',
        () => {
          void saveNightAction(nightInput(carnetId, night)).then((back) => {
            if (back.ok) setDetail((d) => upsertNight(d, back.night));
          });
        },
        `${night.name} · J${night.dayNumber}`
      );
      return { ok: true };
    },
    [carnetId, onIsland, setDetail]
  );

  // ── Verdict ──────────────────────────────────────────────────────────────
  const saveVerdict = useCallback(
    async (input: Record<string, unknown>): Promise<EditResult> => {
      const itemId = String(input.itemId ?? '');
      const previous = getDetail().kitVerdicts?.[itemId] ?? null;
      const result = await saveVerdictAction({ ...input, carnetId });
      if (!result.ok) return result;
      const verdict = result.verdict;
      setDetail((d) => applyVerdict(d, verdict));
      const name = getDetail().kit.items.find((i) => i.id === itemId)?.name;
      onIsland?.(
        verdict.verdict ? 'Verdict enregistré' : 'Verdict retiré',
        () => {
          void saveVerdictAction(verdictInput(carnetId, itemId, previous)).then((back) => {
            if (back.ok) setDetail((d) => applyVerdict(d, back.verdict));
          });
        },
        name
      );
      return { ok: true };
    },
    [carnetId, getDetail, onIsland, setDetail]
  );

  // ── Voyageur ─────────────────────────────────────────────────────────────
  const addTraveler = useCallback(
    async (input: { handle: string; role: TravelerRole }): Promise<EditResult> => {
      const result = await addTravelerAction({ ...input, carnetId });
      if (!result.ok) return result;
      const participant: CarnetParticipant = result.participant;
      setDetail((d) => addParticipant(d, participant));
      onIsland?.(
        'Voyageur ajouté',
        () => {
          void removeTravelerAction({ carnetId, userId: participant.userId }).then((gone) => {
            if (gone.ok) setDetail((d) => removeParticipant(d, participant.userId));
          });
        },
        participant.name ?? participant.handle ?? undefined
      );
      return { ok: true };
    },
    [carnetId, onIsland, setDetail]
  );

  const changeTravelerRole = useCallback(
    async (participant: CarnetParticipant, role: TravelerRole): Promise<EditResult> => {
      const result = await updateTravelerAction({ carnetId, userId: participant.userId, role });
      if (!result.ok) return result;
      onIsland?.('Rôle modifié', undefined, participant.name ?? participant.handle ?? undefined);
      return { ok: true };
    },
    [carnetId, onIsland]
  );

  const removeTraveler = useCallback(
    async (participant: CarnetParticipant, role: TravelerRole = 'contributor'): Promise<EditResult> => {
      const result = await removeTravelerAction({ carnetId, userId: participant.userId });
      if (!result.ok) return result;
      setDetail((d) => removeParticipant(d, participant.userId));
      onIsland?.(
        'Voyageur retiré',
        () => {
          if (!participant.handle) return;
          void addTravelerAction({ carnetId, handle: participant.handle, role }).then((back) => {
            if (back.ok) setDetail((d) => addParticipant(d, back.participant));
          });
        },
        participant.name ?? participant.handle ?? undefined
      );
      return { ok: true };
    },
    [carnetId, onIsland, setDetail]
  );

  // ── Moment ───────────────────────────────────────────────────────────────
  const updateMoment = useCallback(
    async (
      momentId: string,
      patch: { place: string; caption?: string },
      previous: { place: string | null; caption: string | null }
    ): Promise<EditResult> => {
      const result = await updateMomentAction({ carnetId, id: momentId, ...patch });
      if (!result.ok) return result;
      setDetail((d) => updateMomentText(d, momentId, { place: result.place, caption: result.caption }));
      onIsland?.(
        'Moment modifié',
        () => {
          if (!previous.place) return;
          void updateMomentAction({
            carnetId,
            id: momentId,
            place: previous.place,
            caption: previous.caption ?? undefined,
          }).then((back) => {
            if (back.ok) {
              setDetail((d) => updateMomentText(d, momentId, { place: back.place, caption: back.caption }));
            }
          });
        },
        result.place
      );
      return { ok: true };
    },
    [carnetId, onIsland, setDetail]
  );

  const deleteMoment = useCallback(
    async (momentId: string, onRemoved: (momentId: string) => void): Promise<EditResult> => {
      const result = await deleteMomentAction({ carnetId, id: momentId });
      if (!result.ok) return result;
      onRemoved(momentId);
      onIsland?.('Moment supprimé');
      return { ok: true };
    },
    [carnetId, onIsland]
  );

  return {
    saveEtape,
    deleteEtape,
    saveNight,
    deleteNight,
    saveVerdict,
    addTraveler,
    changeTravelerRole,
    removeTraveler,
    updateMoment,
    deleteMoment,
  };
}
