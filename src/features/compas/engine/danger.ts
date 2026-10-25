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

import { formatIssuedUtc } from './meteoalarmFeeds';
import { engineT, type EngineT } from './engineI18n';
import { toIntlLocale, type Locale } from '@/lib/i18n/locale';
import type { AlertsStatus } from './officialAlerts';

import type { CompasDayPlan } from './compasModel';
import { tripDayLight } from './sun';
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
  /**
   * Texte officiel de l'alerte, tel que le service national l'a publié (langue
   * du flux, jamais reformulé). Meteoalarm exige qu'une alerte mise en forme
   * soit redonnée avec l'information officielle (conditions d'usage, § 5).
   */
  headline?: string | null;
  /** Page du service national pour cette alerte (`web` du flux), seulement si c'est une adresse https. */
  web?: string | null;
  /**
   * Textes officiels par langue du message (titre, description, consignes), tels
   * que le service les a publiés, nettoyés des caractères de contrôle et bornés
   * en longueur. Le Style Guide de Meteoalarm demande de les afficher dans
   * toutes les langues du message, sans les modifier.
   */
  texts?: OfficialAlertText[];
}

/** Le texte officiel d'une alerte dans UNE langue du message. */
export interface OfficialAlertText {
  /** Langue déclarée par le flux (BCP 47, ex. « de-DE »), vide si absente. */
  lang: string;
  headline: string | null;
  description: string | null;
  instruction: string | null;
}

export interface DangerSignal {
  id: string;
  axis: DangerAxis;
  severity: DangerSeverity;
  label: string;
  source: string;
  /** Date de la donnée (jour du voyage AAAA-MM-JJ, ou instant de lecture pour une alerte). */
  asOf: string;
  /** Alerte officielle : le texte du service national, par langue, à montrer avec le signal. */
  official?: { title: string; texts: OfficialAlertText[] };
  day?: number;
}

/** Ce que l'évaluation d'un axe a lu : une source et les jours (AAAA-MM-JJ) qu'elle couvre. */
export interface DangerEvidence {
  source: string;
  /** Premier et dernier jour lus ; null quand la source ne donne aucune date. */
  from: string | null;
  to: string | null;
}

