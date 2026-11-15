/**
 * Charge d'entraînement : Fitness (CTL 42 j), Fatigue (ATL 7 j) et Forme (TSB) (A05 · S2.15).
 *
 * Règles C-MET :
 *   - utilise uniquement les séances terminées portant une durée (ou distance) réelle ;
 *   - pondère prioritairement par RPE saisi (sRPE), sinon par intensité dérivée
 *     de l'allure/dénivelé et du sport ;
 *   - si aucune séance terminée n'existe dans les 90 derniers jours, retourne un état
 *     `unavailable` motivé sans inventer de niveau de forme.
 */

import { addDaysToKey, isDone, localDateKey, todayKey, type ProgressionSession } from './engine';
import { readOutingRpe } from '@/features/explorer-v2/metrics/telemetryAnalysis';

export const TRAINING_LOAD_METHOD = 'banister-ctl42-atl7-v1' as const;

export interface TrainingLoadPoint {
  dateKey: string;
  dailyLoad: number;
  /** Chronic Training Load (exponentielle 42 jours). */
  fitnessCtl: number;
  /** Acute Training Load (exponentielle 7 jours). */
  fatigueAtl: number;
  /** Training Stress Balance = CTL - ATL. */
  formTsb: number;
}

export type FormStatusId = 'fresh' | 'optimal' | 'productive' | 'tired' | 'overreaching' | 'detrained';

export interface TrainingLoadSummary {
  status: 'available' | 'unavailable';
  method: typeof TRAINING_LOAD_METHOD;
  quality: 'estimated';
  reason: string | null;
  fitnessCtl: number | null;
  fatigueAtl: number | null;
  formTsb: number | null;
  weeklyLoad: number;
  previousWeeklyLoad: number;
  acuteChronicRatio: number | null;
  formLabel: string;
  formStatus: FormStatusId;
  activeDaysCount: number;
  series: TrainingLoadPoint[];
}

const SPORT_INTENSITY_FACTOR: Record<string, number> = {
  course: 1.08,
  trail: 1.15,
  velo: 0.92,
  rando: 0.72,
  ski: 1.05,
  kayak: 0.85,
  escalade: 0.88,
  musculation: 0.82,
};

export function estimateSessionTrainingLoad(session: ProgressionSession): number | null {
  if (!isDone(session)) return null;
  const durMin =
    typeof session.durationS === 'number' && Number.isFinite(session.durationS) && session.durationS > 0
      ? session.durationS / 60
      : typeof session.km === 'number' && Number.isFinite(session.km) && session.km > 0
        ? session.km * 7 // ~7 min/km si durée absente
        : null;
  if (durMin === null || durMin <= 0) return null;

  const rpe = readOutingRpe(session.id);
  const elevBonus =
    typeof session.dplus === 'number' && Number.isFinite(session.dplus) && session.dplus > 0
      ? Math.min(28, session.dplus / 50)
      : 0;

  if (rpe !== null) {
    return Math.round(durMin * (rpe / 10) * 1.65 + elevBonus);
  }
  const factor = SPORT_INTENSITY_FACTOR[session.sport ?? ''] ?? 0.85;
  return Math.round(durMin * factor + elevBonus);
}

function classifyForm(ctl: number, tsb: number): { id: FormStatusId; label: string } {
  if (ctl < 5 && Math.abs(tsb) < 4) {
    return { id: 'detrained', label: 'Reprise progressive' };
  }
  if (tsb >= 10) return { id: 'fresh', label: 'Frais · affûté' };
  if (tsb >= 0) return { id: 'optimal', label: 'Équilibre optimal' };
  if (tsb >= -12) return { id: 'productive', label: 'Charge productive' };
  if (tsb >= -24) return { id: 'tired', label: 'Fatigue notable' };
  return { id: 'overreaching', label: 'Risque de surcharge' };
}

export function computeTrainingLoad(
  sessions: readonly ProgressionSession[],
  timeZone: string,
  daysWindow = 56,
  now = new Date()
): TrainingLoadSummary {
  const endKey = todayKey(timeZone, now);
  const warmupDays = 84;
  const startWarmupKey = addDaysToKey(endKey, -(warmupDays - 1));

  const dailyTotals = new Map<string, number>();
  let activeDaysCount = 0;

  for (const session of sessions) {
    const load = estimateSessionTrainingLoad(session);
    if (load === null) continue;
    const key = localDateKey(session.startedAt ?? session.endedAt, timeZone);
    if (!key || key > endKey) continue;
    if (key >= startWarmupKey) {
      if (!dailyTotals.has(key)) activeDaysCount += 1;
      dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + load);
    }
  }

  if (activeDaysCount === 0) {
    return {
      status: 'unavailable',
      method: TRAINING_LOAD_METHOD,
      quality: 'estimated',
      reason: 'Aucune séance terminée avec durée ou distance exploitable sur les 12 dernières semaines.',
      fitnessCtl: null,
      fatigueAtl: null,
      formTsb: null,
      weeklyLoad: 0,
      previousWeeklyLoad: 0,
      acuteChronicRatio: null,
      formLabel: 'Indisponible',
      formStatus: 'detrained',
      activeDaysCount: 0,
      series: [],
    };
  }

  const alphaCtl = 1 - Math.exp(-1 / 42);
  const alphaAtl = 1 - Math.exp(-1 / 7);

  let ctl = 0;
  let atl = 0;
  const fullSeries: TrainingLoadPoint[] = [];

  for (let offset = warmupDays - 1; offset >= 0; offset -= 1) {
    const key = addDaysToKey(endKey, -offset);
    const dailyLoad = dailyTotals.get(key) ?? 0;
    const prevCtl = ctl;
    const prevAtl = atl;
    ctl = prevCtl + alphaCtl * (dailyLoad - prevCtl);
    atl = prevAtl + alphaAtl * (dailyLoad - prevAtl);
    const tsb = prevCtl - prevAtl;
    fullSeries.push({
      dateKey: key,
      dailyLoad,
      fitnessCtl: Math.round(ctl * 10) / 10,
      fatigueAtl: Math.round(atl * 10) / 10,
      formTsb: Math.round(tsb * 10) / 10,
    });
  }

  const series = fullSeries.slice(-daysWindow);
  const latest = series[series.length - 1]!;
  const weeklyLoad = fullSeries.slice(-7).reduce((acc, p) => acc + p.dailyLoad, 0);
  const previousWeeklyLoad = fullSeries.slice(-14, -7).reduce((acc, p) => acc + p.dailyLoad, 0);
  const acwr =
    latest.fitnessCtl >= 3
      ? Math.round((latest.fatigueAtl / latest.fitnessCtl) * 100) / 100
      : null;
  const form = classifyForm(latest.fitnessCtl, latest.formTsb);

  return {
    status: 'available',
    method: TRAINING_LOAD_METHOD,
    quality: 'estimated',
    reason: null,
    fitnessCtl: Math.round(latest.fitnessCtl),
    fatigueAtl: Math.round(latest.fatigueAtl),
    formTsb: Math.round(latest.formTsb),
    weeklyLoad,
    previousWeeklyLoad,
    acuteChronicRatio: acwr,
    formLabel: form.label,
    formStatus: form.id,
    activeDaysCount,
    series,
  };
}
