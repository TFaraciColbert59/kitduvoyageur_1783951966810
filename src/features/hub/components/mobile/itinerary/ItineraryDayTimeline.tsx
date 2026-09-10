'use client';

import {
  Bike,
  Bus,
  Car,
  CheckCircle2,
  Footprints,
  Mountain,
  Plane,
  Ship,
  Train,
} from 'lucide-react';
import type { PlannerStep } from '@/features/trips/planner/plannerEngine';
import { formatDurationShort, formatStepTime, transportLabel } from '../../../mobile/itineraryEngine';

export interface ItineraryDayTimelineProps {
  steps: PlannerStep[];
  durations?: Record<string, number>;
  onOpen: (step: PlannerStep) => void;
}

function TransportIcon({ mode }: { mode: string | null | undefined }) {
  const className = 'text-[var(--lkv-primary)]';
  switch (mode) {
    case 'plane':
    case 'flight':
      return <Plane size={13} className={className} aria-hidden="true" />;
    case 'train':
      return <Train size={13} className={className} aria-hidden="true" />;
    case 'car':
      return <Car size={13} className={className} aria-hidden="true" />;
    case 'bus':
      return <Bus size={13} className={className} aria-hidden="true" />;
    case 'boat':
      return <Ship size={13} className={className} aria-hidden="true" />;
    case 'bike':
      return <Bike size={13} className={className} aria-hidden="true" />;
    case 'hiking':
      return <Mountain size={13} className={className} aria-hidden="true" />;
    default:
      return <Footprints size={13} className={className} aria-hidden="true" />;
  }
}

/** Timeline verticale du jour — la feuille de route heure par heure. */
export function ItineraryDayTimeline({ steps, durations = {}, onOpen }: ItineraryDayTimelineProps) {
  if (steps.length === 0) {
    return (
      <div className="glass-sub-card rounded-2xl p-4">
        <p className="text-sm font-bold text-[var(--lkv-text-primary)]">Journée libre</p>
        <p className="mt-1 text-xs font-medium text-[var(--lkv-text-primary)]/70">
          Aucune étape planifiée — ajoutez la première pour construire la feuille de route.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-2.5" aria-label="Déroulé de la journée">
      {steps.map((step, index) => {
        const time = formatStepTime(step.start_time);
        const duration = durations[step.id];
        return (
          <li key={step.id} className="flex items-stretch gap-3">
            <div className="flex w-12 shrink-0 flex-col items-center pt-1">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                  time
                    ? 'bg-[var(--lkv-primary)] text-white'
                    : 'bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]'
                }`}
              >
                {time ?? '—'}
              </span>
              <span
                className={`mt-1.5 w-0.5 flex-1 rounded-full ${
                  index === steps.length - 1 ? 'bg-transparent' : 'bg-[var(--lkv-primary)]/20'
                }`}
                aria-hidden="true"
              />
            </div>

            <button
              type="button"
              onClick={() => onOpen(step)}
              aria-label={`${time ? `${time} · ` : ''}${step.title}`}
              className="glass mb-1 min-h-[44px] flex-1 rounded-[1.4rem] p-3 text-left transition-transform active:scale-[0.98]"
            >
              <span className="flex w-full items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--lkv-primary)]/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--lkv-primary)]">
                  <TransportIcon mode={step.transport_mode} />
                  {transportLabel(step.transport_mode)}
                </span>
                {duration != null && duration > 0 && (
                  <span className="ml-auto shrink-0 text-[10px] font-semibold text-[var(--lkv-text-primary)]/60">
                    {formatDurationShort(duration)}
                  </span>
                )}
              </span>

              <span className="mt-1.5 block text-[13px] font-bold leading-snug text-[var(--lkv-text-primary)]">
                {step.title}
              </span>

              {step.location_name && (
                <span className="mt-0.5 block truncate text-[11px] font-medium text-[var(--lkv-text-primary)]/70">
                  {step.location_name}
                </span>
              )}

              <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] font-semibold tabular-nums text-[var(--lkv-text-primary)]/70">
                {step.distance_km != null && <span>{step.distance_km} km</span>}
                {step.elevation_gain_m != null && <span>+{step.elevation_gain_m} m</span>}
                {step.accommodation_name && (
                  <span className="inline-flex min-w-0 items-center gap-1 truncate">
                    <CheckCircle2 size={11} aria-hidden="true" />
                    {step.accommodation_name}
                  </span>
                )}
              </span>

              {step.description && (
                <span className="mt-1 line-clamp-2 block text-[11px] font-medium leading-snug text-[var(--lkv-text-primary)]/60">
                  {step.description}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export default ItineraryDayTimeline;