export interface DangerAxisResult {
  level: AxisLevel;
  note: string;
  /**
   * Axe évalué EN PARTIE : ce qui n'a pas pu être vérifié (« dénivelé (J1, J2) »).
   * Un « RAS » ne vaut que pour ce qui a été mesuré ; null quand tout l'a été.
   */
  partial: string | null;
  /**
   * Les sources lues pour évaluer l'axe, chacune avec ses dates : de quoi dire d'où vient un
   * niveau « faible » (rien à signaler) aussi bien qu'un signal. Vide pour un axe non évalué ;
   * absent d'une évaluation faite avant ce champ.
   */
  evidence?: DangerEvidence[];
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

const ALERTS_GAP_KEY = {
  lues: null,
  partielles: 'compas.engine.danger.alertsPartial',
  pas_encore_publiees: 'compas.engine.danger.alertsNotYet',
  non_couvert: 'compas.engine.danger.alertsNoCover',
  zone_non_rapprochee: 'compas.engine.danger.alertsNoZone',
  indisponibles: 'compas.engine.danger.alertsAny',
} as const;

/**
 * Ce qu'un « rien à signaler » sur les alertes officielles ne couvre pas, ou null
 * si elles ont été lues. Statut absent : non lues, comme `assessDanger`.
 */
export const alertsGapOf = (status: AlertsStatus | undefined, locale: Locale = 'fr'): string | null => {
  const key = ALERTS_GAP_KEY[status ?? 'indisponibles'];
  return key ? engineT(locale)(key) : null;
};

const ALERT_SEVERITY: Record<OfficialAlert['level'], DangerSeverity> = {
  jaune: 'info',
  orange: 'warn',
  rouge: 'block',
};

/** Heure d'émission en UTC : le format français d'avant, ou `Intl` dans la langue. */
function utcStamp(iso: string | null | undefined, locale: Locale): string | null {
  if (locale === 'fr') return formatIssuedUtc(iso);
  if (typeof iso !== 'string' || !/T\d{2}:\d{2}/.test(iso)) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const text = new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(new Date(t));
  return `${text} UTC`;
}

const issued = (a: OfficialAlert, t: EngineT, locale: Locale): string => {
  const when = utcStamp(a.sent, locale);
  return when ? t('compas.engine.danger.issued', { when }) : '';
};

/** Où vérifier une alerte : le site du service national si le flux le donne en https, sinon Meteoalarm. */
function checkHost(a: OfficialAlert): string {
  try {
    const url = new URL(a.web ?? '');
    const host = url.hostname.replace(/^www\./, '');
    // Une adresse venue d'un tiers n'est citée que si c'est un nom de domaine simple en https.
    if (url.protocol === 'https:' && !url.username && !url.password && /^[a-z0-9.-]{3,100}$/.test(host)) return host;
  } catch {
    /* adresse absente ou illisible */
  }
  return 'meteoalarm.org';
}

/** « , valable du … au … » (UTC), ou rien si le flux ne donne pas les deux heures. */
const validity = (a: OfficialAlert, t: EngineT, locale: Locale): string => {
  const from = utcStamp(a.onset, locale);
  const to = utcStamp(a.expires, locale);
  return from && to ? t('compas.engine.danger.valid', { period: t('compas.engine.danger.period', { from, to }) }) : '';
};

const hhmm = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;

export function assessDanger(input: {
  dayPlans: CompasDayPlan[];
  forecasts: Array<{ day: number; date: string; forecast: DayForecast | null }>;
  alerts: OfficialAlert[];
  /** Ce que l'on sait des alertes officielles (absent : non lues). */
  alertsStatus?: AlertsStatus;
  /** Langue des textes (français par défaut : la sortie est alors celle d'avant). */
  locale?: Locale;
}): DangerAssessment {
  const locale = input.locale ?? 'fr';
  const t = engineT(locale);
  const stages = t('compas.engine.danger.sourceStages');
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
  // Ce qui a été lu, par axe et par source (jours couverts) : un niveau se cite avec sa source.
  const reads: Record<DangerAxis, Map<string, DangerEvidence>> = {
    physique: new Map(),
    technique: new Map(),
    conjoncturel: new Map(),
  };
  const read = (axis: DangerAxis, source: string, asOf: string | null | undefined) => {
    const day = asOf && /^\d{4}-\d{2}-\d{2}/.test(asOf) ? asOf.slice(0, 10) : null;
    const seen = reads[axis].get(source);
    if (!seen) return void reads[axis].set(source, { source, from: day, to: day });
    if (day && (!seen.from || day < seen.from)) seen.from = day;
    if (day && (!seen.to || day > seen.to)) seen.to = day;
  };
  // Aucune cotation du terrain n'existe dans les données du voyage.
  gap('technique', t('compas.engine.danger.gapGrading'));
  const alertsGap = alertsGapOf(input.alertsStatus, locale);
  if (alertsGap) gap('conjoncturel', alertsGap);

  for (const plan of input.dayPlans) {
    const f = forecastOf.get(plan.day);
    if (plan.walkMin == null) gap('physique', t('compas.engine.danger.gapWalk'), plan.day);
    if (plan.gainM == null) {
      gap('physique', t('compas.engine.danger.gapGain'), plan.day);
      gap('technique', t('compas.engine.danger.gapSlope'), plan.day);
    } else if (plan.distanceKm == null || plan.distanceKm <= 0) {
      gap('technique', t('compas.engine.danger.gapSlope'), plan.day);
    }
    if (plan.lossM == null) gap('technique', t('compas.engine.danger.gapLoss'), plan.day);
    if (!f?.forecast) {
      gap('physique', t('compas.engine.danger.gapHeatCold'), plan.day);
      gap('conjoncturel', t('compas.engine.danger.gapWeather'), plan.day);
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
        label: t('compas.engine.danger.dayLabel', { day: plan.day, label }),
        source,
        asOf: date,
        day: plan.day,
      });

    /* Physique : durée, dénivelé */
    if (plan.walkMin != null) {
      evaluated.physique = true;
      read('physique', 'DIN 33466', date);
      // Lever et coucher de la prévision ; au-delà, calcul astronomique à l'étape.
      const light = tripDayLight(f?.forecast, {
        lat: plan.lat,
        lon: plan.lon,
        date: date || null,
      });
      if (light != null && plan.walkMin > light.minutes) {
        push(
          'physique',
          'warn',
          t('compas.engine.danger.walkLight', { walk: hhmm(plan.walkMin), light: hhmm(light.minutes) }),
          light.from === 'prevision' ? 'DIN 33466 · MET Norway' : t('compas.engine.danger.sourceAstro'),
          'light'
        );
      } else if (plan.walkMin > T.longDayMin) {
        push('physique', 'warn', t('compas.engine.danger.walk', { walk: hhmm(plan.walkMin) }), 'DIN 33466', 'long');
      }
    }
    if (plan.gainM != null) {
      evaluated.physique = true;
      read('physique', stages, date);
      if (plan.gainM >= T.highGainM)
        push('physique', 'warn', t('compas.engine.danger.gain', { m: plan.gainM }), stages, 'gain');
    }

    /* Technique : pente moyenne, descente */
    if (plan.gainM != null && plan.distanceKm != null && plan.distanceKm > 0) {
      evaluated.technique = true;
      read('technique', stages, date);
      const slope = plan.gainM / (plan.distanceKm * 1000);
      if (slope >= T.steepAvgSlope)
        push(
          'technique',
          'warn',
          t('compas.engine.danger.slope', { pct: Math.round(slope * 100) }),
          stages,
          'slope'
        );
    }
    if (plan.lossM != null) {
      evaluated.technique = true;
      read('technique', stages, date);
      if (plan.lossM >= T.highLossM)
        push('technique', 'warn', t('compas.engine.danger.loss', { m: plan.lossM }), stages, 'loss');
    }

    /* Physique + conjoncturel : météo du jour */
    const fc = f?.forecast;
    if (!fc) continue;
    evaluated.conjoncturel = true;
    const src = 'MET Norway';
    read('conjoncturel', src, date);
    if (fc.tMax != null || fc.tMin != null) read('physique', src, date);
    if (fc.tMax != null && fc.tMax >= T.heatC) {
      evaluated.physique = true;
      push('physique', 'warn', t('compas.engine.danger.heat', { t: Math.round(fc.tMax) }), src, 'heat');
    }
    if (fc.tMin != null && fc.tMin <= T.coldC) {
      evaluated.physique = true;
      push('physique', 'warn', t('compas.engine.danger.cold', { t: Math.round(fc.tMin) }), src, 'cold');
    }
    if (fc.gustMax != null && fc.gustMax >= T.gustWarnKmh)
      push(
        'conjoncturel',
        fc.gustMax >= T.gustBlockKmh ? 'block' : 'warn',
        t('compas.engine.danger.gust', { v: Math.round(fc.gustMax) }),
        src,
        'gust'
      );
    if (fc.code != null && THUNDER_CODES.has(fc.code))
      push('conjoncturel', 'warn', t('compas.engine.danger.thunder'), src, 'thunder');
    if (fc.precipMm != null && fc.precipMm >= T.rainWarnMm)
      push('conjoncturel', 'warn', t('compas.engine.danger.rain', { mm: Math.round(fc.precipMm) }), src, 'rain');
  }

