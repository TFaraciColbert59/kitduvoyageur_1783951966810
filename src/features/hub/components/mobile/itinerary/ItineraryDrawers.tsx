'use client';

import type { FormEvent } from 'react';
import {
  ArrowRightLeft,
  Backpack,
  Bike,
  Bus,
  CalendarPlus,
  Car,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Footprints,
  Link2,
  MapPin,
  Mountain,
  Pencil,
  Plane,
  Ship,
  Train,
  Trash2,
} from 'lucide-react';
import type { PlannerStep } from '@/features/trips/planner/plannerEngine';
import { recalculateDayMetrics } from '@/features/trips/planner/plannerEngine';
import {
  formatDurationShort,
  formatStepTime,
  transportLabel,
  type DaySummary,
} from '../../../mobile/itineraryEngine';
import { GroupeDrawer } from '../groupe/GroupeDrawer';

export const POI_CATEGORY_LABELS: Record<string, string> = {
  water: 'Point d’eau',
  refuge: 'Refuge / hébergement',
  summit: 'Sommet',
  viewpoint: 'Point de vue',
  camp: 'Bivouac / camping',
  pass: 'Col',
  food: 'Restauration',
  other: 'Autre',
};

function TransportIcon({ mode }: { mode: string | null | undefined }) {
  const className = 'text-[var(--lkv-primary)]';
  switch (mode) {
    case 'plane':
    case 'flight':
      return <Plane size={15} className={className} aria-hidden="true" />;
    case 'train':
      return <Train size={15} className={className} aria-hidden="true" />;
    case 'car':
      return <Car size={15} className={className} aria-hidden="true" />;
    case 'bus':
      return <Bus size={15} className={className} aria-hidden="true" />;
    case 'boat':
      return <Ship size={15} className={className} aria-hidden="true" />;
    case 'bike':
      return <Bike size={15} className={className} aria-hidden="true" />;
    case 'hiking':
      return <Mountain size={15} className={className} aria-hidden="true" />;
    default:
      return <Footprints size={15} className={className} aria-hidden="true" />;
  }
}

/* ─────────────── Jours ─────────────── */

export interface ItineraryDaysDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: DaySummary[];
  selectedDay: number;
  canEdit: boolean;
  isPending: boolean;
  onSelect: (day: number) => void;
  onInsertAfter: (day: number) => void;
  onDuplicate: (day: number) => void;
  onDelete: (day: number) => void;
}

