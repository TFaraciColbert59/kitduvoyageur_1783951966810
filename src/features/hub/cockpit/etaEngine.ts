/**
 * Calcul dynamique d'ETA et d'écart prévu/réel (P07-25, P07-26, P07-13).
 */

export interface EtaEstimate {
  etaIso: string;
  remainingMinutes: number;
  deltaMinutes: number | null;
  paceSource: 'observed' | 'default_hiking';
}

const DEFAULT_SPEED_KMH = 3.5;

export function estimateStepEta(input: {
  nowIso: string;
  remainingKm: number;
  remainingGainM?: number;
  observedSpeedKmh?: number | null;
  plannedArrivalIso?: string | null;
}): EtaEstimate | null {
  const nowMs = Date.parse(input.nowIso);
  if (!Number.isFinite(nowMs) || !Number.isFinite(input.remainingKm) || input.remainingKm < 0) {
    return null;
  }

  const hasObserved = input.observedSpeedKmh != null && Number.isFinite(input.observedSpeedKmh) && input.observedSpeedKmh > 0.3;
  const speed = hasObserved ? input.observedSpeedKmh! : DEFAULT_SPEED_KMH;
  // Règle Naismith / Munter simple : +10 min par 100 m de D+
  const climbHours = Math.max(0, input.remainingGainM ?? 0) / 600;
  const flatHours = input.remainingKm / speed;
  const remainingMinutes = Math.round((flatHours + climbHours) * 60);
  const etaMs = nowMs + remainingMinutes * 60_000;

  let deltaMinutes: number | null = null;
  if (input.plannedArrivalIso) {
    const plannedMs = Date.parse(input.plannedArrivalIso);
    if (Number.isFinite(plannedMs)) {
      deltaMinutes = Math.round((etaMs - plannedMs) / 60_000);
    }
  }

  return {
    etaIso: new Date(etaMs).toISOString(),
    remainingMinutes,
    deltaMinutes,
    paceSource: hasObserved ? 'observed' : 'default_hiking',
  };
}

export function formatEtaDelta(deltaMinutes: number | null): string {
  if (deltaMinutes == null) return 'Horaire prévu non renseigné';
  if (Math.abs(deltaMinutes) <= 5) return 'Dans les temps';
  const abs = Math.abs(deltaMinutes);
  const label = abs >= 60 ? `${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}` : `${abs} min`;
  return deltaMinutes > 0 ? `+${label} de retard` : `${label} d’avance`;
}