  /* Alertes officielles : lues telles quelles, datées, jamais reformulées en score */
  for (const a of input.alerts) {
    evaluated.conjoncturel = true;
    read('conjoncturel', a.source, a.sent ?? a.fetchedAt);
    const levelWord = t(a.level === 'jaune' ? 'compas.engine.danger.levelYellow' : a.level === 'orange' ? 'compas.engine.danger.levelOrange' : 'compas.engine.danger.levelRed');
    const title = t('compas.engine.danger.alertTitle', { level: levelWord, hazard: a.hazard, area: a.area });
    signals.push({
      id: `alert-${a.id}`,
      axis: 'conjoncturel',
      severity: a.updatedSince ? 'info' : ALERT_SEVERITY[a.level],
      // L'heure d'émission et le texte officiel voyagent avec l'alerte, où qu'elle
      // s'affiche (conditions de Meteoalarm, § 5).
      label: `${title}${issued(a, t, locale)}${validity(a, t, locale)}${
        a.updatedSince ? t('compas.engine.danger.updated', { host: checkHost(a) }) : ''
      }${a.headline ? t('compas.engine.danger.headline', { headline: a.headline }) : ''}`,
      source: a.source,
      asOf: a.sent ?? a.fetchedAt,
      ...(a.texts?.length ? { official: { title, texts: a.texts } } : {}),
    });
  }

  const rank: Record<DangerSeverity, number> = { info: 0, warn: 1, block: 2 };
  const partialOf = (axis: DangerAxis): string | null => {
    const parts = [...gaps[axis].entries()].map(([what, days]) =>
      days.length ? `${what} (${[...new Set(days)].map((d) => `J${d}`).join(', ')})` : what
    );
    return parts.length ? t('compas.engine.danger.unverified', { parts: parts.join(', ') }) : null;
  };
  const axisOf = (axis: DangerAxis, missing: string): DangerAxisResult => {
    if (!evaluated[axis]) return { level: 'non_evalue', note: missing, partial: null, evidence: [] };
    const worst = signals
      .filter((s) => s.axis === axis)
      .reduce<DangerSeverity | null>(
        (w, s) => (w == null || rank[s.severity] > rank[w] ? s.severity : w),
        null
      );
    const level: AxisLevel = worst === 'block' ? 'bloque' : worst === 'warn' ? 'vigilance' : 'ok';
    return { level, note: '', partial: partialOf(axis), evidence: [...reads[axis].values()] };
  };

  return {
    axes: {
      physique: axisOf('physique', t('compas.engine.danger.notePhysical')),
      technique: axisOf('technique', t('compas.engine.danger.noteTechnical')),
      conjoncturel: axisOf('conjoncturel', t('compas.engine.danger.noteSituational')),
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
