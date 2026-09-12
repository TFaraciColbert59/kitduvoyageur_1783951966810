'use client';

// Hub live (§4.5) — rail de préparation : 6 phases « Analyse → Itinéraire →
// Moments → Transports & hébergements → Kit → Finitions », phase courante
// pulsante, phases terminées = coche spring snappy (500/25). Une haptique
// `success` par complétion, plafonnée à une par vague (800 ms) et jouée
// uniquement si le rail est visible (IntersectionObserver). La progression
// n'anime que `transform: scaleX` ; le texte parle via `aria-live="polite"`.
// Consomme le bus T9 `useActivityLiveArrivals` (pont monté une fois par le hub).
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { countArrivals, useActivityLiveArrivals } from './useActivityLiveArrivals';
import type { ActivityPreparationPhase } from './useActivityLiveArrivals';
import {
  PREPARATION_PHASES,
  RAIL_CHECK_SPRING,
  SUCCESS_HAPTIC_INTERVAL_MS,
  completedPhaseCount,
  fixtureCountsForPhase,
  preparationAnnouncement,
} from './preparationPhases';

export {
  PREPARATION_PHASES,
  RAIL_CHECK_SPRING,
  SUCCESS_HAPTIC_INTERVAL_MS,
  completedPhaseCount,
  fixtureCountsForPhase,
  preparationAnnouncement,
};
export type { PreparationPhaseDef } from './preparationPhases';

let lastSuccessHapticAt = 0;

export interface ActivityPreparationStatusProps {
  className?: string;
  /**
   * Aperçu dev / tests uniquement : force la phase rendue avec des compteurs
   * de démonstration (aucune émission réelle, aucune haptique). Le rail de
   * production consomme exclusivement le bus T9.
   */
  phaseOverride?: ActivityPreparationPhase;
}

function PhaseMarker({ state, pulsing }: { state: 'done' | 'current' | 'pending'; pulsing: boolean }) {
  const reduceMotion = useReducedMotion();

  if (state === 'done') {
    return (
      <motion.span
        data-rail-check=""
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--lkv-primary)] text-white"
        initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', ...RAIL_CHECK_SPRING }}
      >
        <Check size={11} strokeWidth={3.4} aria-hidden="true" />
      </motion.span>
    );
  }

  if (state === 'current') {
    return (
      <span
        data-rail-current=""
        className={cn(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 border-[var(--lkv-primary)]',
          pulsing && 'animate-pulse-lkv motion-reduce:animate-none'
        )}
      >
        <span className="h-[7px] w-[7px] rounded-full bg-[var(--lkv-primary)]" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span data-rail-pending="" className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
      <span className="h-[6px] w-[6px] rounded-full bg-[var(--lkv-text-muted)]/40" aria-hidden="true" />
    </span>
  );
}

export function ActivityPreparationStatus({
  className,
  phaseOverride,
}: ActivityPreparationStatusProps) {
  const reduceMotion = useReducedMotion();
  const { arrivals, phase: livePhase } = useActivityLiveArrivals();
  const phase = phaseOverride ?? livePhase;
  const counts = useMemo(() => countArrivals(arrivals), [arrivals]);
  const displayCounts = phaseOverride ? fixtureCountsForPhase(phaseOverride) : counts;
  const completed = completedPhaseCount(phase);
  const announcement = preparationAnnouncement(phase, displayCounts);

  const sectionRef = useRef<HTMLElement | null>(null);
  const visibleRef = useRef(true);
  const [visible, setVisible] = useState(true);
  const previousCompleted = useRef(completed);
  const { triggerHaptic } = useHapticFeedback();

  useEffect(() => {
    const element = sectionRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.some((entry) => entry.isIntersecting);
        visibleRef.current = intersecting;
        setVisible(intersecting);
      },
      { rootMargin: '80px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Une `success` par complétion (même si plusieurs phases sautent d'un coup),
  // jamais en arrière-plan, jamais plus d'une par fenêtre de 800 ms.
  useEffect(() => {
    if (phaseOverride) return;
    if (completed > previousCompleted.current && visibleRef.current) {
      const now = Date.now();
      if (now - lastSuccessHapticAt >= SUCCESS_HAPTIC_INTERVAL_MS) {
        lastSuccessHapticAt = now;
        triggerHaptic('success');
      }
    }
    previousCompleted.current = completed;
  }, [completed, phaseOverride, triggerHaptic]);

  const pulsing = !reduceMotion && visible && phase !== 'done';

  return (
    <section
      ref={sectionRef}
      data-testid="activity-preparation-status"
      data-phase={phase}
      aria-label="Préparation de l’activité"
      className={cn('glass relative overflow-hidden rounded-[1.75rem] px-3 py-2.5', className)}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
          Préparation live
        </p>
        <span className="text-[11px] font-bold tabular-nums text-[var(--lkv-text-primary)]">
          {completed}/{PREPARATION_PHASES.length}
        </span>
      </div>

      <ol className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Étapes">
        {PREPARATION_PHASES.map((definition, index) => {
          const state: 'done' | 'current' | 'pending' =
            index < completed ? 'done' : index === completed ? 'current' : 'pending';
          return (
            <li
              key={definition.key}
              data-rail-step={definition.key}
              data-state={state}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5',
                state === 'current' && 'bg-[var(--lkv-primary)]/10',
                state === 'pending' && 'opacity-55'
              )}
            >
              <PhaseMarker state={state} pulsing={pulsing && state === 'current'} />
              <span
                className={cn(
                  'whitespace-nowrap text-[11px]',
                  state === 'pending'
                    ? 'font-medium text-[var(--lkv-text-secondary)]'
                    : 'font-bold text-[var(--lkv-text-primary)]'
                )}
              >
                {definition.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/5" aria-hidden="true">
        <div
          data-rail-progress=""
          className="h-full origin-left rounded-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]"
          style={{ transform: `scaleX(${completed / PREPARATION_PHASES.length})` }}
        />
      </div>

      <p
        role="status"
        aria-live="polite"
        data-rail-announcement=""
        className="mt-1.5 text-[11px] font-medium text-[var(--lkv-text-secondary)]"
      >
        {announcement}
      </p>
    </section>
  );
}

export default ActivityPreparationStatus;
