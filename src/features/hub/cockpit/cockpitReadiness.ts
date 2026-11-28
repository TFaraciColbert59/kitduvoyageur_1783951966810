import type { CockpitData, CockpitWeatherDay } from './model';
import { computeKitWeights } from './kitMath';
import { evaluateDocumentExpiry } from './paperasseStatus';
import { deriveWeatherAlerts } from './weatherAdvice';

export type ReadinessSignalTone = 'good' | 'warn' | 'bad' | 'water' | 'tint';
export type CockpitWidgetKey =
  | 'meteo'
  | 'carte'
  | 'etapes'
  | 'kit'
  | 'budget'
  | 'carnet'
  | 'paperasse'
  | 'groupe';

export interface CockpitSignal {
  id: string;
  label: string;
  tone: ReadinessSignalTone;
  targetWidget: CockpitWidgetKey;
  icon: string;
}

export interface CockpitReadinessReport {
  score: number;
  statusLabel: string;
  tone: ReadinessSignalTone;
  phaseLabel: string;
  signals: CockpitSignal[];
  breakdown: {
    kitPct: number;
    stepsPlanned: number;
    stepsCompleted: number;
    expiredDocs: number;
    pendingReservations: number;
    vitalUnpacked: number;
  };
}

/**
 * Calcule l'état de préparation vivant de l'aventure (0–100 %) et les 2 signaux
 * tactiques prioritaires du jour pour le Hub 2100.
 */
export function computeCockpitReadiness(
  data: CockpitData,
  options: {
    day: number;
    activeDateIso: string;
    forecastDay?: CockpitWeatherDay | null;
    kitItems?: CockpitData['kit'];
    completedStepCount?: number;
    totalDaySteps?: number;
  },
): CockpitReadinessReport {
  const kitItems = options.kitItems ?? data.kit;
  const weights = computeKitWeights(kitItems);
  const packedCount = kitItems.filter((item) => item.packed).length;
  const kitPct = kitItems.length > 0 ? Math.round((packedCount / kitItems.length) * 100) : 100;

  const docs = data.documents ?? [];
  const expiredDocs = docs.filter(
    (doc) => evaluateDocumentExpiry(doc.expiration, options.activeDateIso).health === 'expired',
  ).length;
  const expiringDocs = docs.filter(
    (doc) => evaluateDocumentExpiry(doc.expiration, options.activeDateIso).health === 'expiring_soon',
  ).length;
  const pendingReservations = (data.reservations ?? []).filter(
    (res) => res.status === 'À réserver',
  ).length;

  const weatherAlerts = deriveWeatherAlerts(options.forecastDay ?? undefined);
  const stepsPlanned = options.totalDaySteps ?? data.steps.filter((s) => s.day === options.day).length;
  const stepsCompleted = options.completedStepCount ?? 0;

  // Pondération équilibrée sur les piliers réellement présents
  let weightedSum = 0;
  let totalWeight = 0;

  // 1. Kit (35 %)
  if (kitItems.length > 0) {
    const vitalPenalty = Math.min(30, weights.vitalUnpackedCount * 15);
    weightedSum += Math.max(0, kitPct - vitalPenalty) * 0.35;
    totalWeight += 0.35;
  }

  // 2. Étapes / Itinéraire (25 %)
  const routeScore = data.steps.length > 0 || data.route.length > 0 ? 100 : 25;
  weightedSum += routeScore * 0.25;
  totalWeight += 0.25;

  // 3. Paperasse & Réservations (20 %)
  const paperScore =
    expiredDocs > 0 ? 20 : pendingReservations > 0 ? 60 : expiringDocs > 0 ? 80 : 100;
  weightedSum += paperScore * 0.2;
  totalWeight += 0.2;

  // 4. Météo & Terrain (10 %)
  const weatherScore = options.forecastDay ? (weatherAlerts.length > 0 ? 70 : 100) : 55;
  weightedSum += weatherScore * 0.1;
  totalWeight += 0.1;

  // 5. Cordée (10 %)
  const crewScore = data.people.length > 0 ? (data.pending > 0 ? 75 : 100) : 60;
  weightedSum += crewScore * 0.1;
  totalWeight += 0.1;

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 100;
  const tone: ReadinessSignalTone =
    score >= 85 && expiredDocs === 0 && weights.vitalUnpackedCount === 0
      ? 'good'
      : score >= 55 && expiredDocs === 0
        ? 'warn'
        : 'bad';
  const statusLabel =
    tone === 'good' ? 'Prêt à partir' : tone === 'warn' ? 'En préparation' : 'Action requise';

  // Badge de phase temporelle
  const phaseLabel = computePhaseLabel(data, options.day, options.activeDateIso);

  // Signaux prioritaires (max 2, triés par urgence réelle — sobriété absolue)
  const signals: CockpitSignal[] = [];

  if (expiredDocs > 0) {
    signals.push({
      id: 'expired-docs',
      label: `${expiredDocs} doc expiré${expiredDocs > 1 ? 's' : ''}`,
      tone: 'bad',
      targetWidget: 'paperasse',
      icon: 'alert-triangle',
    });
  }
  if (weights.vitalUnpackedCount > 0) {
    signals.push({
      id: 'vital-kit',
      label: `${weights.vitalUnpackedCount} vital à préparer`,
      tone: 'bad',
      targetWidget: 'kit',
      icon: 'backpack',
    });
  }
  if (weatherAlerts.length > 0) {
    signals.push({
      id: 'weather-alert',
      label: weatherAlerts[0].title,
      tone: 'warn',
      targetWidget: 'meteo',
      icon: 'cloud-rain',
    });
  }
  if (pendingReservations > 0) {
    signals.push({
      id: 'pending-res',
      label: `${pendingReservations} résa à faire`,
      tone: 'warn',
      targetWidget: 'paperasse',
      icon: 'calendar',
    });
  }
  if (kitItems.length > 0 && packedCount < kitItems.length && weights.vitalUnpackedCount === 0) {
    signals.push({
      id: 'kit-progress',
      label: `Sac ${kitPct} %`,
      tone: kitPct >= 75 ? 'good' : 'tint',
      targetWidget: 'kit',
      icon: 'backpack',
    });
  }
  if (signals.length === 0 && data.trip) {
    signals.push({
      id: 'all-ready',
      label: 'Cockpit prêt',
      tone: 'good',
      targetWidget: 'etapes',
      icon: 'check',
    });
  }

  return {
    score,
    statusLabel,
    tone,
    phaseLabel,
    signals: signals.slice(0, 2),
    breakdown: {
      kitPct,
      stepsPlanned,
      stepsCompleted,
      expiredDocs,
      pendingReservations,
      vitalUnpacked: weights.vitalUnpackedCount,
    },
  };
}

function computePhaseLabel(data: CockpitData, day: number, activeDateIso: string): string {
  if (!data.trip) return data.collective ? 'Collectif' : 'Base Camp';
  if (data.startDate) {
    const startMs = Date.parse(`${data.startDate.slice(0, 10)}T12:00:00Z`);
    const nowMs = Date.parse(`${activeDateIso.slice(0, 10)}T12:00:00Z`);
    if (Number.isFinite(startMs) && Number.isFinite(nowMs)) {
      const diffDays = Math.round((startMs - nowMs) / 86_400_000);
      if (diffDays > 0) return `J-${diffDays}`;
      if (data.dayCount && -diffDays >= data.dayCount) return 'Terminé';
    }
  }
  return data.dayCount ? `Jour ${day}/${data.dayCount}` : `Jour ${day}`;
}
