/**
 * Compas — danger en trois axes (fonction pure).
 *
 * Règles LKDV : pas de score magique. Chaque signal porte sa SOURCE et sa DATE.
 * Un axe sans donnée n'est pas « sans danger » : il est « non évalué » et
 * l'écran le dit. Seules des alertes officielles rouges ou des seuils de
 * sécurité franchis bloquent ; le reste est de la vigilance.
 *
 * - physique       : l'effort demandé au groupe (durée, dénivelé, chaleur, froid).
 * - technique      : la difficulté du terrain (pente, descente).
 * - conjoncturel   : ce qui change avec le jour (vent, orage, pluie, alertes).
 */

import type { CompasDayPlan } from './compasModel';
import type { DayForecast } from './weather';

export type DangerAxis = 'physique' | 'technique' | 'conjoncturel';
export type DangerSeverity = 'info' | 'warn' | 'block';
export type AxisLevel = 'ok' | 'vigilance' | 'bloque' | 'non_evalue';

export interface OfficialAlert {
  id: string;
  /** Émetteur (ex. « Météo-France via Meteoalarm »). */
  source: string;
  hazard: string;
  level: 'jaune' | 'orange' | 'rouge';
  area: string;
  onset: string | null;
  expires: string | null;
  /** Instant de lecture du flux (ISO). */
  fetchedAt: string;
}

export interface DangerSignal {
  id: string;
  axis: DangerAxis;
  severity: DangerSeverity;
  label: string;
  source: string;
  /** Date de la donnée (jour du voyage AAAA-MM-JJ, ou instant de lecture pour une alerte). */
  asOf: string;
  day?: number;
}

export interface DangerAssessment {
  axes: Record<DangerAxis, { level: AxisLevel; note: string }>;
  signals: DangerSignal[];
}

/** Seuils par défaut, documentés pour être discutés (aucun n'est une norme légale). */
export const DANGER_THRESHOLDS = {
  /** Marche au-delà de laquelle l'effort journalier est signalé (min). */
  longDayMin: 600,
  /** Dénivelé positif journalier signalé (m). */
  highGainM: 1200,
  /** Descente journalière signalée (m). */
  highLossM: 1500,
  /** Pente moyenne signalée (dénivelé positif / distance). */
  steepAvgSlope: 0.15,
  heatC: 32,
  coldC: -5,
  gustWarnKmh: 60,
  gustBlockKmh: 90,
  rainWarnMm: 20,
} as const;

const THUNDER_CODES = new Set([95, 96, 99]);

const ALERT_SEVERITY: Record<OfficialAlert['level'], DangerSeverity> = {
  jaune: 'info',
  orange: 'warn',
  rouge: 'block',
};

const hhmm = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;

function minutesBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  return Number.isFinite(ta) && Number.isFinite(tb) && tb > ta
    ? Math.round((tb - ta) / 60000)
    : null;
}

