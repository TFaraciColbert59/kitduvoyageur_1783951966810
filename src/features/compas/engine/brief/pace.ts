/**
 * Compas v6 — allure réelle d'une personne, tirée de ses sorties enregistrées
 * (SPEC-V6-MOTEUR §6 point 4, tâche T1.5).
 *
 * Module PUR : aucune I/O. Les sorties sont lues par `server/briefHistory.ts`.
 * Valeurs privées (source `historique`) : jamais rangées sur le voyage partagé (R5).
 */
import { emptyBrief, withValue, type Brief } from './schema';

export interface PaceSession {
  distanceKm: number | null;
  durationMin: number | null;
  elevationGainM: number | null;
  endedAt: string | null;
}

export interface RealPace {
  /** km/h sur le plat équivalent. */
  allureKmH: number;
  /** D+ tenu par heure, m/h ; null sans assez de sorties pentues. */
  deniveleParHeure: number | null;
  /** Nombre de sorties valides retenues. */
  sessions: number;
}

/** Plancher : en dessous, aucune allure n'est avancée. */
export const PACE_MIN_SESSIONS = 3;
/** Les dernières sorties valides retenues. */
export const PACE_WINDOW = 10;

/**
 * Règle de Naismith du dépôt : 1 h supplémentaire par 600 m de D+
 * (src/features/trips/planner/plannerEngine.ts:131-132, `dist / 4 + dPlus / 600`,
 * constante non exportée, valeur recopiée ici).
 */
const NAISMITH_M_PER_HOUR = 600;

const MIN_DISTANCE_KM = 1;
const MIN_DURATION_MIN = 10;
const MIN_SPEED_KMH = 1;
const MAX_SPEED_KMH = 20;
const STEEP_MIN_GAIN_M = 300;
const STEEP_MIN_SLOPE = 0.08;

interface ValidSession {
  distanceKm: number;
  durationH: number;
  gainM: number | null;
  time: number;
}

function num(x: number | null | undefined): number | null {
  return x != null && Number.isFinite(x) ? x : null;
}

function validate(s: PaceSession): ValidSession | null {
  const distanceKm = num(s.distanceKm);
  const durationMin = num(s.durationMin);
  if (distanceKm == null || durationMin == null) return null;
  if (distanceKm < MIN_DISTANCE_KM || durationMin < MIN_DURATION_MIN) return null;
  const durationH = durationMin / 60;
  const speed = distanceKm / durationH;
  if (speed < MIN_SPEED_KMH || speed > MAX_SPEED_KMH) return null;
  const g = num(s.elevationGainM);
  const t = s.endedAt != null ? Date.parse(s.endedAt) : NaN;
  return { distanceKm, durationH, gainM: g != null && g >= 0 ? g : null, time: Number.isFinite(t) ? t : -Infinity };
}

function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Vitesse sur le plat équivalent : le temps de montée (Naismith) est retiré de la durée. */
function flatSpeed(s: ValidSession): number {
  const rest = s.durationH - (s.gainM ?? 0) / NAISMITH_M_PER_HOUR;
  return rest > 0 ? s.distanceKm / rest : s.distanceKm / s.durationH;
}

/** null sous le plancher. */
export function realPace(sessions: readonly PaceSession[]): RealPace | null {
  const valid = sessions
    .map(validate)
    .filter((s): s is ValidSession => s != null)
    .sort((a, b) => b.time - a.time)
    .slice(0, PACE_WINDOW);
  if (valid.length < PACE_MIN_SESSIONS) return null;

  const allureKmH = clamp(Math.round(median(valid.map(flatSpeed)) * 10) / 10, 1, 20);

  const steep = valid.filter(
    (s) => s.gainM != null && s.gainM >= STEEP_MIN_GAIN_M && s.gainM / (s.distanceKm * 1000) >= STEEP_MIN_SLOPE
  );
  const deniveleParHeure =
    steep.length >= PACE_MIN_SESSIONS
      ? clamp(Math.round(median(steep.map((s) => (s.gainM as number) / s.durationH)) / 10) * 10, 50, 2000)
      : null;

  return { allureKmH, deniveleParHeure, sessions: valid.length };
}

/** Brief partiel : source `historique`, sans citation, non verrouillé. */
export function paceToBrief(pace: RealPace | null): Brief {
  let brief = emptyBrief();
  if (!pace) return brief;
  const confidence = pace.sessions >= 6 ? 0.8 : 0.6;
  const make = (value: number) => ({ value, source: 'historique' as const, confidence, evidence: null, locked: false, prive: true });
  brief = withValue(brief, 'qui.allureKmH', make(pace.allureKmH));
  if (pace.deniveleParHeure != null) brief = withValue(brief, 'qui.deniveleParHeure', make(pace.deniveleParHeure));
  return brief;
}
