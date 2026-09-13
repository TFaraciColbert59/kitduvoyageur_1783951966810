'use client';

// Hub live (§4.5) — rail de préparation réduit à une barre silencieuse : la
// progression ne s'exprime que par `transform: scaleX(completed/6)`, décorative
// (`aria-hidden`), sans texte, libellé, liste ni annonce. Une haptique `success`
// par complétion, plafonnée à une par vague (800 ms) et jouée uniquement si la
// barre est visible (IntersectionObserver). Échec définitif d'enrichissement :
// la barre est masquée (aucun texte).
// Consomme le bus T9 `useActivityLiveArrivals` (pont monté une fois par le hub)
// ET les compteurs serveur (`preparation`) : la barre démarre sur la vraie phase
// d'un voyage révisité/enrichi (done dès `enrichment_status='done'`).
import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { countArrivals, useActivityLiveArrivals } from './useActivityLiveArrivals';
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
   * de démonstration (aucune émission réelle, aucune haptique). La barre de
   * production consomme le bus T9 + les compteurs serveur.
   */
  phaseOverride?: ActivityPreparationPhase;
  /**
   * État serveur réel du voyage actif : compteurs BDD +
   * `metadata.enrichment_status`. Absent hors sortie (aperçu, autres natures).
   */
  preparation?: {
    counts: ActivityArrivalCounts;
    enrichmentStatus: EnrichmentStatus | null;
  } | null;
  /** Voyage actif — conservé pour compatibilité d'appel (plus de POST direct). */
  tripId?: string | null;
}

export function ActivityPreparationStatus({
  className,
  phaseOverride,
  preparation,
}: ActivityPreparationStatusProps) {
  const { arrivals } = useActivityLiveArrivals();
  const liveCounts = useMemo(() => countArrivals(arrivals), [arrivals]);

  const serverCounts = preparation?.counts ?? EMPTY_ARRIVAL_COUNTS;
  const mergedCounts = useMemo(
    () => mergePreparationCounts(serverCounts, liveCounts),
    [serverCounts, liveCounts]
  );
  const enrichmentStatus: EnrichmentStatus | null = preparation?.enrichmentStatus ?? null;
  const derivedPhase = useMemo(
    () => preparationPhase(mergedCounts, enrichmentStatus),
    [mergedCounts, enrichmentStatus]
  );
  const phase = phaseOverride ?? derivedPhase;
  const completed = completedPhaseCount(phase);

  const sectionRef = useRef<HTMLElement | null>(null);
  const visibleRef = useRef(true);
  const previousCompleted = useRef(completed);
  const { triggerHaptic } = useHapticFeedback();

  useEffect(() => {
    const element = sectionRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        visibleRef.current = entries.some((entry) => entry.isIntersecting);
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

  // Échec définitif : barre masquée, aucun texte.
  if (!phaseOverride && enrichmentStatus === 'failed') return null;

  return (
    <section
      ref={sectionRef}
      data-testid="activity-preparation-status"
      data-phase={phase}
      aria-label="Préparation de l’activité"
      className={cn('glass relative overflow-hidden rounded-[1.75rem] px-3 py-2.5', className)}
    >
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/5" aria-hidden="true">
        <div
          data-testid="preparation-progressbar"
          data-rail-progress=""
          aria-hidden="true"
          className="h-full origin-left rounded-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]"
          style={{ transform: `scaleX(${completed / PREPARATION_PHASES.length})` }}
        />
      </div>
    </section>
  );
}

export default ActivityPreparationStatus;