export function assessDanger(input: {
  dayPlans: CompasDayPlan[];
  forecasts: Array<{ day: number; date: string; forecast: DayForecast | null }>;
  alerts: OfficialAlert[];
}): DangerAssessment {
  const T = DANGER_THRESHOLDS;
  const signals: DangerSignal[] = [];
  const forecastOf = new Map(input.forecasts.map((f) => [f.day, f]));
  const evaluated = { physique: false, technique: false, conjoncturel: false };

  for (const plan of input.dayPlans) {
    const f = forecastOf.get(plan.day);
    const date = plan.date ?? f?.date ?? '';
    const push = (
      axis: DangerAxis,
      severity: DangerSeverity,
      label: string,
      source: string,
      suffix: string
    ) =>
      signals.push({
        id: `${axis}-${suffix}-${plan.day}`,
        axis,
        severity,
        label: `Jour ${plan.day} : ${label}`,
        source,
        asOf: date,
        day: plan.day,
      });

    /* Physique : durée, dénivelé */
    if (plan.walkMin != null) {
      evaluated.physique = true;
      const light = minutesBetween(f?.forecast?.sunrise ?? null, f?.forecast?.sunset ?? null);
      if (light != null && plan.walkMin > light) {
        push(
          'physique',
          'warn',
          `${hhmm(plan.walkMin)} de marche pour ${hhmm(light)} de jour`,
          'DIN 33466 · Open-Meteo',
          'light'
        );
      } else if (plan.walkMin > T.longDayMin) {
        push('physique', 'warn', `${hhmm(plan.walkMin)} de marche`, 'DIN 33466', 'long');
      }
    }
    if (plan.gainM != null) {
      evaluated.physique = true;
      if (plan.gainM >= T.highGainM)
        push('physique', 'warn', `${plan.gainM} m de montée`, 'étapes du voyage', 'gain');
    }

    /* Technique : pente moyenne, descente */
    if (plan.gainM != null && plan.distanceKm != null && plan.distanceKm > 0) {
      evaluated.technique = true;
      const slope = plan.gainM / (plan.distanceKm * 1000);
      if (slope >= T.steepAvgSlope)
        push(
          'technique',
          'warn',
          `pente moyenne ${Math.round(slope * 100)} %`,
          'étapes du voyage',
          'slope'
        );
    }
    if (plan.lossM != null) {
      evaluated.technique = true;
      if (plan.lossM >= T.highLossM)
        push('technique', 'warn', `${plan.lossM} m de descente`, 'étapes du voyage', 'loss');
    }

    /* Physique + conjoncturel : météo du jour */
    const fc = f?.forecast;
    if (!fc) continue;
    evaluated.conjoncturel = true;
    const src = 'Open-Meteo';
    if (fc.tMax != null && fc.tMax >= T.heatC) {
      evaluated.physique = true;
      push('physique', 'warn', `chaleur (${Math.round(fc.tMax)} °C)`, src, 'heat');
    }
    if (fc.tMin != null && fc.tMin <= T.coldC) {
      evaluated.physique = true;
      push('physique', 'warn', `froid (${Math.round(fc.tMin)} °C)`, src, 'cold');
    }
    if (fc.gustMax != null && fc.gustMax >= T.gustWarnKmh)
      push(
        'conjoncturel',
        fc.gustMax >= T.gustBlockKmh ? 'block' : 'warn',
        `rafales à ${Math.round(fc.gustMax)} km/h`,
        src,
        'gust'
      );
    if (fc.code != null && THUNDER_CODES.has(fc.code))
      push('conjoncturel', 'warn', 'orages annoncés', src, 'thunder');
    if (fc.precipMm != null && fc.precipMm >= T.rainWarnMm)
      push('conjoncturel', 'warn', `forte pluie (${Math.round(fc.precipMm)} mm)`, src, 'rain');
  }

  /* Alertes officielles : lues telles quelles, datées, jamais reformulées en score */
  for (const a of input.alerts) {
    evaluated.conjoncturel = true;
    signals.push({
      id: `alert-${a.id}`,
      axis: 'conjoncturel',
      severity: ALERT_SEVERITY[a.level],
      label: `Vigilance ${a.level} · ${a.hazard} (${a.area})`,
      source: a.source,
      asOf: a.fetchedAt,
    });
  }

  const rank: Record<DangerSeverity, number> = { info: 0, warn: 1, block: 2 };
  const axisOf = (axis: DangerAxis, missing: string) => {
    if (!evaluated[axis]) return { level: 'non_evalue' as const, note: missing };
    const worst = signals
      .filter((s) => s.axis === axis)
      .reduce<DangerSeverity | null>(
        (w, s) => (w == null || rank[s.severity] > rank[w] ? s.severity : w),
        null
      );
    const level: AxisLevel = worst === 'block' ? 'bloque' : worst === 'warn' ? 'vigilance' : 'ok';
    return { level, note: '' };
  };

  return {
    axes: {
      physique: axisOf('physique', 'Durée et dénivelé des étapes inconnus.'),
      technique: axisOf(
        'technique',
        'Cotation et pente du terrain non disponibles : axe non évalué.'
      ),
      conjoncturel: axisOf('conjoncturel', 'Aucune prévision ni alerte disponible.'),
    },
    signals,
  };
}

/** Intègre le danger au verdict existant : un blocage ou une vigilance ne s'efface jamais. */
export function mergeDangerIntoVerdict<
  V extends {
    level: 'go' | 'vigilance' | 'bloque' | 'incomplet';
    reasons: Array<{ label: string; severity: DangerSeverity; source: string }>;
  },
>(verdict: V, danger: DangerAssessment): V {
  const added = danger.signals
    .filter((s) => s.severity !== 'info')
    .map((s) => ({ label: s.label, severity: s.severity, source: s.source }));
  const reasons = [...verdict.reasons, ...added];
  let level = verdict.level;
  if (added.some((r) => r.severity === 'block')) level = 'bloque';
  else if (added.length && level === 'go') level = 'vigilance';
  return { ...verdict, level, reasons };
}
