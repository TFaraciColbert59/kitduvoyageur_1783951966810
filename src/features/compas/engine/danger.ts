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

import type { AlertsStatus } from './officialAlerts';

import type { CompasDayPlan } from './compasModel';
import { clockMinutes } from './sun';
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
  /** Émission de l'alerte par le service officiel (ISO). */
  sent?: string | null;
  /**
   * Une mise à jour plus récente existe sans nouvelle alerte qui la remplace :
   * l'état actuel n'est pas connu, l'alerte reste affichée « à vérifier ».
   */
  updatedSince?: string | null;
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

export interface DangerAxisResult {
  level: AxisLevel;
  note: string;
  /**
   * Axe évalué EN PARTIE : ce qui n'a pas pu être vérifié (« dénivelé (J1, J2) »).
   * Un « RAS » ne vaut que pour ce qui a été mesuré ; null quand tout l'a été.
   */
  partial: string | null;
}

export interface DangerAssessment {
  axes: Record<DangerAxis, DangerAxisResult>;
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

/** Ce qu'un « RAS » conjoncturel ne couvre pas, selon l'état des alertes officielles. */
const ALERTS_GAP: Record<AlertsStatus, string | null> = {
  lues: null,
  pas_encore_publiees: 'alertes officielles (publiées la veille du départ)',
  hors_france: 'alertes officielles (hors France, non couvertes)',
  indisponibles: 'alertes officielles',
};

const ALERT_SEVERITY: Record<OfficialAlert['level'], DangerSeverity> = {
  jaune: 'info',
  orange: 'warn',
  rouge: 'block',
};

const hhmm = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;

/** Durée du jour entre lever et coucher (« HH:MM » ou ISO), en minutes ; null si illisible. */
function minutesBetween(a: string | null, b: string | null): number | null {
  const ta = clockMinutes(a);
  const tb = clockMinutes(b);
  return ta != null && tb != null && tb > ta ? tb - ta : null;
}

export function assessDanger(input: {
  dayPlans: CompasDayPlan[];
  forecasts: Array<{ day: number; date: string; forecast: DayForecast | null }>;
  alerts: OfficialAlert[];
  /** Ce que l'on sait des alertes officielles (absent : non lues). */
  alertsStatus?: AlertsStatus;
}): DangerAssessment {
  const T = DANGER_THRESHOLDS;
  const signals: DangerSignal[] = [];
  const forecastOf = new Map(input.forecasts.map((f) => [f.day, f]));
  const evaluated = { physique: false, technique: false, conjoncturel: false };
  // Ce qui manque, par axe, et pour quels jours : un « RAS » n'est jamais
  // affiché sans dire ce qu'il ne couvre pas.
  const gaps: Record<DangerAxis, Map<string, number[]>> = {
    physique: new Map(),
    technique: new Map(),
    conjoncturel: new Map(),
  };
  const gap = (axis: DangerAxis, what: string, day?: number) => {
    const days = gaps[axis].get(what) ?? [];
    if (day != null) days.push(day);
    gaps[axis].set(what, days);
  };
  // Aucune cotation du terrain n'existe dans les données du voyage.
  gap('technique', 'cotation du terrain');
  const alertsGap = ALERTS_GAP[input.alertsStatus ?? 'indisponibles'];
  if (alertsGap) gap('conjoncturel', alertsGap);

  for (const plan of input.dayPlans) {
    const f = forecastOf.get(plan.day);
    if (plan.walkMin == null) gap('physique', 'durée de marche', plan.day);
    if (plan.gainM == null) {
      gap('physique', 'dénivelé', plan.day);
      gap('technique', 'pente', plan.day);
    } else if (plan.distanceKm == null || plan.distanceKm <= 0) {
      gap('technique', 'pente', plan.day);
    }
    if (plan.lossM == null) gap('technique', 'descente', plan.day);
    if (!f?.forecast) {
      gap('physique', 'chaleur et froid', plan.day);
      gap('conjoncturel', 'météo', plan.day);
    }
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
          'DIN 33466 · MET Norway',
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
    const src = 'MET Norway';
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
      severity: a.updatedSince ? 'info' : ALERT_SEVERITY[a.level],
      label: `Vigilance ${a.level} · ${a.hazard} (${a.area})${
        a.updatedSince ? ' — mise à jour depuis, à vérifier sur vigilance.meteofrance.fr' : ''
      }`,
      source: a.source,
      asOf: a.sent ?? a.fetchedAt,
    });
  }

  const rank: Record<DangerSeverity, number> = { info: 0, warn: 1, block: 2 };
  const partialOf = (axis: DangerAxis): string | null => {
    const parts = [...gaps[axis].entries()].map(([what, days]) =>
      days.length ? `${what} (${[...new Set(days)].map((d) => `J${d}`).join(', ')})` : what
    );
    return parts.length ? `Non vérifié : ${parts.join(', ')}.` : null;
  };
  const axisOf = (axis: DangerAxis, missing: string): DangerAxisResult => {
    if (!evaluated[axis]) return { level: 'non_evalue', note: missing, partial: null };
    const worst = signals
      .filter((s) => s.axis === axis)
      .reduce<DangerSeverity | null>(
        (w, s) => (w == null || rank[s.severity] > rank[w] ? s.severity : w),
        null
      );
    const level: AxisLevel = worst === 'block' ? 'bloque' : worst === 'warn' ? 'vigilance' : 'ok';
    return { level, note: '', partial: partialOf(axis) };
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