export function ItineraryDaysDrawer({
  open,
  onOpenChange,
  days,
  selectedDay,
  canEdit,
  isPending,
  onSelect,
  onInsertAfter,
  onDuplicate,
  onDelete,
}: ItineraryDaysDrawerProps) {
  return (
    <GroupeDrawer open={open} onOpenChange={onOpenChange} title="Jours de l'itinéraire" width={470}>
      <ul className="space-y-2">
        {days.map((day) => {
          const isActive = day.day === selectedDay;
          return (
            <li
              key={day.day}
              className={`glass-sub-card rounded-2xl p-3 ${isActive ? 'border-2 border-[var(--lkv-primary)]/35' : ''}`}
            >
              <button
                type="button"
                onClick={() => onSelect(day.day)}
                aria-pressed={isActive}
                className="flex min-h-[44px] w-full items-center gap-3 text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 font-display text-sm font-extrabold text-[var(--lkv-primary)]">
                  J{day.day}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-[var(--lkv-text-primary)]">
                    {day.dateLabel ?? `Jour ${day.day}`}
                  </span>
                  <span className="block text-[10.5px] font-medium text-[var(--lkv-text-primary)]/65">
                    {day.stepsCount} étape{day.stepsCount > 1 ? 's' : ''} · {day.distanceKm} km · +{day.elevGainM} m
                  </span>
                </span>
                {isActive && (
                  <span className="shrink-0 rounded-full bg-[var(--lkv-primary)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white">
                    Actif
                  </span>
                )}
              </button>

              {canEdit && (
                <div className="mt-2.5 flex items-center gap-2 border-t border-black/5 pt-2.5">
                  <button
                    type="button"
                    onClick={() => onInsertAfter(day.day)}
                    disabled={isPending}
                    aria-label={`Insérer une journée après le jour ${day.day}`}
                    className="glass-capsule-btn inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 !py-2 text-[10.5px] font-bold disabled:opacity-50"
                  >
                    <CalendarPlus size={13} aria-hidden="true" />
                    Insérer
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicate(day.day)}
                    disabled={isPending}
                    aria-label={`Dupliquer le jour ${day.day}`}
                    className="glass-capsule-btn inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 !py-2 text-[10.5px] font-bold disabled:opacity-50"
                  >
                    <Copy size={13} aria-hidden="true" />
                    Dupliquer
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(day.day)}
                    disabled={isPending || days.length <= 1}
                    aria-label={`Supprimer le jour ${day.day}`}
                    className="glass-sub-card inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--lkv-danger)] disabled:opacity-40"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </GroupeDrawer>
  );
}

/* ─────────────── Détail d'étape ─────────────── */

export interface ItineraryStepDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: PlannerStep | null;
  canEdit: boolean;
  isPending: boolean;
  daysCount: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: () => void;
  onMove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function ItineraryStepDrawer({
  open,
  onOpenChange,
  step,
  canEdit,
  isPending,
  daysCount,
  canMoveUp,
  canMoveDown,
  onEdit,
  onMove,
  onMoveUp,
  onMoveDown,
  onDelete,
}: ItineraryStepDrawerProps) {
  const metrics = step ? recalculateDayMetrics([step]) : null;

  return (
    <GroupeDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={step?.title ?? 'Étape'}
      width={460}
    >
      {step && (
        <div className="space-y-4">
          <div className="glass-sub-card space-y-2 rounded-2xl p-3.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lkv-primary)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--lkv-primary)]">
              <TransportIcon mode={step.transport_mode} />
              {transportLabel(step.transport_mode)}
              {formatStepTime(step.start_time) && <span>· {formatStepTime(step.start_time)}</span>}
            </span>
            {step.location_name && (
              <p className="text-[12.5px] font-bold text-[var(--lkv-text-primary)]">{step.location_name}</p>
            )}
            <ul className="grid grid-cols-3 gap-2">
              <li className="glass-sub-card rounded-xl p-2 text-center">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--lkv-text-primary)]/60">
                  Distance
                </p>
                <p className="mt-0.5 text-[12.5px] font-bold tabular-nums text-[var(--lkv-text-primary)]">
                  {step.distance_km != null ? `${step.distance_km} km` : '—'}
                </p>
              </li>
              <li className="glass-sub-card rounded-xl p-2 text-center">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--lkv-text-primary)]/60">
                  D+
                </p>
                <p className="mt-0.5 text-[12.5px] font-bold tabular-nums text-[var(--lkv-text-primary)]">
                  {step.elevation_gain_m != null ? `${step.elevation_gain_m} m` : '—'}
                </p>
              </li>
              <li className="glass-sub-card rounded-xl p-2 text-center">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--lkv-text-primary)]/60">
                  Durée
                </p>
                <p className="mt-0.5 text-[12.5px] font-bold tabular-nums text-[var(--lkv-text-primary)]">
                  {metrics && metrics.estimatedDurationMinutes > 0
                    ? formatDurationShort(metrics.estimatedDurationMinutes)
                    : '—'}
                </p>
              </li>
            </ul>
            {step.accommodation_name && (
              <p className="text-[11.5px] font-medium text-[var(--lkv-text-primary)]/70">
                Nuit · {step.accommodation_name}
              </p>
            )}
            {step.description && (
              <p className="text-[11.5px] font-medium leading-snug text-[var(--lkv-text-primary)]/70">
                {step.description}
              </p>
            )}
          </div>

          {canEdit && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={onEdit}
                className="glass-capsule-btn primary inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 !py-3 text-sm font-bold"
              >
                <Pencil size={15} aria-hidden="true" />
                Modifier l&apos;étape
              </button>
              {daysCount > 1 && (
                <button
                  type="button"
                  onClick={onMove}
                  className="glass-capsule-btn inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 !py-3 text-sm font-bold"
                >
                  <ArrowRightLeft size={15} aria-hidden="true" />
                  Déplacer vers un autre jour
                </button>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onMoveUp}
                  disabled={isPending || !canMoveUp}
                  aria-label="Monter l'étape"
                  className="glass-capsule-btn inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 !py-3 text-sm font-bold disabled:opacity-50"
                >
                  <ChevronUp size={15} aria-hidden="true" />
                  Monter
                </button>
                <button
                  type="button"
                  onClick={onMoveDown}
                  disabled={isPending || !canMoveDown}
                  aria-label="Descendre l'étape"
                  className="glass-capsule-btn inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 !py-3 text-sm font-bold disabled:opacity-50"
                >
                  <ChevronDown size={15} aria-hidden="true" />
                  Descendre
                </button>
              </div>
              <button
                type="button"
                onClick={onDelete}
                className="glass-capsule-btn inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 !py-3 text-sm font-bold text-[var(--lkv-danger)]"
              >
                <Trash2 size={15} aria-hidden="true" />
                Supprimer l&apos;étape
              </button>
            </div>
          )}
        </div>
      )}
    </GroupeDrawer>
  );
}

