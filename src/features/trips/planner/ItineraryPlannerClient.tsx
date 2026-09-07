'use client';

import React, { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, CheckCircle2, Map } from 'lucide-react';
import { GlassCapsuleBtn } from '@/components/ui';
import type { TripFull } from '@/features/trips/types/trip.types';
import {
  type PlannerStep,
  reorderStepList,
  moveStepBetweenDays,
  shiftDayNumbers,
  compactOrderIndices,
} from './plannerEngine';
import { getCivilDurationDays } from '@/lib/dates/tripDates';
import { tripSectionHref } from '../registry/tripSectionRegistry';
import { DayNavigator } from './DayNavigator';
import { DayView } from './DayView';
import { StepEditModal } from './StepEditModal';
import { MoveStepModal } from './MoveStepModal';
import {
  addTripStepAction,
  updateTripStepAction,
  deleteTripStepAction,
  reorderTripStepsAction,
  moveStepToDayAction,
  insertDayAction,
  deleteDayAction,
  duplicateDayAction,
} from '@/app/voyages/actions';

export interface ItineraryPlannerClientProps {
  trip: TripFull;
  initialSteps: PlannerStep[];
}

export default function ItineraryPlannerClient({
  trip,
  initialSteps,
}: ItineraryPlannerClientProps) {
  const [steps, setSteps] = useState<PlannerStep[]>(initialSteps);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [editingStep, setEditingStep] = useState<PlannerStep | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDayNumber, setCreateDayNumber] = useState<number>(1);
  const [movingStep, setMovingStep] = useState<PlannerStep | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canEdit = !!trip.permissions?.canEdit;

  // Calcul du nombre de jours total
  const calculatedDaysCount = useMemo(() => {
    let maxDayFromSteps = 1;
    for (const s of steps) {
      if (s.day_number > maxDayFromSteps) {
        maxDayFromSteps = s.day_number;
      }
    }

    let durationDays = 1;
    if (trip.start_date && trip.end_date) {
      durationDays = getCivilDurationDays(trip.start_date, trip.end_date);
    }

    return Math.max(maxDayFromSteps, durationDays, 1);
  }, [steps, trip.start_date, trip.end_date]);

  const [daysCount, setDaysCount] = useState<number>(calculatedDaysCount);

  // Synchronise daysCount si calculatedDaysCount augmente
  React.useEffect(() => {
    if (calculatedDaysCount > daysCount) {
      setDaysCount(calculatedDaysCount);
    }
  }, [calculatedDaysCount, daysCount]);

  function notifySuccess(msg: string) {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  }

  function notifyError(msg: string) {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4000);
  }

  // 1. Monter une étape
  function handleMoveUp(stepId: string) {
    const prevSteps = [...steps];
    const updated = reorderStepList(steps, stepId, 'up');
    setSteps(updated);

    startTransition(async () => {
      try {
        const daySteps = updated
          .filter((s) => s.day_number === selectedDay)
          .sort((a, b) => a.order_index - b.order_index);
        await reorderTripStepsAction({
          trip_id: trip.id,
          day_number: selectedDay,
          step_ids_in_order: daySteps.map((s) => s.id),
        });
      } catch (err: any) {
        setSteps(prevSteps);
        notifyError(err.message || 'Erreur lors du réordonnancement.');
      }
    });
  }

  // 2. Descendre une étape
  function handleMoveDown(stepId: string) {
    const prevSteps = [...steps];
    const updated = reorderStepList(steps, stepId, 'down');
    setSteps(updated);

    startTransition(async () => {
      try {
        const daySteps = updated
          .filter((s) => s.day_number === selectedDay)
          .sort((a, b) => a.order_index - b.order_index);
        await reorderTripStepsAction({
          trip_id: trip.id,
          day_number: selectedDay,
          step_ids_in_order: daySteps.map((s) => s.id),
        });
      } catch (err: any) {
        setSteps(prevSteps);
        notifyError(err.message || 'Erreur lors du réordonnancement.');
      }
    });
  }

  // 3. Supprimer une étape
  function handleDeleteStep(stepId: string) {
    const stepToDelete = steps.find((s) => s.id === stepId);
    if (!stepToDelete) return;

    const prevSteps = [...steps];
    const filtered = steps.filter((s) => s.id !== stepId);
    const dayCompacted = compactOrderIndices(
      filtered.filter((s) => s.day_number === stepToDelete.day_number)
    );
    const finalSteps = [
      ...filtered.filter((s) => s.day_number !== stepToDelete.day_number),
      ...dayCompacted,
    ];
    setSteps(finalSteps);

    startTransition(async () => {
      try {
        await deleteTripStepAction(trip.id, stepId);
        notifySuccess('Étape supprimée.');
      } catch (err: any) {
        setSteps(prevSteps);
        notifyError(err.message || 'Erreur lors de la suppression.');
      }
    });
  }

  // 4. Déplacer une étape vers un autre jour
  async function handleSelectTargetDay(stepId: string, fromDay: number, toDay: number) {
    const prevSteps = [...steps];
    const updated = moveStepBetweenDays(steps, stepId, toDay);
    setSteps(updated);

    startTransition(async () => {
      try {
        await moveStepToDayAction({
          trip_id: trip.id,
          step_id: stepId,
          from_day_number: fromDay,
          to_day_number: toDay,
        });
        notifySuccess(`Étape déplacée vers le Jour ${toDay}.`);
      } catch (err: any) {
        setSteps(prevSteps);
        notifyError(err.message || 'Erreur lors du déplacement.');
      }
    });
  }

  // 5. Enregistrer une étape (création ou modification)
  async function handleSaveStep(stepData: Partial<PlannerStep>) {
    if (stepData.id) {
      // Modification existante
      const prevSteps = [...steps];
      setSteps((curr) =>
        curr.map((s) => (s.id === stepData.id ? ({ ...s, ...stepData } as PlannerStep) : s))
      );

      try {
        await updateTripStepAction({
          trip_id: trip.id,
          step_id: stepData.id,
          ...stepData,
        });
        notifySuccess('Étape modifiée avec succès.');
      } catch (err: any) {
        setSteps(prevSteps);
        notifyError(err.message || 'Erreur lors de la modification.');
      }
    } else {
      // Nouvelle étape
      const day = stepData.day_number || selectedDay;
      const res = await addTripStepAction({
        trip_id: trip.id,
        day_number: day,
        title: stepData.title!,
        description: stepData.description,
        location_name: stepData.location_name,
        latitude: stepData.latitude,
        longitude: stepData.longitude,
        transport_mode: (stepData.transport_mode as any) || 'walking',
        accommodation_name: stepData.accommodation_name,
        distance_km: stepData.distance_km,
        elevation_gain_m: stepData.elevation_gain_m,
        elevation_loss_m: stepData.elevation_loss_m,
      });

      const dayStepsCount = steps.filter((s) => s.day_number === day).length;
      const newStep: PlannerStep = {
        id: res.stepId,
        trip_id: trip.id,
        day_number: day,
        order_index: dayStepsCount,
        title: stepData.title!,
        description: stepData.description,
        location_name: stepData.location_name,
        latitude: stepData.latitude,
        longitude: stepData.longitude,
        transport_mode: stepData.transport_mode,
        accommodation_name: stepData.accommodation_name,
        distance_km: stepData.distance_km,
        elevation_gain_m: stepData.elevation_gain_m,
        elevation_loss_m: stepData.elevation_loss_m,
      };

      setSteps((curr) => [...curr, newStep]);
      notifySuccess('Nouvelle étape ajoutée.');
    }
  }

  // 6. Insérer un jour après un jour donné
  function handleInsertDayAfter(dayNumber: number) {
    const prevSteps = [...steps];
    const prevCount = daysCount;

    const shifted = shiftDayNumbers(steps, dayNumber + 1, 1);
    setSteps(shifted);
    setDaysCount((c) => c + 1);

    startTransition(async () => {
      try {
        await insertDayAction({
          trip_id: trip.id,
          after_day_number: dayNumber,
        });
        setSelectedDay(dayNumber + 1);
        notifySuccess(`Journée insérée après le Jour ${dayNumber}.`);
      } catch (err: any) {
        setSteps(prevSteps);
        setDaysCount(prevCount);
        notifyError(err.message || 'Erreur lors de l’insertion de la journée.');
      }
    });
  }

  // 7. Dupliquer une journée
  function handleDuplicateDay(dayNumber: number) {
    const prevSteps = [...steps];
    const prevCount = daysCount;

    startTransition(async () => {
      try {
        await duplicateDayAction({
          trip_id: trip.id,
          day_number: dayNumber,
        });

        // Recharger localement
        const shifted = shiftDayNumbers(steps, dayNumber + 1, 1);
        const sourceSteps = steps.filter((s) => s.day_number === dayNumber);
        const duplicatedSteps: PlannerStep[] = sourceSteps.map((s, idx) => ({
          ...s,
          id: `dup-${Date.now()}-${idx}`,
          day_number: dayNumber + 1,
          title: `${s.title} (copie)`,
        }));

        setSteps([...shifted, ...duplicatedSteps]);
        setDaysCount((c) => c + 1);
        setSelectedDay(dayNumber + 1);
        notifySuccess(`Jour ${dayNumber} dupliqué avec succès.`);
      } catch (err: any) {
        setSteps(prevSteps);
        setDaysCount(prevCount);
        notifyError(err.message || 'Erreur lors de la duplication.');
      }
    });
  }

  const [dayPendingDeletion, setDayPendingDeletion] = useState<number | null>(null);

  // 8. Exécuter la suppression d'une journée
  function executeDeleteDay(dayNumber: number) {
    const prevSteps = [...steps];
    const prevCount = daysCount;

    // Supprimer et décaler les jours suivants
    const remaining = steps.filter((s) => s.day_number !== dayNumber);
    const shifted = shiftDayNumbers(remaining, dayNumber + 1, -1);

    setSteps(shifted);
    setDaysCount((c) => Math.max(1, c - 1));
    setSelectedDay((d) => Math.max(1, Math.min(d, daysCount - 1)));

    startTransition(async () => {
      try {
        await deleteDayAction({
          trip_id: trip.id,
          day_number: dayNumber,
          cascade_steps: true,
        });
        notifySuccess(`Jour ${dayNumber} supprimé.`);
      } catch (err: any) {
        setSteps(prevSteps);
        setDaysCount(prevCount);
        notifyError(err.message || 'Erreur lors de la suppression.');
      }
    });
  }

  // Demander confirmation ou supprimer directement
  function handleDeleteDay(dayNumber: number) {
    const daySteps = steps.filter((s) => s.day_number === dayNumber);
    if (daySteps.length > 0) {
      setDayPendingDeletion(dayNumber);
      return;
    }
    executeDeleteDay(dayNumber);
  }

  // Étapes de la journée active, triées
  const activeDaySteps = useMemo(() => {
    return steps
      .filter((s) => s.day_number === selectedDay)
      .sort((a, b) => a.order_index - b.order_index);
  }, [steps, selectedDay]);

  return (
    <div className="space-y-4 pb-16">
      {/* Header Navigation Glass */}
      <div className="glass rounded-[var(--lkv-radius-card)] border border-white/60 shadow-sm p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={tripSectionHref(trip.slug, 'overview')}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full glass-sub-card border border-white/60 flex items-center justify-center text-[var(--lkv-text-primary)] hover:bg-white transition-all active:scale-95 cursor-pointer shadow-2xs"
              aria-label="Retour au cockpit du voyage"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-[var(--lkv-text-secondary)]">
                  Planificateur d'Itinéraire
                </span>
                {isPending && (
                  <span className="text-[10px] text-[var(--lkv-text-secondary)] animate-pulse font-mono">
                    Enregistrement...
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--lkv-text-primary)] truncate font-display">
                {trip.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <GlassCapsuleBtn
              href={tripSectionHref(trip.slug, 'overview')}
              size="sm"
              icon={<Map className="w-3.5 h-3.5" />}
            >
              <span className="hidden sm:inline">Cockpit</span>
            </GlassCapsuleBtn>
          </div>
        </div>

        {/* Toasts flottants discrets */}
        {errorMessage && (
          <div className="mt-3 bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)] border border-[var(--lkv-danger)]/20 px-4 py-2 text-xs flex items-center gap-2 rounded-[var(--lkv-radius-md)] animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mt-3 bg-[var(--lkv-success)]/10 text-[var(--lkv-success)] border border-[var(--lkv-success)]/20 px-4 py-2 text-xs flex items-center gap-2 rounded-[var(--lkv-radius-md)] animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Sélecteur horizontal de journées */}
        <div className="mt-3 pt-3 border-t border-white/40">
          <DayNavigator
            daysCount={daysCount}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onAddDay={() => handleInsertDayAfter(daysCount)}
            startDate={trip.start_date}
            steps={steps}
            canEdit={canEdit}
          />
        </div>
      </div>

      {/* Contenu principal */}
      <main className="space-y-4">
        <DayView
          dayNumber={selectedDay}
          startDate={trip.start_date}
          steps={activeDaySteps}
          canEdit={canEdit}
          onAddStep={(day) => {
            setCreateDayNumber(day);
            setEditingStep(null);
            setIsCreateModalOpen(true);
          }}
          onEditStep={(step) => {
            setEditingStep(step);
            setIsCreateModalOpen(true);
          }}
          onDeleteStep={handleDeleteStep}
          onMoveUpStep={handleMoveUp}
          onMoveDownStep={handleMoveDown}
          onMoveToDay={(step) => setMovingStep(step)}
          onInsertDayAfter={handleInsertDayAfter}
          onDuplicateDay={handleDuplicateDay}
          onDeleteDay={handleDeleteDay}
        />
      </main>

      {/* Modals */}
      <StepEditModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingStep(null);
        }}
        onSave={handleSaveStep}
        initialStep={editingStep}
        dayNumber={createDayNumber}
      />

      <MoveStepModal
        isOpen={!!movingStep}
        onClose={() => setMovingStep(null)}
        step={movingStep}
        daysCount={daysCount}
        startDate={trip.start_date}
        steps={steps}
        onSelectTargetDay={handleSelectTargetDay}
      />

      {/* Dialogue accessible de confirmation de suppression */}
      {dayPendingDeletion !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass border border-white/60 rounded-[var(--lkv-radius-card)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-[var(--lkv-danger)]">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-semibold text-base text-[var(--lkv-text-primary)]">
                Supprimer le Jour {dayPendingDeletion} ?
              </h3>
            </div>
            <p className="text-sm text-[var(--lkv-text-muted)] leading-relaxed">
              Cette journée contient {steps.filter((s) => s.day_number === dayPendingDeletion).length} étape(s).
              Confirmez-vous la suppression intégrale de la journée et de ses étapes ?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <GlassCapsuleBtn
                type="button"
                variant="default"
                size="sm"
                onClick={() => setDayPendingDeletion(null)}
              >
                Annuler
              </GlassCapsuleBtn>
              <GlassCapsuleBtn
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  const day = dayPendingDeletion;
                  setDayPendingDeletion(null);
                  if (day !== null) executeDeleteDay(day);
                }}
                className="bg-[var(--lkv-danger)] hover:bg-[var(--lkv-danger)]/90 text-white border-[var(--lkv-danger)]"
              >
                Supprimer définitivement
              </GlassCapsuleBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
