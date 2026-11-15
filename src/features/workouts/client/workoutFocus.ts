import {
  daysUntilTargetDate,
  readPrepFocus,
  type PrepFocusConfig,
} from '@/features/compte/progression/prepFocus';
import {
  computeTrainingLoad,
  type FormStatusId,
  type TrainingLoadSummary,
} from '@/features/compte/progression/trainingLoad';
import type { ProgressionSession } from '@/features/compte/progression/engine';
import type { SessionIntent } from '../domain/types';

export interface WorkoutFocusContext {
  prepFocus: PrepFocusConfig | null;
  daysRemaining: number | null;
  loadStatus: 'available' | 'unavailable';
  formStatus: FormStatusId | null;
  formLabel: string | null;
  tsb: number | null;
  ctl: number | null;
  atl: number | null;
  recommendedIntent: SessionIntent;
  rationale: string;
}

function normalizeOutingsToSessions(payload: unknown): ProgressionSession[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const outings = (payload as Record<string, unknown>).outings;
  if (!Array.isArray(outings)) return [];

  const result: ProgressionSession[] = [];
  for (let i = 0; i < outings.length; i += 1) {
    const raw = outings[i];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    const status = item.status === 'upcoming' ? 'upcoming' : 'done';
    if (status === 'upcoming') continue;
    const endedAt = typeof item.endedAt === 'string' ? item.endedAt : null;
    const startedAt = typeof item.startedAt === 'string' ? item.startedAt : endedAt;
    if (!startedAt) continue;
    const durationS =
      typeof item.durationS === 'number' && Number.isFinite(item.durationS)
        ? item.durationS
        : typeof item.duration_s === 'number' && Number.isFinite(item.duration_s)
          ? item.duration_s
          : null;
    const km =
      typeof item.km === 'number' && Number.isFinite(item.km)
        ? item.km
        : typeof item.distanceKm === 'number' && Number.isFinite(item.distanceKm)
          ? item.distanceKm
          : typeof item.distance_km === 'number' && Number.isFinite(item.distance_km)
            ? item.distance_km
            : null;
    if (durationS === null && km === null) continue;
    const dplus =
      typeof item.dplus === 'number' && Number.isFinite(item.dplus)
        ? item.dplus
        : typeof item.elevationGainM === 'number' && Number.isFinite(item.elevationGainM)
          ? item.elevationGainM
          : null;
    result.push({
      id: typeof item.id === 'string' ? item.id : `outing-${i}`,
      title: typeof item.title === 'string' ? item.title : 'Sortie',
      sport: typeof item.sport === 'string' ? item.sport : null,
      startedAt,
      endedAt: endedAt ?? startedAt,
      km,
      dplus,
      durationS,
      massif: typeof item.massif === 'string' ? item.massif : null,
    });
  }
  return result;
}

function decideIntent(
  prepFocus: PrepFocusConfig | null,
  daysRemaining: number | null,
  load: TrainingLoadSummary | null
): { intent: SessionIntent; rationale: string } {
  if (load && load.status === 'available' && load.formTsb !== null) {
    if (load.formTsb < -15 || load.formStatus === 'overreaching') {
      return {
        intent: 'recovery',
        rationale: `Fatigue aiguë élevée (TSB ${load.formTsb.toFixed(1)}) : privilégie une séance de récupération ou d’endurance très douce.`,
      };
    }
    if (daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 10) {
      return {
        intent: 'endurance',
        rationale: `Échéance dans ${daysRemaining} j (${prepFocus?.title ?? 'objectif'}) : phase d’affûtage — conserve du rythme court sans accumuler de fatigue.`,
      };
    }
    if (load.formTsb < -5 || load.formStatus === 'tired') {
      return {
        intent: 'endurance',
        rationale: `Charge soutenue (TSB ${load.formTsb.toFixed(1)}, ${load.formLabel.toLowerCase()}) : consolide en endurance fondamentale.`,
      };
    }
  }

  if (prepFocus) {
    if (prepFocus.focus === 'vitesse') {
      return {
        intent: 'interval',
        rationale: `Focus « ${prepFocus.title || 'Seuil & vitesse'} » : priorise une séance de fractionné ou de tempo.`,
      };
    }
    if (prepFocus.focus === 'denivele') {
      return {
        intent: 'tempo',
        rationale: `Focus « ${prepFocus.title || 'Dénivelé'} » : travail soutenu en côte / tempo régulier.`,
      };
    }
    if (prepFocus.focus === 'recuperation') {
      return {
        intent: 'recovery',
        rationale: `Focus récupération actif : privilégie la fraîcheur et la régularité.`,
      };
    }
    return {
      intent: 'endurance',
      rationale: `Focus « ${prepFocus.title || 'Endurance'} » : construis le volume progressif en endurance.`,
    };
  }

  if (load && load.status === 'available') {
    return {
      intent: 'tempo',
      rationale: `Forme ${load.formLabel.toLowerCase()} (CTL ${load.fitnessCtl?.toFixed(0) ?? '—'} · TSB ${load.formTsb?.toFixed(1) ?? '—'}) : bloc qualitatif adapté.`,
    };
  }

  return {
    intent: 'endurance',
    rationale:
      'Aucune donnée de charge physiologique ni échéance configurée : la recommandation démarre sur une base d’endurance progressive.',
  };
}

/**
 * Construit le contexte d'adaptation S2.36 en combinant l'objectif de
 * préparation (S2.20) et la charge CTL/ATL/TSB (S2.15) issues des sorties réelles.
 */
export function buildWorkoutFocusContext(
  payload?: unknown,
  sessionsOverride?: readonly ProgressionSession[],
  accountKey = 'anonymous',
  now = new Date()
): WorkoutFocusContext {
  const prepFocus = readPrepFocus(accountKey);
  const daysRemaining = prepFocus
    ? daysUntilTargetDate(prepFocus.targetDate, now)
    : null;
  const sessions =
    sessionsOverride && sessionsOverride.length > 0
      ? [...sessionsOverride]
      : normalizeOutingsToSessions(payload);
  const load =
    sessions.length > 0 ? computeTrainingLoad(sessions, 'Europe/Paris', 56, now) : null;
  const { intent, rationale } = decideIntent(prepFocus, daysRemaining, load);

  return {
    prepFocus,
    daysRemaining,
    loadStatus: load?.status === 'available' ? 'available' : 'unavailable',
    formStatus: load?.status === 'available' ? load.formStatus : null,
    formLabel: load?.status === 'available' ? load.formLabel : null,
    tsb: load?.status === 'available' ? load.formTsb : null,
    ctl: load?.status === 'available' ? load.fitnessCtl : null,
    atl: load?.status === 'available' ? load.fatigueAtl : null,
    recommendedIntent: intent,
    rationale,
  };
}