/* ─────────────── Formulaire étape (création / édition) ─────────────── */

export interface ItineraryStepFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: PlannerStep | null;
  dayNumber: number;
  isPending: boolean;
  onSubmit: (data: Partial<PlannerStep>) => void;
}

export function ItineraryStepFormDrawer({
  open,
  onOpenChange,
  step,
  dayNumber,
  isPending,
  onSubmit,
}: ItineraryStepFormDrawerProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = (key: string) => {
      const value = formData.get(key)?.toString().trim();
      return value ? value : null;
    };
    const num = (key: string) => {
      const raw = formData.get(key)?.toString().trim();
      if (!raw) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    };

    onSubmit({
      id: step?.id,
      day_number: dayNumber,
      title: text('title') ?? step?.title ?? '',
      transport_mode: text('transport_mode') ?? 'foot',
      start_time: text('start_time'),
      location_name: text('location_name'),
      accommodation_name: text('accommodation_name'),
      distance_km: num('distance_km'),
      elevation_gain_m: num('elevation_gain_m') != null ? Math.round(num('elevation_gain_m') as number) : null,
      elevation_loss_m: num('elevation_loss_m') != null ? Math.round(num('elevation_loss_m') as number) : null,
      description: text('description'),
    });
  };

  return (
    <GroupeDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={step ? 'Modifier l’étape' : `Nouvelle étape · Jour ${dayNumber}`}
      width={460}
    >
      <form onSubmit={submit} className="space-y-3">
        <input
          type="text"
          name="title"
          required
          defaultValue={step?.title ?? ''}
          placeholder="Titre de l'étape"
          aria-label="Titre de l'étape"
          className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="time"
            name="start_time"
            defaultValue={step?.start_time ? step.start_time.slice(0, 5) : ''}
            aria-label="Heure de passage"
            className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
          />
          <select
            name="transport_mode"
            defaultValue={step?.transport_mode ?? 'foot'}
            aria-label="Mode de transport"
            className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
          >
            <option value="foot">À pied</option>
            <option value="hiking">Rando</option>
            <option value="car">Voiture</option>
            <option value="bus">Bus</option>
            <option value="train">Train</option>
            <option value="plane">Vol</option>
            <option value="boat">Bateau</option>
            <option value="bike">Vélo</option>
            <option value="other">Autre</option>
          </select>
        </div>
        <input
          type="text"
          name="location_name"
          defaultValue={step?.location_name ?? ''}
          placeholder="Lieu"
          aria-label="Lieu de l'étape"
          className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
        />
        <input
          type="text"
          name="accommodation_name"
          defaultValue={step?.accommodation_name ?? ''}
          placeholder="Nuit / hébergement"
          aria-label="Hébergement de l'étape"
          className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            name="distance_km"
            min="0"
            max="2000"
            step="0.1"
            defaultValue={step?.distance_km ?? ''}
            placeholder="km"
            aria-label="Distance en kilomètres"
            className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
          />
          <input
            type="number"
            name="elevation_gain_m"
            min="0"
            max="9000"
            step="1"
            defaultValue={step?.elevation_gain_m ?? ''}
            placeholder="D+ m"
            aria-label="Dénivelé positif en mètres"
            className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
          />
          <input
            type="number"
            name="elevation_loss_m"
            min="0"
            max="9000"
            step="1"
            defaultValue={step?.elevation_loss_m ?? ''}
            placeholder="D− m"
            aria-label="Dénivelé négatif en mètres"
            className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
          />
        </div>
        <textarea
          name="description"
          rows={3}
          defaultValue={step?.description ?? ''}
          placeholder="Description, points de vigilance…"
          aria-label="Description de l'étape"
          className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)]"
        />
        <button
          type="submit"
          disabled={isPending}
          className="glass-capsule-btn primary inline-flex min-h-[44px] w-full items-center justify-center !py-3 text-sm font-bold disabled:opacity-50"
        >
          {isPending ? 'Enregistrement…' : step ? 'Enregistrer les modifications' : "Ajouter l'étape"}
        </button>
      </form>
    </GroupeDrawer>
  );
}

