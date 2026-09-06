'use client';

import React, { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, CheckCircle2, Map } from 'lucide-react';
import type { TripFull } from '@/features/trips/types/trip.types';
import {
  type PlannerStep,
  reorderStepList,
  moveStepBetweenDays,
  shiftDayNumbers,
  compactOrderIndices,
} from './plannerEngine';
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
      const d1 = new Date(trip.start_date);
      const d2 = new Date(trip.end_date);
      const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24)) + 1;
      if (diff > 0) durationDays = diff;
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

  // 8. Supprimer une journée
  function handleDeleteDay(dayNumber: number) {
    const daySteps = steps.filter((s) => s.day_number === dayNumber);
    if (
      daySteps.length > 0 &&
      !window.confirm(
        `Cette journée contient ${daySteps.length} étape(s). Confirmez-vous la suppression intégrale de la journée et de ses étapes ?`
      )
    ) {
      return;
    }

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

  // Étapes de la journée active, triées
  const activeDaySteps = useMemo(() => {
    return steps
      .filter((s) => s.day_number === selectedDay)
      .sort((a, b) => a.order_index - b.order_index);
  }, [steps, selectedDay]);

  return (
    <div className="min-h-screen pb-16">
      {/* Header Sticky Navigation */}
      <div className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md border-b border-border/40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/voyages/${trip.slug}`}
              className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center hover:bg-forest-900/10 text-text-primary transition-colors active:scale-95"
              aria-label="Retour au cockpit du voyage"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-forest-800 bg-forest-900/10 px-2 py-0.5 rounded-full">
                  Planificateur
                </span>
                {isPending && (
                  <span className="text-[11px] text-text-muted animate-pulse">
                    Enregistrement...
                  </span>
                )}
              </div>
              <h1 className="text-base sm:text-lg font-bold text-text-primary truncate">
                {trip.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/voyages/${trip.slug}`}
              className="px-3.5 py-1.5 rounded-xl border border-border/60 hover:bg-surface-subtle text-xs font-semibold text-text-secondary transition-colors min-h-[36px] flex items-center gap-1.5"
            >
              <Map className="w-4 h-4 text-forest-800" />
              <span className="hidden sm:inline">Cockpit</span>
            </Link>
          </div>
        </div>

        {/* Toasts flottants discrets */}
        {errorMessage && (
          <div className="bg-red-50 text-red-700 border-b border-red-200 px-4 py-2 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="bg-forest-900/10 text-forest-900 border-b border-forest-800/20 px-4 py-2 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-forest-800" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Sélecteur horizontal de journées */}
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

      {/* Contenu principal */}
      <main className="max-w-4xl mx-auto px-4 pt-4 sm:pt-6">
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
    </div>
  );
}
