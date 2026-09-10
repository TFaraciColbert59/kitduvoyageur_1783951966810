'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Backpack,
  CalendarPlus,
  ChevronRight,
  Footprints,
  MapPin,
  Mountain,
  Plus,
  Wallet,
} from 'lucide-react';
import { ConfirmDialog } from '@/features/trips/components/ConfirmDialog';
import {
  compactOrderIndices,
  moveStepBetweenDays,
  recalculateDayMetrics,
  type PlannerStep,
} from '@/features/trips/planner/plannerEngine';
import type { TripFull } from '@/features/trips/types/trip.types';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  addTripStepAction,
  deleteTripStepAction,
  deleteDayAction,
  duplicateDayAction,
  insertDayAction,
  moveStepToDayAction,
  reorderTripStepsAction,
  updateTripStepAction,
} from '@/app/voyages/actions';
import { assignTripItemDayAction } from '@/app/voyages/kit-actions';
import { addTripPoiAction, deleteTripPoiAction, updateTripPoiAction } from '@/app/voyages/poi-actions';
import { hubSectionHref } from '@/features/hub/registry/hubSectionRegistry';
import { formatEuro } from '../../../mobile/mobileHubEngine';
import {
  buildDaySummaries,
  buildRouteCoords,
  dayExpenses,
  formatDurationShort,
  itemsForDay,
  moveStepWithinDay,
  poiMapPoints,
  poisForDay,
  resolveDaysCount,
  sortDayTimeline,
  tripItineraryTotals,
  unassignedPois,
} from '../../../mobile/itineraryEngine';
import { GroupeChipsRow, type GroupeChipDef } from '../groupe/GroupeChipsRow';
import { GroupeRail } from '../groupe/GroupeRail';
import { ItineraryHero } from './ItineraryHero';
import { ItineraryMapSection } from './ItineraryMapSection';
import { ItineraryDayTimeline } from './ItineraryDayTimeline';
import {
  ItineraryDaysDrawer,
  ItineraryItemsDrawer,
  ItineraryMoveDrawer,
  ItineraryPoiDetailDrawer,
  ItineraryPoiFormDrawer,
  ItineraryStepDrawer,
  ItineraryStepFormDrawer,
  POI_CATEGORY_LABELS,
  type ItineraryPoiDetail,
} from './ItineraryDrawers';

export interface ItineraryMobileExperienceProps {
  trip: TripFull;
  initialSteps: PlannerStep[];
}

interface Toast {
  kind: 'success' | 'error';
  message: string;
}