/* ─────────────── Déplacement vers un jour ─────────────── */

export interface ItineraryMoveDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: PlannerStep | null;
  days: DaySummary[];
  isPending: boolean;
  onPick: (day: number) => void;
}

export function ItineraryMoveDrawer({
  open,
  onOpenChange,
  step,
  days,
  isPending,
  onPick,
}: ItineraryMoveDrawerProps) {
  const targets = days.filter((day) => day.day !== step?.day_number);
  return (
    <GroupeDrawer open={open} onOpenChange={onOpenChange} title="Déplacer l'étape" width={430}>
      <ul className="space-y-2">
        {targets.map((day) => (
          <li key={day.day}>
            <button
              type="button"
              onClick={() => onPick(day.day)}
              disabled={isPending}
              className="glass-sub-card flex min-h-[48px] w-full items-center gap-3 rounded-2xl p-3 text-left disabled:opacity-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 text-[12px] font-extrabold text-[var(--lkv-primary)]">
                J{day.day}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-bold text-[var(--lkv-text-primary)]">
                  {day.dateLabel ?? `Jour ${day.day}`}
                </span>
                <span className="block text-[10.5px] font-medium text-[var(--lkv-text-primary)]/65">
                  {day.stepsCount} étape{day.stepsCount > 1 ? 's' : ''} · {day.distanceKm} km
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </GroupeDrawer>
  );
}

/* ─────────────── POI : création ─────────────── */

export interface ItineraryPoiFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coords: { lat: number; lon: number } | null;
  isPending: boolean;
  onSubmit: (data: { name: string; category: string; notes: string | null }) => void;
}

export function ItineraryPoiFormDrawer({
  open,
  onOpenChange,
  coords,
  isPending,
  onSubmit,
}: ItineraryPoiFormDrawerProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get('name')?.toString().trim();
    if (!name) return;
    const notes = formData.get('notes')?.toString().trim();
    onSubmit({
      name,
      category: formData.get('category')?.toString() || 'other',
      notes: notes ? notes : null,
    });
  };

  return (
    <GroupeDrawer open={open} onOpenChange={onOpenChange} title="Nouveau point d'intérêt" width={440}>
      <form onSubmit={submit} className="space-y-3">
        {coords && (
          <p className="flex items-center gap-1.5 rounded-xl bg-[var(--lkv-primary)]/10 px-3 py-2 text-[11px] font-semibold tabular-nums text-[var(--lkv-primary)]">
            <MapPin size={13} aria-hidden="true" />
            {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
          </p>
        )}
        <input
          type="text"
          name="name"
          required
          placeholder="Nom du point (ex: Source du berger)"
          aria-label="Nom du point d'intérêt"
          className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
        />
        <select
          name="category"
          defaultValue="water"
          aria-label="Catégorie du point d'intérêt"
          className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
        >
          {Object.entries(POI_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <textarea
          name="notes"
          rows={3}
          placeholder="Notes (eau potable, horaires, prix…)"
          aria-label="Notes du point d'intérêt"
          className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)]"
        />
        <button
          type="submit"
          disabled={isPending || !coords}
          className="glass-capsule-btn primary inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 !py-3 text-sm font-bold disabled:opacity-50"
        >
          <MapPin size={15} aria-hidden="true" />
          {isPending ? 'Enregistrement…' : 'Ajouter le point'}
        </button>
      </form>
    </GroupeDrawer>
  );
}

/* ─────────────── POI : détail ─────────────── */

export interface ItineraryPoiDetail {
  id: string;
  name: string;
  category: string | null;
  notes: string | null;
  visited: boolean;
  step_id: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ItineraryPoiDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poi: ItineraryPoiDetail | null;
  isPending: boolean;
  daySteps: Array<{ id: string; title: string }>;
  onToggleVisited: (visited: boolean) => void;
  onAttachStep: (stepId: string | null) => void;
  onDelete: () => void;
}

export function ItineraryPoiDetailDrawer({
  open,
  onOpenChange,
  poi,
  isPending,
  daySteps,
  onToggleVisited,
  onAttachStep,
  onDelete,
}: ItineraryPoiDetailDrawerProps) {
  return (
    <GroupeDrawer open={open} onOpenChange={onOpenChange} title={poi?.name ?? 'Point d’intérêt'} width={450}>
      {poi && (
        <div className="space-y-4">
          <div className="glass-sub-card space-y-2 rounded-2xl p-3.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lkv-primary)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--lkv-primary)]">
              <MapPin size={12} aria-hidden="true" />
              {POI_CATEGORY_LABELS[poi.category ?? 'other'] ?? 'Autre'}
            </span>
            <p className="text-sm font-bold text-[var(--lkv-text-primary)]">{poi.name}</p>
            {poi.latitude != null && poi.longitude != null && (
              <p className="text-[10.5px] font-medium tabular-nums text-[var(--lkv-text-primary)]/60">
                {Number(poi.latitude).toFixed(5)}, {Number(poi.longitude).toFixed(5)}
              </p>
            )}
            {poi.notes && (
              <p className="text-[11.5px] font-medium leading-snug text-[var(--lkv-text-primary)]/70">
                {poi.notes}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onToggleVisited(!poi.visited)}
            disabled={isPending}
            aria-pressed={poi.visited}
            className={`inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors disabled:opacity-50 ${
              poi.visited
                ? 'bg-[var(--sage-50)] text-[var(--sage-700)] ring-1 ring-[var(--sage-700)]/20'
                : 'glass-capsule-btn'
            }`}
          >
            {poi.visited ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
            {poi.visited ? 'Visité' : 'Marquer comme visité'}
          </button>

          <label className="glass-sub-card block space-y-2 rounded-2xl p-3.5">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/70">
              <Link2 size={12} aria-hidden="true" />
              Rattacher à une étape du jour
            </span>
            <select
              value={poi.step_id ?? ''}
              onChange={(event) => onAttachStep(event.target.value || null)}
              disabled={isPending}
              aria-label="Étape rattachée au point d'intérêt"
              className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
            >
              <option value="">Aucune étape</option>
              {daySteps.map((step) => (
                <option key={step.id} value={step.id}>
                  {step.title}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onDelete}
            disabled={isPending}
            className="glass-capsule-btn inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 !py-3 text-sm font-bold text-[var(--lkv-danger)] disabled:opacity-50"
          >
            <Trash2 size={15} aria-hidden="true" />
            Supprimer le point
          </button>
        </div>
      )}
    </GroupeDrawer>
  );
}

/* ─────────────── Matériel du jour ─────────────── */

export interface ItineraryItemRow {
  id: string;
  item_name: string;
  category: string | null;
  weight_grams: number | null;
  day_number: number | null;
  is_packed: boolean;
}

export interface ItineraryItemsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ItineraryItemRow[];
  day: number;
  isPending: boolean;
  onToggle: (itemId: string, assigned: boolean) => void;
}

export function ItineraryItemsDrawer({
  open,
  onOpenChange,
  items,
  day,
  isPending,
  onToggle,
}: ItineraryItemsDrawerProps) {
  const sorted = [...items].sort((a, b) => {
    const assignedDiff = Number(b.day_number === day) - Number(a.day_number === day);
    if (assignedDiff !== 0) return assignedDiff;
    return a.item_name.localeCompare(b.item_name);
  });

  return (
    <GroupeDrawer open={open} onOpenChange={onOpenChange} title={`Matériel du jour ${day}`} width={460}>
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm font-medium text-[var(--lkv-text-primary)]/70">
          Aucun équipement dans le kit du voyage.
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((item) => {
            const assigned = item.day_number === day;
            return (
              <li key={item.id} className="glass-sub-card flex items-center gap-3 rounded-2xl p-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]"
                  aria-hidden="true"
                >
                  <Backpack size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold text-[var(--lkv-text-primary)]">
                    {item.item_name}
                  </span>
                  <span className="block truncate text-[10.5px] font-medium text-[var(--lkv-text-primary)]/65">
                    {item.category ?? 'Divers'}
                    {item.weight_grams ? ` · ${Math.round(item.weight_grams / 10) / 100} kg` : ''}
                    {item.is_packed ? ' · Emballé' : ''}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={assigned}
                  aria-label={`${item.item_name} requis le jour ${day}`}
                  onClick={() => onToggle(item.id, !assigned)}
                  disabled={isPending}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                    assigned ? 'bg-[var(--lkv-primary)]' : 'bg-black/15'
                  }`}
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      assigned ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </GroupeDrawer>
  );
}
