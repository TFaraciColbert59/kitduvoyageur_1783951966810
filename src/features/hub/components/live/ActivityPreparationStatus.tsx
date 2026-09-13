'use client';

// Hub live (§4.5) — rail de préparation : 6 phases « Analyse → Itinéraire →
// Moments → Transports & hébergements → Kit → Finitions », phase courante
// pulsante, phases terminées = coche spring snappy (500/25). Une haptique
// `success` par complétion, plafonnée à une par vague (800 ms) et jouée
// uniquement si le rail est visible (IntersectionObserver). La progression
// n'anime que `transform: scaleX` ; le texte parle via `aria-live="polite"`.
// Consomme le bus T9 `useActivityLiveArrivals` (pont monté une fois par le hub)
// ET les compteurs serveur (`preparation`) : le rail démarre sur la vraie phase
// d'un voyage révisité/enrichi (done dès `enrichment_status='done'`).
// Fix round final — état « version essentielle servie » + « Améliorer » quand
// l'enrichissement a échoué définitivement (POST /api/ai/jobs, retour pending).
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { countArrivals, useActivityLiveArrivals } from './useActivityLiveArrivals';
import { AnimatedNumber } from './AnimatedNumber';
import {
  EMPTY_ARRIVAL_COUNTS,
  PREPARATION_PHASES,
  RAIL_CHECK_SPRING,
  SUCCESS_HAPTIC_INTERVAL_MS,
  completedPhaseCount,
  fixtureCountsForPhase,
  mergePreparationCounts,
  preparationAnnouncement,
  preparationPhase,
  type ActivityArrivalCounts,
  type ActivityPreparationPhase,
  type EnrichmentStatus,
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
   * production consomme le bus T9 + les compteurs serveur.
   */
  phaseOverride?: ActivityPreparationPhase;
  /**
   * Fix round final — état serveur réel du voyage actif : compteurs BDD +
   * `metadata.enrichment_status`. Absent hors sortie (aperçu, autres natures).
   */
  preparation?: {
    counts: ActivityArrivalCounts;
    enrichmentStatus: EnrichmentStatus | null;
  } | null;
  /** Voyage actif — cible du POST « Améliorer » (jamais hors sortie). */
  tripId?: string | null;
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
  preparation,
  tripId,
}: ActivityPreparationStatusProps) {
  const reduceMotion = useReducedMotion();
  const { arrivals } = useActivityLiveArrivals();
  const liveCounts = useMemo(() => countArrivals(arrivals), [arrivals]);
  const [retryState, setRetryState] = useState<'idle' | 'sending' | 'pending'>('idle');
  const [retryFailed, setRetryFailed] = useState(false);

  const serverCounts = preparation?.counts ?? EMPTY_ARRIVAL_COUNTS;
  const mergedCounts = useMemo(
    () => mergePreparationCounts(serverCounts, liveCounts),
    [serverCounts, liveCounts]
  );
  const enrichmentStatus: EnrichmentStatus | null =
    retryState === 'pending' ? 'pending' : preparation?.enrichmentStatus ?? null;
  const derivedPhase = useMemo(
    () => preparationPhase(mergedCounts, enrichmentStatus),
    [mergedCounts, enrichmentStatus]
  );
  const phase = phaseOverride ?? derivedPhase;
  const displayCounts = phaseOverride ? fixtureCountsForPhase(phaseOverride) : mergedCounts;
  const completed = completedPhaseCount(phase);
  const announcement = preparationAnnouncement(phase, displayCounts);
  const showImprove = !phaseOverride && enrichmentStatus === 'failed';

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

  // Re-enfilement explicite « Améliorer » (utilisateur connecté) : la route
  // /api/ai/jobs porte l'authentification et la limitation de débit.
  const handleImprove = async () => {
    if (!tripId || retryState === 'sending') return;
    setRetryFailed(false);
    setRetryState('sending');
    try {
      const response = await fetch('/api/ai/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'activity-enrichment', payload: { tripId } }),
      });
      if (!response.ok) {
        setRetryState('idle');
        setRetryFailed(true);
        return;
      }
      setRetryState('pending');
      triggerHaptic('success');
    } catch {
      setRetryState('idle');
      setRetryFailed(true);
    }
  };

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
        <span className="flex items-center text-[11px] font-bold tabular-nums text-[var(--lkv-text-primary)]">
          <AnimatedNumber value={completed} />
          <span aria-hidden="true">/{PREPARATION_PHASES.length}</span>
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

      {showImprove && (
        <div
          data-rail-essential=""
          className="glass-sub-card mt-2 flex items-center justify-between gap-2 rounded-2xl px-3 py-2"
        >
          <p className="min-w-0 text-[11px] font-medium text-[var(--lkv-text-secondary)]">
            Version essentielle servie
          </p>
          <button
            type="button"
            onClick={handleImprove}
            disabled={retryState === 'sending'}
            className="glass-capsule-btn min-h-[44px] shrink-0 !px-3 !py-1.5 text-[11px] font-bold disabled:opacity-50"
          >
            {retryState === 'sending' ? 'Envoi…' : 'Améliorer'}
          </button>
        </div>
      )}

      {!phaseOverride && retryState === 'pending' && (
        <p
          data-rail-improving=""
          className="mt-1.5 text-[11px] font-medium text-[var(--lkv-secondary-hover)]"
        >
          Amélioration en cours…
        </p>
      )}

      {!phaseOverride && retryFailed && (
        <p role="alert" className="mt-1.5 text-[11px] font-medium text-[var(--lkv-danger)]">
          Impossible de relancer l’amélioration pour l’instant.
        </p>
      )}
    </section>
  );
}

export default ActivityPreparationStatus;