interface PoiRow {
  id: string;
  name: string;
  category: string | null;
  notes: string | null;
  visited: boolean;
  step_id: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface ItemRow {
  id: string;
  item_name: string;
  category: string | null;
  weight_grams: number | null;
  day_number: number | null;
  is_packed: boolean;
}

export function ItineraryMobileExperience({ trip, initialSteps }: ItineraryMobileExperienceProps) {
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();
  const [isPending, startTransition] = useTransition();

  const [steps, setSteps] = useState<PlannerStep[]>(initialSteps);
  useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  const [pois, setPois] = useState<PoiRow[]>((trip.pois ?? []) as PoiRow[]);
  useEffect(() => {
    setPois((trip.pois ?? []) as PoiRow[]);
  }, [trip.pois]);

  const [items, setItems] = useState<ItemRow[]>((trip.items ?? []) as ItemRow[]);
  useEffect(() => {
    setItems((trip.items ?? []) as ItemRow[]);
  }, [trip.items]);

  const canEdit = !!trip.permissions?.canEdit;
  const daysCount = useMemo(
    () => resolveDaysCount(steps, trip.start_date, trip.end_date),
    [steps, trip.start_date, trip.end_date]
  );

  const [selectedDay, setSelectedDay] = useState(1);
  useEffect(() => {
    setSelectedDay((current) => Math.min(current, daysCount));
  }, [daysCount]);

  const [daysOpen, setDaysOpen] = useState(false);
  const [detailStepId, setDetailStepId] = useState<string | null>(null);
  const [moveStepId, setMoveStepId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formStep, setFormStep] = useState<PlannerStep | null>(null);
  const [confirmStep, setConfirmStep] = useState<{ id: string; title: string } | null>(null);
  const [confirmDay, setConfirmDay] = useState<{ day: number; steps: number } | null>(null);

  const [mapPick, setMapPick] = useState<{ lat: number; lon: number } | null>(null);
  const [poiFormOpen, setPoiFormOpen] = useState(false);
  const [poiDetailId, setPoiDetailId] = useState<string | null>(null);
  const [confirmPoi, setConfirmPoi] = useState<{ id: string; name: string } | null>(null);
  const [itemsOpen, setItemsOpen] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapSectionRef = useRef<HTMLDivElement>(null);

  const scrollToMap = () => {
    const node = mapSectionRef.current;
    if (!node) return;
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const notify = (kind: Toast['kind'], message: string) => {
    setToast({ kind, message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), kind === 'error' ? 4200 : 2800);
  };
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const totals = useMemo(() => tripItineraryTotals(steps), [steps]);

  const routeCoords = useMemo(() => buildRouteCoords(steps), [steps]);
  const days = useMemo(
    () => buildDaySummaries(steps, trip.start_date, daysCount),
    [steps, trip.start_date, daysCount]
  );
  const activeSteps = useMemo(
    () =>
      steps
        .filter((step) => step.day_number === selectedDay)
        .sort((a, b) => a.order_index - b.order_index),
    [steps, selectedDay]
  );
  const activeMetrics = useMemo(() => recalculateDayMetrics(activeSteps), [activeSteps]);

  const timelines = useMemo(() => sortDayTimeline(activeSteps), [activeSteps]);
  const durations = useMemo(() => {
    const map: Record<string, number> = {};
    for (const step of activeSteps) {
      map[step.id] = recalculateDayMetrics([step]).estimatedDurationMinutes;
    }
    return map;
  }, [activeSteps]);

  const highlightCoords = useMemo(() => buildRouteCoords(activeSteps), [activeSteps]);
  const dayStepIds = useMemo(() => new Set(activeSteps.map((step) => step.id)), [activeSteps]);
  const dayPois = useMemo(() => {
    const attached = poisForDay(pois, dayStepIds);
    const orphans = unassignedPois(pois);
    return [...attached, ...orphans];
  }, [pois, dayStepIds]);
  const mapPoints = useMemo(() => poiMapPoints(pois), [pois]);
  const expensesView = useMemo(
    () => dayExpenses(trip.expenses ?? [], trip.start_date, selectedDay),
    [trip.expenses, trip.start_date, selectedDay]
  );
  const dayItems = useMemo(() => itemsForDay(items, selectedDay), [items, selectedDay]);

  const detailStep = useMemo(
    () => (detailStepId ? steps.find((step) => step.id === detailStepId) ?? null : null),
    [steps, detailStepId]
  );
  const moveStep = useMemo(
    () => (moveStepId ? steps.find((step) => step.id === moveStepId) ?? null : null),
    [steps, moveStepId]
  );
  const detailIndex = detailStep ? activeSteps.findIndex((step) => step.id === detailStep.id) : -1;
  const poiDetail = useMemo(
    () => (poiDetailId ? pois.find((poi) => poi.id === poiDetailId) ?? null : null),
    [pois, poiDetailId]
  );

  const budgetHref = hubSectionHref({ nature: 'sortie', slug: trip.slug }, 'budget');

  /* ---------------- Actions étapes ---------------- */

  const run = (task: () => Promise<void>, rollback: () => void, errorMessage: string) => {
    startTransition(async () => {
      try {
        await task();
        router.refresh();
      } catch (err) {
        rollback();
        notify('error', err instanceof Error ? err.message : errorMessage);
      }
    });
  };

  const handleMoveWithinDay = (step: PlannerStep, direction: 'up' | 'down') => {
    triggerHaptic('selection');
    const snapshot = steps;
    const updated = moveStepWithinDay(steps, step.id, direction);
    setSteps(updated);
    const daySteps = updated
      .filter((entry) => entry.day_number === step.day_number)
      .sort((a, b) => a.order_index - b.order_index);
    run(
      () =>
        reorderTripStepsAction({
          trip_id: trip.id,
          day_number: step.day_number,
          step_ids_in_order: daySteps.map((entry) => entry.id),
        }).then(() => undefined),
      () => setSteps(snapshot),
      'Erreur lors du réordonnancement.'
    );
  };

  const handleDeleteStep = (step: PlannerStep) => {
    triggerHaptic('medium');
    const snapshot = steps;
    const remaining = steps.filter((entry) => entry.id !== step.id);
    const compacted = compactOrderIndices(remaining.filter((entry) => entry.day_number === step.day_number));
    setSteps([...remaining.filter((entry) => entry.day_number !== step.day_number), ...compacted]);
    setDetailStepId(null);
    run(
      () => deleteTripStepAction(trip.id, step.id).then(() => undefined),
      () => setSteps(snapshot),
      'Erreur lors de la suppression.'
    );
    notify('success', 'Étape supprimée.');
  };

  const handleMoveToDay = (step: PlannerStep, toDay: number) => {
    triggerHaptic('medium');
    const snapshot = steps;
    setSteps(moveStepBetweenDays(steps, step.id, toDay));
    setMoveStepId(null);
    setDetailStepId(null);
    run(
      () =>
        moveStepToDayAction({
          trip_id: trip.id,
          step_id: step.id,
          from_day_number: step.day_number,
          to_day_number: toDay,
        }).then(() => undefined),
      () => setSteps(snapshot),
      'Erreur lors du déplacement.'
    );
  };

  const handleSaveStep = (data: Partial<PlannerStep>) => {
    const day = data.day_number ?? selectedDay;
    if (data.id) {
      const snapshot = steps;
      setSteps((current) =>
        current.map((entry) => (entry.id === data.id ? ({ ...entry, ...data } as PlannerStep) : entry))
      );
      setFormOpen(false);
      run(
        () =>
          updateTripStepAction({
            trip_id: trip.id,
            step_id: data.id as string,
            day_number: day,
            title: data.title,
            description: data.description,
            location_name: data.location_name,
            accommodation_name: data.accommodation_name,
            transport_mode: data.transport_mode,
            start_time: data.start_time ?? null,
            distance_km: data.distance_km,
            elevation_gain_m: data.elevation_gain_m,
            elevation_loss_m: data.elevation_loss_m,
          }).then(() => undefined),
        () => setSteps(snapshot),
        'Erreur lors de la modification.'
      );
      notify('success', 'Étape modifiée.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await addTripStepAction({
          trip_id: trip.id,
          day_number: day,
          title: data.title as string,
          description: data.description,
          location_name: data.location_name,
          accommodation_name: data.accommodation_name,
          transport_mode: (data.transport_mode as never) ?? 'foot',
          start_time: data.start_time ?? null,
          distance_km: data.distance_km,
          elevation_gain_m: data.elevation_gain_m,
          elevation_loss_m: data.elevation_loss_m,
        });
        const orderIndex = steps.filter((entry) => entry.day_number === day).length;
        setSteps((current) => [
          ...current,
          {
            id: res.stepId,
            trip_id: trip.id,
            day_number: day,
            order_index: orderIndex,
            title: data.title as string,
            description: data.description,
            location_name: data.location_name,
            accommodation_name: data.accommodation_name,
            transport_mode: data.transport_mode ?? 'foot',
            start_time: data.start_time ?? null,
            distance_km: data.distance_km,
            elevation_gain_m: data.elevation_gain_m,
            elevation_loss_m: data.elevation_loss_m,
          },
        ]);
        setFormOpen(false);
        setSelectedDay(day);
        router.refresh();
        notify('success', 'Nouvelle étape ajoutée.');
      } catch (err) {
        notify('error', err instanceof Error ? err.message : "Erreur lors de l'ajout.");
      }
    });
  };

  const handleInsertDay = (afterDay: number) => {
    triggerHaptic('medium');
    startTransition(async () => {
      try {
        await insertDayAction({ trip_id: trip.id, after_day_number: afterDay });
        setSelectedDay(afterDay + 1);
        setDaysOpen(false);
        router.refresh();
        notify('success', `Journée insérée après le Jour ${afterDay}.`);
      } catch (err) {
        notify('error', err instanceof Error ? err.message : "Erreur lors de l'insertion.");
      }
    });
  };

  const handleDuplicateDay = (day: number) => {
    triggerHaptic('medium');
    startTransition(async () => {
      try {
        await duplicateDayAction({ trip_id: trip.id, day_number: day });
        setSelectedDay(day + 1);
        setDaysOpen(false);
        router.refresh();
        notify('success', `Jour ${day} dupliqué.`);
      } catch (err) {
        notify('error', err instanceof Error ? err.message : 'Erreur lors de la duplication.');
      }
    });
  };

  const handleDeleteDay = (day: number) => {
    const count = steps.filter((step) => step.day_number === day).length;
    if (count > 0) {
      setConfirmDay({ day, steps: count });
      return;
    }
    executeDeleteDay(day);
  };

  const executeDeleteDay = (day: number) => {
    triggerHaptic('medium');
    setConfirmDay(null);
    startTransition(async () => {
      try {
        await deleteDayAction({ trip_id: trip.id, day_number: day, cascade_steps: true });
        setSelectedDay((current) => Math.max(1, Math.min(current, daysCount - 1)));
        setDaysOpen(false);
        router.refresh();
        notify('success', `Jour ${day} supprimé.`);
      } catch (err) {
        notify('error', err instanceof Error ? err.message : 'Erreur lors de la suppression.');
      }
    });
  };

  /* ---------------- Actions POI ---------------- */

  const handleAddPoi = (data: { name: string; category: string; notes: string | null }) => {
    if (!mapPick) return;
    startTransition(async () => {
      try {
        const res = await addTripPoiAction({
          tripId: trip.id,
          tripSlug: trip.slug,
          name: data.name,
          category: data.category,
          latitude: mapPick.lat,
          longitude: mapPick.lon,
          stepId: activeSteps[0]?.id ?? null,
          notes: data.notes,
        });
        if (!res.success || !res.poiId) {
          notify('error', res.error ?? "Impossible d'ajouter ce point");
          return;
        }
        setPois((current) => [
          ...current,
          {
            id: res.poiId as string,
            name: data.name,
            category: data.category,
            notes: data.notes,
            visited: false,
            step_id: activeSteps[0]?.id ?? null,
            latitude: mapPick.lat,
            longitude: mapPick.lon,
          },
        ]);
        setPoiFormOpen(false);
        setMapPick(null);
        router.refresh();
        notify('success', 'Point d’intérêt ajouté.');
      } catch (err) {
        notify('error', err instanceof Error ? err.message : "Erreur lors de l'ajout du point.");
      }
    });
  };

  const handleTogglePoiVisited = (poi: PoiRow, visited: boolean) => {
    triggerHaptic('selection');
    const snapshot = pois;
    setPois((current) => current.map((entry) => (entry.id === poi.id ? { ...entry, visited } : entry)));
    run(
      () =>
        updateTripPoiAction({
          tripId: trip.id,
          tripSlug: trip.slug,
          poiId: poi.id,
          visited,
        }).then(() => undefined),
      () => setPois(snapshot),
      'Erreur lors de la mise à jour du point.'
    );
  };

  const handleAttachPoiStep = (poi: PoiRow, stepId: string | null) => {
    const snapshot = pois;
    setPois((current) => current.map((entry) => (entry.id === poi.id ? { ...entry, step_id: stepId } : entry)));
    run(
      () =>
        updateTripPoiAction({
          tripId: trip.id,
          tripSlug: trip.slug,
          poiId: poi.id,
          stepId,
        }).then(() => undefined),
      () => setPois(snapshot),
      "Erreur lors du rattachement du point."
    );
  };

  const executePoiDelete = (poi: PoiRow) => {
    triggerHaptic('medium');
    setConfirmPoi(null);
    const snapshot = pois;
    setPois((current) => current.filter((entry) => entry.id !== poi.id));
    setPoiDetailId(null);
    run(
      () =>
        deleteTripPoiAction({ tripId: trip.id, tripSlug: trip.slug, poiId: poi.id }).then(() => undefined),
      () => setPois(snapshot),
      'Erreur lors de la suppression du point.'
    );
  };

  /* ---------------- Matériel du jour ---------------- */

  const handleToggleItemDay = (item: ItemRow, assigned: boolean) => {
    triggerHaptic('selection');
    const snapshot = items;
    const nextDay = assigned ? selectedDay : null;
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, day_number: nextDay } : entry))
    );
    run(
      () => assignTripItemDayAction(item.id, nextDay, trip.slug).then(() => undefined),
      () => setItems(snapshot),
      'Erreur lors du rattachement du matériel.'
    );
  };

  /* ---------------- Dérivés UI ---------------- */

  const daysLeft = useMemo(() => {
    if (!trip.start_date || !trip.end_date) return null;
    const start = new Date(`${trip.start_date}T00:00:00Z`).getTime();
    if (Number.isNaN(start)) return null;
    return Math.ceil((start - Date.now()) / 86400000);
  }, [trip.start_date, trip.end_date]);

  const chips: GroupeChipDef[] = [
    {
      key: 'days',
      icon: CalendarPlus,
      value: String(daysCount),
      label: 'jours',
      onClick: () => setDaysOpen(true),
    },
    {
      key: 'steps',
      icon: Footprints,
      value: String(totals.stepsCount),
      label: 'étapes',
      onClick: () => setDaysOpen(true),
    },
    {
      key: 'distance',
      icon: Mountain,
      value: `${totals.distanceKm} km`,
      label: `+${totals.elevGainM} m`,
      onClick: () => setDaysOpen(true),
    },
    {
      key: 'pois',
      icon: MapPin,
      value: String(pois.length),
      label: 'points d’intérêt',
      tone: pois.length > 0 ? 'accent' : 'default',
      onClick: () => {
        setMapPick(null);
        scrollToMap();
      },
    },
    {
      key: 'expenses',
      icon: Wallet,
      value: formatEuro(expensesView.total),
      label: `${expensesView.count} dépense${expensesView.count > 1 ? 's' : ''}`,
      tone: expensesView.count > 0 ? 'accent' : 'default',
      onClick: () => router.push(`${budgetHref}?jour=${selectedDay}`),
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-1">
      {toast && (
        <div
          role={toast.kind === 'error' ? 'alert' : 'status'}
          className={`glass fixed bottom-24 left-1/2 z-[9000] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl p-3 text-center text-xs font-semibold shadow-lg ${
            toast.kind === 'error' ? 'text-[var(--lkv-danger)]' : 'text-[var(--lkv-primary)]'
          }`}
        >
          {toast.message}
        </div>
      )}

      <ItineraryHero
        title={trip.title}
        daysLeft={daysLeft}
        daysCount={daysCount}
        totals={totals}
        canEdit={canEdit}
        onAddStep={() => {
          setFormStep(null);
          setFormOpen(true);
        }}
        onOpenDays={() => setDaysOpen(true)}
      />

      <GroupeChipsRow chips={chips} />

      <div ref={mapSectionRef} className="scroll-mt-4">
        <ItineraryMapSection
          routeCoords={routeCoords}
          highlightCoords={highlightCoords}
          points={mapPoints}
          pendingPoint={mapPick}
          canEdit={canEdit}
          onMapClick={(lat, lon) => setMapPick({ lat, lon })}
          onConfirmPick={() => setPoiFormOpen(true)}
          onClearPick={() => setMapPick(null)}
        />
      </div>

      {/* ── RAIL JOURNÉES ── */}
      <GroupeRail
        title="Journées"
        subtitle={`Jour ${selectedDay} sur ${daysCount}`}
        actionLabel="Gérer"
        onAction={() => setDaysOpen(true)}
        ariaLabel="Journées de l'itinéraire"
      >
        {days.map((day) => {
          const isActive = day.day === selectedDay;
  return (
            <li key={day.day} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setSelectedDay(day.day);
                }}
                aria-pressed={isActive}
                aria-label={`Jour ${day.day} — ${day.dateLabel ?? ''} · ${day.stepsCount} étapes`}
                className={`flex h-[8.5rem] w-[9rem] flex-col rounded-[1.4rem] p-3 text-left transition-transform active:scale-[0.97] ${
                  isActive ? 'glass border-2 border-[var(--lkv-primary)]/35' : 'glass'
                }`}
              >
                <span
                  className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isActive ? 'bg-[var(--lkv-primary)] text-white' : 'bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]'
                  }`}
                >
                  J{day.day}
                </span>
                <span className="mt-1.5 truncate text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--lkv-text-primary)]">
                  {day.dateLabel ?? 'Jour'}
                </span>
                <span className="mt-1 text-[10.5px] font-medium text-[var(--lkv-text-primary)]/70">
                  {day.stepsCount} étape{day.stepsCount > 1 ? 's' : ''}
                </span>
                <span className="mt-auto text-[10.5px] font-semibold tabular-nums text-[var(--lkv-text-primary)]/75">
                  {day.distanceKm} km · +{day.elevGainM} m
                </span>
              </button>
            </li>
          );
        })}
        {canEdit && (
          <li className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => handleInsertDay(daysCount)}
              disabled={isPending}
              aria-label="Ajouter une journée à la fin"
              className="glass-sub-card flex h-[8.5rem] w-[9rem] flex-col items-center justify-center gap-2 rounded-[1.4rem] border-2 border-dashed border-[var(--lkv-primary)]/30 p-3 disabled:opacity-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]">
                <CalendarPlus size={17} aria-hidden="true" />
              </span>
              <span className="text-[11px] font-bold text-[var(--lkv-text-primary)]">Ajouter un jour</span>
            </button>
          </li>
        )}
      </GroupeRail>

      {/* ── TIMELINE DU JOUR (feuille de route) ── */}
      <section aria-label="Déroulé du jour">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]">
              Déroulé · Jour {selectedDay}
            </p>
            <p className="mt-0.5 text-xs font-medium text-[var(--lkv-text-primary)]/70">
              {timelines.length} étape{timelines.length > 1 ? 's' : ''} · {activeMetrics.totalDistanceKm} km · +
              {activeMetrics.totalElevationGainM} m
              {activeMetrics.estimatedDurationMinutes > 0
                ? ` · ${formatDurationShort(activeMetrics.estimatedDurationMinutes)}`
                : ''}
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setFormStep(null);
                setFormOpen(true);
              }}
              className="glass-capsule-btn min-h-[44px] shrink-0 !px-3 !py-1.5 text-[11px] font-bold"
            >
              <Plus size={13} aria-hidden="true" />
              Étape
            </button>
          )}
        </div>

        <ItineraryDayTimeline
          steps={timelines}
          durations={durations}
          onOpen={(step) => {
            triggerHaptic('selection');
            setDetailStepId(step.id);
          }}
        />
      </section>

      {/* ── RAIL POI ── */}
      <GroupeRail
        title="Points d'intérêt"
        subtitle={`${dayPois.length} sur le parcours · ${pois.length} au total`}
        actionLabel="Carte"
        onAction={() => setMapPick(null)}
        ariaLabel="Points d'intérêt"
      >
        {dayPois.length === 0 ? (
          <li className="shrink-0 snap-start">
            <div className="glass-sub-card flex h-[8.5rem] w-[13rem] flex-col items-start justify-center gap-1 rounded-[1.4rem] p-4">
              <span className="text-sm font-bold text-[var(--lkv-text-primary)]">Aucun point d’intérêt</span>
              <span className="text-xs font-medium text-[var(--lkv-text-primary)]/70">
                Touchez la carte pour en ajouter un.
              </span>
            </div>
          </li>
        ) : (
          dayPois.map((poi) => (
            <li key={poi.id} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setPoiDetailId(poi.id);
                }}
                aria-label={`Point d'intérêt ${poi.name}`}
                className={`glass flex h-[8.5rem] w-[10.5rem] flex-col rounded-[1.4rem] p-3 text-left transition-transform active:scale-[0.97] ${
                  poi.visited ? 'border-2 border-[var(--sage-700)]/30' : ''
                }`}
              >
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--lkv-primary)]/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--lkv-primary)]">
                  <MapPin size={11} aria-hidden="true" />
                  {POI_CATEGORY_LABELS[poi.category ?? 'other'] ?? 'Autre'}
                </span>
                <span className="mt-1.5 line-clamp-2 text-[12.5px] font-bold leading-snug text-[var(--lkv-text-primary)]">
                  {poi.name}
                </span>
                {poi.notes && (
                  <span className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug text-[var(--lkv-text-primary)]/65">
                    {poi.notes}
                  </span>
                )}
                <span className="mt-auto text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--lkv-text-primary)]/60">
                  {poi.visited ? 'Visité' : poi.step_id ? 'Rattaché' : 'Non affecté'}
                </span>
              </button>
            </li>
          ))
        )}
      </GroupeRail>

      {/* ── RAIL DÉPENSES ── */}
      <GroupeRail
        title="Dépenses du jour"
        subtitle={
          expensesView.count > 0
            ? `${formatEuro(expensesView.real)} réel · ${formatEuro(expensesView.planned)} prévu`
            : 'Aucune dépense ce jour'
        }
        actionLabel="Budget"
        onAction={() => router.push(`${budgetHref}?jour=${selectedDay}`)}
        ariaLabel="Dépenses du jour"
      >
        <li className="shrink-0 snap-start">
          <button
            type="button"
            onClick={() => router.push(`${budgetHref}?jour=${selectedDay}`)}
            aria-label={`Ouvrir le budget du jour ${selectedDay}`}
            className={`glass interactive flex h-[8.5rem] w-[10rem] flex-col rounded-[1.4rem] p-3 text-left transition-transform active:scale-[0.97] ${
              expensesView.count > 0 ? 'border-2 border-[var(--lkv-primary)]/30' : ''
            }`}
          >
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--lkv-primary)]/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--lkv-primary)]">
              <Wallet size={11} aria-hidden="true" />
              Total jour
            </span>
            <span className="mt-2 font-display text-lg font-extrabold tabular-nums text-[var(--lkv-text-primary)]">
              {formatEuro(expensesView.total)}
            </span>
            <span className="mt-auto inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--lkv-primary)]">
              Ouvrir le budget
              <ChevronRight size={11} aria-hidden="true" />
            </span>
          </button>
        </li>
        {expensesView.rows.map((expense) => (
          <li key={expense.id} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => router.push(`${budgetHref}?jour=${selectedDay}`)}
              aria-label={`${expense.title ?? 'Dépense'} — ${formatEuro(Number(expense.amount) || 0)}`}
              className="glass interactive flex h-[8.5rem] w-[10rem] flex-col rounded-[1.4rem] p-3 text-left transition-transform active:scale-[0.97]"
            >
              <span
                className={`w-fit rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] ${
                  expense.is_planned
                    ? 'bg-[var(--lkv-warning)]/10 text-[var(--lkv-warning)]'
                    : 'bg-[var(--sage-50)] text-[var(--sage-700)]'
                }`}
              >
                {expense.is_planned ? 'Prévu' : 'Réel'}
              </span>
              <span className="mt-1.5 line-clamp-2 text-[12px] font-bold leading-snug text-[var(--lkv-text-primary)]">
                {expense.title ?? 'Dépense'}
              </span>
              <span className="mt-auto font-display text-base font-extrabold tabular-nums text-[var(--lkv-text-primary)]">
                {formatEuro(Number(expense.amount) || 0)}
              </span>
            </button>
          </li>
        ))}
      </GroupeRail>

      {/* ── RAIL MATÉRIEL ── */}
      <GroupeRail
        title="Matériel du jour"
        subtitle={
          dayItems.length > 0
            ? `${dayItems.length} équipement${dayItems.length > 1 ? 's' : ''} requis`
            : 'Rien de rattaché à ce jour'
        }
        actionLabel="Gérer"
        onAction={() => setItemsOpen(true)}
        ariaLabel="Matériel du jour"
      >
        {dayItems.length === 0 ? (
          <li className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setItemsOpen(true)}
              className="glass-sub-card flex h-[8.5rem] w-[13rem] flex-col items-start justify-center gap-1 rounded-[1.4rem] p-4 text-left"
            >
              <span className="text-sm font-bold text-[var(--lkv-text-primary)]">Matériel à prévoir</span>
              <span className="text-xs font-medium text-[var(--lkv-text-primary)]/70">
                Rattachez le kit nécessaire à cette journée.
              </span>
            </button>
          </li>
        ) : (
          dayItems.map((item) => (
            <li key={item.id} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => setItemsOpen(true)}
                aria-label={`Matériel ${item.item_name}`}
                className="glass flex h-[8.5rem] w-[10rem] flex-col rounded-[1.4rem] p-3 text-left transition-transform active:scale-[0.97]"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]"
                  aria-hidden="true"
                >
                  <Backpack size={15} />
                </span>
                <span className="mt-1.5 line-clamp-2 text-[12px] font-bold leading-snug text-[var(--lkv-text-primary)]">
                  {item.item_name}
                </span>
                <span className="mt-auto text-[10px] font-medium text-[var(--lkv-text-primary)]/65">
                  {item.category ?? 'Divers'}
                  {item.weight_grams ? ` · ${Math.round(item.weight_grams / 10) / 100} kg` : ''}
                  {item.is_packed ? ' · Emballé' : ''}
                </span>
              </button>
            </li>
          ))
        )}
      </GroupeRail>

      {/* ── TIROIRS ── */}
      <ItineraryDaysDrawer
        open={daysOpen}
        onOpenChange={setDaysOpen}
        days={days}
        selectedDay={selectedDay}
        canEdit={canEdit}
        isPending={isPending}
        onSelect={(day) => setSelectedDay(day)}
        onInsertAfter={handleInsertDay}
        onDuplicate={handleDuplicateDay}
        onDelete={handleDeleteDay}
      />

      <ItineraryStepDrawer
        open={detailStep !== null}
        onOpenChange={(open) => !open && setDetailStepId(null)}
        step={detailStep}
        canEdit={canEdit}
        isPending={isPending}
        daysCount={daysCount}
        canMoveUp={detailIndex > 0}
        canMoveDown={detailIndex >= 0 && detailIndex < activeSteps.length - 1}
        onEdit={() => {
          setFormStep(detailStep);
          setFormOpen(true);
          setDetailStepId(null);
        }}
        onMove={() => {
          setMoveStepId(detailStep?.id ?? null);
          setDetailStepId(null);
        }}
        onMoveUp={() => detailStep && handleMoveWithinDay(detailStep, 'up')}
        onMoveDown={() => detailStep && handleMoveWithinDay(detailStep, 'down')}
        onDelete={() => detailStep && setConfirmStep({ id: detailStep.id, title: detailStep.title })}
      />

      <ItineraryStepFormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        step={formStep}
        dayNumber={formStep?.day_number ?? selectedDay}
        isPending={isPending}
        onSubmit={handleSaveStep}
      />

      <ItineraryMoveDrawer
        open={moveStep !== null}
        onOpenChange={(open) => !open && setMoveStepId(null)}
        step={moveStep}
        days={days}
        isPending={isPending}
        onPick={(day) => moveStep && handleMoveToDay(moveStep, day)}
      />

      <ItineraryPoiFormDrawer
        open={poiFormOpen}
        onOpenChange={setPoiFormOpen}
        coords={mapPick}
        isPending={isPending}
        onSubmit={handleAddPoi}
      />

      <ItineraryPoiDetailDrawer
        open={poiDetail !== null}
        onOpenChange={(open) => !open && setPoiDetailId(null)}
        poi={poiDetail as ItineraryPoiDetail | null}
        isPending={isPending}
        daySteps={activeSteps.map((step) => ({ id: step.id, title: step.title }))}
        onToggleVisited={(visited) => poiDetail && handleTogglePoiVisited(poiDetail, visited)}
        onAttachStep={(stepId) => poiDetail && handleAttachPoiStep(poiDetail, stepId)}
        onDelete={() => poiDetail && setConfirmPoi({ id: poiDetail.id, name: poiDetail.name })}
      />

      <ItineraryItemsDrawer
        open={itemsOpen}
        onOpenChange={setItemsOpen}
        items={items}
        day={selectedDay}
        isPending={isPending}
        onToggle={(itemId, assigned) => {
          const item = items.find((entry) => entry.id === itemId);
          if (item) handleToggleItemDay(item, assigned);
        }}
      />

      <ConfirmDialog
        open={confirmStep !== null}
        title="Supprimer cette étape ?"
        message={confirmStep ? `« ${confirmStep.title} » sera définitivement supprimée de l'itinéraire.` : undefined}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onConfirm={() => {
          const target = steps.find((step) => step.id === confirmStep?.id);
          setConfirmStep(null);
          if (target) handleDeleteStep(target);
        }}
        onCancel={() => setConfirmStep(null)}
      />

      <ConfirmDialog
        open={confirmPoi !== null}
        title="Supprimer ce point d'intérêt ?"
        message={confirmPoi ? `« ${confirmPoi.name} » sera retiré de la carte et du roadbook.` : undefined}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onConfirm={() => {
          const target = pois.find((poi) => poi.id === confirmPoi?.id);
          if (target) executePoiDelete(target);
        }}
        onCancel={() => setConfirmPoi(null)}
      />

      <ConfirmDialog
        open={confirmDay !== null}
        title="Supprimer cette journée ?"
        message={
          confirmDay
            ? `Le jour ${confirmDay.day} et ses ${confirmDay.steps} étape(s) seront supprimés, et les jours suivants seront décalés.`
            : undefined
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onConfirm={() => confirmDay && executeDeleteDay(confirmDay.day)}
        onCancel={() => setConfirmDay(null)}
      />
    </div>
  );
}

export default ItineraryMobileExperience;
