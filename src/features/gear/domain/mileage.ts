import type {
  GearComponent,
  GearComponentMileage,
  GearMileage,
  GearMileageAlert,
  GearUsageEvent,
  GearUsageSummary,
} from './types';

/**
 * Moteur pur du kilométrage équipement.
 *
 * Règles :
 * - une séance est identifiée par `sessionId` : un rejeu ne compte jamais deux fois ;
 * - une correction (révision supérieure) remplace la contribution précédente ;
 * - une distance absente (`null`) est exclue et comptée à part, jamais ramenée à 0 ;
 * - une distance de 0 km reste une information réelle mais n'ajoute aucun kilomètre ;
 * - une sortie non terminée, retirée, ou d'un autre sport n'entre pas dans le total.
 */

const DONE_STATUSES = new Set(['done', 'finished', 'completed', 'complete', 'closed']);
const IGNORED_STATUSES = new Set(['planned', 'live', 'ongoing', 'paused', 'abandoned', 'cancelled', 'canceled']);

function roundKm(value: number): number {
  return Math.round(value * 100) / 100;
}

function finitePositive(value: unknown): number | null {
  // `Number(null)` vaut 0 : sans ce garde, une donnée absente deviendrait un
  // zéro mesuré, exactement ce que la fiche interdit.
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function normalized(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** Une sortie est-elle terminée ? Le statut explicite prime sur la date de fin. */
export function isFinishedUsage(usage: Pick<GearUsageEvent, 'status' | 'endedAt'>, now: number = Date.now()): boolean {
  const status = normalized(usage.status);
  if (DONE_STATUSES.has(status)) return true;
  if (IGNORED_STATUSES.has(status)) return false;
  if (!usage.endedAt) return false;
  const ended = Date.parse(usage.endedAt);
  return Number.isFinite(ended) && ended <= now;
}

/**
 * Version retenue pour une même séance. Une révision plus haute gagne ; à
 * révision égale, la correction la plus récente gagne ; sinon la première
 * occurrence connue est conservée pour rester déterministe.
 */
function isNewerUsage(candidate: GearUsageEvent, current: GearUsageEvent): boolean {
  const candidateRevision = Number.isFinite(candidate.revision) ? Number(candidate.revision) : 0;
  const currentRevision = Number.isFinite(current.revision) ? Number(current.revision) : 0;
  if (candidateRevision !== currentRevision) return candidateRevision > currentRevision;

  const candidateCorrected = candidate.correctedAt ? Date.parse(candidate.correctedAt) : NaN;
  const currentCorrected = current.correctedAt ? Date.parse(current.correctedAt) : NaN;
  if (Number.isFinite(candidateCorrected) || Number.isFinite(currentCorrected)) {
    return (Number.isFinite(candidateCorrected) ? candidateCorrected : 0) >
      (Number.isFinite(currentCorrected) ? currentCorrected : 0);
  }
  return false;
}

/** Déduplique les événements par séance en gardant la version la plus récente. */
export function dedupeUsages(usages: ReadonlyArray<GearUsageEvent>): GearUsageEvent[] {
  const bySession = new Map<string, GearUsageEvent>();
  for (const usage of usages) {
    if (!usage || typeof usage.sessionId !== 'string' || !usage.sessionId) continue;
    const current = bySession.get(usage.sessionId);
    if (!current || isNewerUsage(usage, current)) bySession.set(usage.sessionId, usage);
  }
  return [...bySession.values()];
}

export interface ComputeGearMileageOptions {
  gearItemId?: string;
  /** Filtre de sport : les séances d'un autre sport connu sont exclues. */
  sport?: string | null;
  /** Horloge injectable pour les tests et les rejeux. */
  now?: number;
}

export function computeGearMileage(
  usages: ReadonlyArray<GearUsageEvent>,
  options: ComputeGearMileageOptions = {}
): GearMileage {
  const now = options.now ?? Date.now();
  const sportFilter = normalized(options.sport ?? null);
  const unique = dedupeUsages(usages).filter(
    (usage) => !options.gearItemId || usage.gearItemId === options.gearItemId
  );

  const summaries: GearUsageSummary[] = [];
  let totalKm = 0;
  let zeroDistanceSessions = 0;
  let missingDistanceSessions = 0;
  let ignoredSessions = 0;
  let sportUnknownSessions = 0;

  for (const usage of unique) {
    if (usage.removed === true) {
      ignoredSessions += 1;
      continue;
    }
    if (!isFinishedUsage(usage, now)) {
      ignoredSessions += 1;
      continue;
    }

    const usageSport = normalized(usage.sport);
    if (sportFilter && usageSport && usageSport !== sportFilter) {
      ignoredSessions += 1;
      continue;
    }

    const distance = finitePositive(usage.distanceKm);
    if (distance === null) {
      missingDistanceSessions += 1;
      continue;
    }
    if (distance === 0) {
      zeroDistanceSessions += 1;
      continue;
    }

    if (sportFilter && !usageSport) sportUnknownSessions += 1;
    totalKm += distance;
    summaries.push({
      sessionId: usage.sessionId,
      distanceKm: roundKm(distance),
      sport: usageSport || null,
    });
  }

  return {
    totalKm: roundKm(totalKm),
    sessionCount: summaries.length,
    zeroDistanceSessions,
    missingDistanceSessions,
    ignoredSessions,
    sportUnknownSessions,
    usages: summaries.sort((a, b) => a.sessionId.localeCompare(b.sessionId)),
  };
}

export interface MileageAlertInput {
  totalKm: number | null;
  thresholdKm: number | null;
  thresholdVersion: number;
  /** Dernière version de seuil déjà notifiée, `null` si aucune. */
  lastNotifiedVersion: number | null;
  /** Version de seuil explicitement écartée par l'utilisateur. */
  dismissedVersion: number | null;
}

/**
 * Alerte de seuil : une seule notification par version de seuil. Rejouer la
 * même séance ne change ni la version, ni le droit de notifier à nouveau.
 */
export function resolveMileageAlert(input: MileageAlertInput): GearMileageAlert {
  const { totalKm, thresholdKm } = input;
  if (totalKm === null || !Number.isFinite(totalKm)) {
    return { due: false, shouldNotify: false, remainingKm: null, progressPercent: null };
  }
  if (thresholdKm === null || !Number.isFinite(thresholdKm) || thresholdKm <= 0) {
    return { due: false, shouldNotify: false, remainingKm: null, progressPercent: null };
  }

  const version = Number.isFinite(input.thresholdVersion) ? input.thresholdVersion : 1;
  const due = totalKm >= thresholdKm;
  const notified = input.lastNotifiedVersion !== null && input.lastNotifiedVersion >= version;
  const dismissed = input.dismissedVersion !== null && input.dismissedVersion >= version;

  return {
    due,
    shouldNotify: due && !notified && !dismissed,
    remainingKm: roundKm(Math.max(0, thresholdKm - totalKm)),
    progressPercent: Math.min(100, Math.round((totalKm / thresholdKm) * 100)),
  };
}

/**
 * Kilométrage d'un composant : depuis son installation sur le vélo, ou figé
 * entre installation et remplacement. Un composant dont le point d'installation
 * est inconnu reste « non mesuré » plutôt que de repartir de zéro.
 */
export function componentMileage(
  component: Pick<GearComponent, 'installedAtKm' | 'replacedAtKm' | 'thresholdKm'>,
  gearTotalKm: number | null
): GearComponentMileage {
  const installed = finitePositive(component.installedAtKm);
  const replaced = finitePositive(component.replacedAtKm);
  const threshold = finitePositive(component.thresholdKm);

  if (installed === null) {
    return { km: null, due: false, remainingKm: null, progressPercent: null };
  }

  const end = replaced !== null ? replaced : gearTotalKm;
  if (end === null || !Number.isFinite(end)) {
    return { km: null, due: false, remainingKm: null, progressPercent: null };
  }

  const km = roundKm(Math.max(0, end - installed));
  if (threshold === null || threshold <= 0) {
    return { km, due: false, remainingKm: null, progressPercent: null };
  }

  return {
    km,
    due: km >= threshold,
    remainingKm: roundKm(Math.max(0, threshold - km)),
    progressPercent: Math.min(100, Math.round((km / threshold) * 100)),
  };
}

/** Nombre de séances éligibles, pour l'affichage « X sorties comptées ». */
export function eligibleSessionCount(usages: ReadonlyArray<GearUsageEvent>, options: ComputeGearMileageOptions = {}): number {
  return computeGearMileage(usages, options).sessionCount;
}
