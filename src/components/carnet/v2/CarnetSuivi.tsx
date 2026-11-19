'use client';

/**
 * Lentille « Suivre » de la fiche carnet v2 — briques additives du lot L2.
 *
 * Trois composants **purs** (aucun fetch, aucun état interne) qui complètent la
 * lentille « Suivre » sans la réécrire. Ils reçoivent les données déjà chargées
 * par la fiche (`CarnetDetail`) et ne fabriquent rien : sans date ni donnée, un
 * bloc ne s'affiche pas plutôt que d'inventer une valeur (règle de la fiche).
 *
 * - `CarnetProgression` : statut dérivé des dates (préparation / en route /
 *   rentré), barre fine et kilomètres faits / prévus, `role="progressbar"`.
 * - `CarnetBeats` : « Battements », un trait par moment groupé par jour ; le
 *   jour actif passe en forest (--tint), un jour sans moment garde un trait court.
 * - `CarnetEveningSummary` : « Résumé du soir » du dernier jour terminé qui a
 *   des moments (chiffres, nuit, photo phare) ; rien à résumer, rien rendu.
 *
 * L'intégration dans le tiroir est faite par le Lead : ces composants ne
 * modifient ni `CarnetDrawerV2.tsx` ni `CarnetScreenV2.tsx`.
 */
import type { CSSProperties } from 'react';
import { ChevronRight, Moon } from 'lucide-react';
import AppImage from '@/components/ui/AppImage';
import { resolveDayStats } from '@/features/carnet/detail/dayView';
import type {
  CarnetDay,
  CarnetDetail,
  CarnetMomentItem,
  CarnetNightItem,
} from '@/features/carnet/detail/types';
import '@/styles/carnet-suivi.css';

const DAY_MS = 86_400_000;
const BEAT_COLUMN_PX = 44;
const BEAT_GAP_PX = 4;

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** `YYYY-MM-DD` → minuit UTC du jour civil ; `null` si absent ou illisible. */
function isoStamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Minuit UTC du jour civil local de `now` : les deux horodatages comparés
 * (date du carnet, « maintenant ») sont alors des jours civils, sans heure.
 */
function civilStamp(now?: Date | number): number {
  const date = now instanceof Date ? now : new Date(now ?? Date.now());
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatKm(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

function formatInt(value: number): string {
  return Math.round(value).toLocaleString('fr-FR');
}

/** « 1 jour » / « 3 jours » — jamais « 3 jour ». */
function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Progression — statut dérivé des dates, km faits / prévus, barre fine
   ═══════════════════════════════════════════════════════════════════════════ */

export type CarnetProgressionState = 'preparation' | 'en_route' | 'rentre';

export interface CarnetProgressionProps {
  detail: Pick<
    CarnetDetail,
    'startDate' | 'endDate' | 'summary' | 'days' | 'etapes' | 'distanceKm'
  >;
  /** Instant de référence ; par défaut, maintenant (tiroir monté côté client). */
  now?: Date | number;
  className?: string;
}

interface ProgressionInfo {
  state: CarnetProgressionState;
  totalDays: number;
  /** Jour courant (1..totalDays) quand le carnet est en route, sinon `null`. */
  dayNumber: number | null;
  daysUntil: number | null;
}

interface ProgressionKm {
  doneKm: number | null;
  totalKm: number | null;
}

function totalDaysOf(detail: CarnetProgressionProps['detail']): number {
  if (detail.summary.days > 0) return detail.summary.days;
  const lastDay = detail.days.reduce(
    (max, day) => Math.max(max, day.dayNumber ?? day.index),
    0,
  );
  if (lastDay > 0) return lastDay;
  const start = isoStamp(detail.startDate);
  const end = isoStamp(detail.endDate);
  if (start !== null && end !== null && end >= start) {
    return Math.round((end - start) / DAY_MS) + 1;
  }
  return 1;
}

function deriveProgression(
  detail: CarnetProgressionProps['detail'],
  nowStamp: number,
): ProgressionInfo | null {
  const start = isoStamp(detail.startDate);
  /* Sans date de départ, aucun statut n'est dérivable : on ne rend rien. */
  if (start === null) return null;
  const totalDays = totalDaysOf(detail);
  const end = isoStamp(detail.endDate);
  const lastStamp = end !== null && end >= start ? end : start + (totalDays - 1) * DAY_MS;

  if (nowStamp < start) {
    return {
      state: 'preparation',
      totalDays,
      dayNumber: null,
      daysUntil: Math.max(1, Math.round((start - nowStamp) / DAY_MS)),
    };
  }
  if (nowStamp > lastStamp) {
    return { state: 'rentre', totalDays, dayNumber: null, daysUntil: null };
  }
  const dayNumber = Math.min(
    totalDays,
    Math.max(1, Math.floor((nowStamp - start) / DAY_MS) + 1),
  );
  return { state: 'en_route', totalDays, dayNumber, daysUntil: null };
}

/** Somme des valeurs connues ; `null` dès qu'aucune distance n'est renseignée. */
function sumKnown(values: Array<number | null>): number | null {
  let sum = 0;
  let seen = false;
  for (const value of values) {
    if (value !== null && Number.isFinite(value) && value > 0) {
      sum += value;
      seen = true;
    }
  }
  return seen ? sum : null;
}

function deriveProgressionKm(
  detail: CarnetProgressionProps['detail'],
  info: ProgressionInfo,
): ProgressionKm {
  const stats = resolveDayStats({ days: detail.days, etapes: detail.etapes });
  const declared = detail.summary.distanceKm ?? detail.distanceKm ?? null;
  const totalKm = declared ?? sumKnown(stats.map((stat) => stat.distanceKm));
  if (totalKm === null) return { doneKm: null, totalKm: null };
  if (info.state === 'preparation') return { doneKm: 0, totalKm };
  if (info.state === 'rentre') return { doneKm: totalKm, totalKm };
  const currentDay = info.dayNumber ?? 1;
  const doneKm = sumKnown(
    stats.filter((stat) => stat.dayNumber < currentDay).map((stat) => stat.distanceKm),
  );
  return { doneKm, totalKm };
}

function progressPercent(info: ProgressionInfo, km: ProgressionKm): number {
  if (info.state === 'preparation') return 0;
  if (info.state === 'rentre') return 100;
  if (km.doneKm !== null && km.totalKm !== null && km.totalKm > 0) {
    /* Cap à 99 tant que le voyage n'est pas terminé : la barre ne ment pas. */
    return Math.min(99, Math.max(0, Math.round((km.doneKm / km.totalKm) * 100)));
  }
  const currentDay = info.dayNumber ?? 1;
  return Math.min(
    99,
    Math.max(0, Math.round(((currentDay - 1) / Math.max(1, info.totalDays)) * 100)),
  );
}

function progressionStatusLabel(info: ProgressionInfo): string {
  if (info.state === 'preparation') return `Départ dans ${info.daysUntil ?? 0} j`;
  if (info.state === 'rentre') return `Rentré · ${countLabel(info.totalDays, 'jour')}`;
  return `Jour ${info.dayNumber ?? 1}/${info.totalDays}`;
}

function progressionKmText(info: ProgressionInfo, km: ProgressionKm): string | null {
  if (km.totalKm === null) return null;
  if (info.state === 'rentre') return `${formatKm(km.totalKm)} km`;
  if (km.doneKm === null) return null;
  return `${formatKm(km.doneKm)} / ${formatKm(km.totalKm)} km`;
}

/** Texte lu par le lecteur d'écran à la place du seul pourcentage. */
function progressionValueText(
  info: ProgressionInfo,
  km: ProgressionKm,
  percent: number,
): string {
  if (info.state === 'preparation') {
    return `${countLabel(info.daysUntil ?? 0, 'jour')} avant le départ, ${percent} %`;
  }
  if (info.state === 'rentre') {
    const kmText = km.totalKm !== null ? `, ${formatKm(km.totalKm)} kilomètres` : '';
    return `Voyage terminé · ${countLabel(info.totalDays, 'jour')}${kmText}`;
  }
  const head = `Jour ${info.dayNumber ?? 1} sur ${info.totalDays}`;
  if (km.doneKm !== null && km.totalKm !== null) {
    return `${head}, ${formatKm(km.doneKm)} kilomètres sur ${formatKm(km.totalKm)}`;
  }
  return `${head}, ${percent} %`;
}

export function CarnetProgression({ detail, now, className }: CarnetProgressionProps) {
  const info = deriveProgression(detail, civilStamp(now));
  if (info === null) return null;

  const km = deriveProgressionKm(detail, info);
  const percent = progressPercent(info, km);
  const kmText = progressionKmText(info, km);

  return (
    <div className={cx('lkdv-suivi-prog', className)}>
      <div className="lkdv-suivi-prog-head">
        <span className="lkdv-suivi-eyebrow">Progression</span>
        <span className="lkdv-suivi-prog-state" data-state={info.state}>
          {info.state === 'en_route' ? (
            <span className="lkdv-suivi-prog-dot" aria-hidden="true" />
          ) : null}
          {progressionStatusLabel(info)}
        </span>
      </div>
      <div
        className="lkdv-suivi-prog-track"
        role="progressbar"
        aria-label="Progression du voyage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={progressionValueText(info, km, percent)}
      >
        <span
          className="lkdv-suivi-prog-fill"
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="lkdv-suivi-prog-metrics">
        <span className="lkdv-suivi-prog-km">{kmText ?? ''}</span>
        <span className="lkdv-suivi-prog-pct">{`${percent} %`}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Battements — un trait par moment, groupés par jour
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CarnetBeatsProps {
  detail: Pick<CarnetDetail, 'days' | 'moments'>;
  /** Jour mis en avant (forest), 0 = aucun. C'est le jour actif de la fiche. */
  activeDay?: number;
  /** Fourni : chaque jour devient une cible cliquable et clavier. */
  onSelectDay?: (dayNumber: number) => void;
  className?: string;
}

interface BeatDay {
  dayNumber: number;
  /** Nombre de moments du jour ; 0 = trait court. */
  count: number;
}

/** Une entrée par jour, dans l'ordre du carnet (repli sur les moments seuls). */
function collectBeatDays(detail: CarnetBeatsProps['detail']): BeatDay[] {
  if (detail.days.length > 0) {
    return detail.days
      .map((day) => ({
        dayNumber: day.dayNumber ?? day.index,
        count: day.moments.length,
      }))
      .sort((a, b) => a.dayNumber - b.dayNumber);
  }
  const counts = new Map<number, number>();
  for (const moment of detail.moments) {
    const dayNumber = moment.dayNumber;
    if (!Number.isFinite(dayNumber)) continue;
    counts.set(dayNumber, (counts.get(dayNumber) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayNumber, count]) => ({ dayNumber, count }));
}

/** Hauteur déterministe (34–94 %) : même jour, même trait à chaque rendu. */
function beatHeight(dayNumber: number, index: number): number {
  return 34 + ((dayNumber * 37 + index * 53 + 11) % 61);
}

function beatsLabel(days: BeatDay[]): string {
  const moments = days.reduce((sum, day) => sum + day.count, 0);
  return `Battements du voyage : ${countLabel(days.length, 'jour')}, ${countLabel(moments, 'moment')}`;
}

function beatDayLabel(day: BeatDay): string {
  return day.count > 0
    ? `Jour ${day.dayNumber}, ${countLabel(day.count, 'moment')}`
    : `Jour ${day.dayNumber}, aucun moment`;
}

export function CarnetBeats({
  detail,
  activeDay = 0,
  onSelectDay,
  className,
}: CarnetBeatsProps) {
  const days = collectBeatDays(detail);
  if (days.length === 0) return null;

  const plotStyle: CSSProperties = {
    ['--lkdv-suivi-beats' as string]: days.length,
    minWidth: `${days.length * BEAT_COLUMN_PX + (days.length - 1) * BEAT_GAP_PX}px`,
  };

  return (
    <div className={cx('lkdv-suivi-beats', className)}>
      <span className="lkdv-suivi-eyebrow">Battements · un trait par moment</span>
      <div className="lkdv-suivi-beats-scroll">
        <div className="lkdv-suivi-beats-plot" style={plotStyle}>
          <div className="lkdv-suivi-beats-chart" role="img" aria-label={beatsLabel(days)}>
            {days.map((day) => (
              <span
                key={day.dayNumber}
                className="lkdv-suivi-beats-day"
                data-active={day.dayNumber === activeDay ? 'true' : undefined}
              >
                {day.count > 0 ? (
                  Array.from({ length: day.count }, (_, index) => (
                    <i
                      key={index}
                      className="lkdv-suivi-beat"
                      style={{ height: `${beatHeight(day.dayNumber, index)}%` }}
                      aria-hidden="true"
                    />
                  ))
                ) : (
                  <i className="lkdv-suivi-beat is-empty" aria-hidden="true" />
                )}
              </span>
            ))}
          </div>
          {onSelectDay ? (
            <div className="lkdv-suivi-beats-hits">
              {days.map((day) => (
                <button
                  key={day.dayNumber}
                  type="button"
                  className="lkdv-suivi-beats-hit"
                  aria-label={beatDayLabel(day)}
                  aria-current={day.dayNumber === activeDay ? 'true' : undefined}
                  onClick={() => onSelectDay(day.dayNumber)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Résumé du soir — dernier jour terminé qui a des moments
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CarnetEveningSummaryProps {
  detail: Pick<
    CarnetDetail,
    'startDate' | 'endDate' | 'days' | 'moments' | 'nights' | 'etapes'
  >;
  /** Instant de référence ; par défaut, maintenant (tiroir monté côté client). */
  now?: Date | number;
  /** Fourni : un bouton « Ouvrir le jour J{n} » est rendu. */
  onOpenDay?: (dayNumber: number) => void;
  className?: string;
}

interface EveningSummary {
  dayNumber: number;
  day: CarnetDay;
  km: number | null;
  elevationM: number | null;
  night: CarnetNightItem | null;
  photo: (CarnetMomentItem & { imageUrl: string }) | null;
}

const NIGHT_TYPE_LABELS: Record<CarnetNightItem['type'], string | null> = {
  refuge: 'Refuge',
  gite: 'Gîte',
  bivouac: 'Bivouac',
  hotel: 'Hôtel',
  camping: 'Camping',
  autre: null,
};

/**
 * Dernier jour **terminé** du carnet. La date du jour commande ; sans date par
 * jour, la date de fin passée suffit à dire que le voyage est terminé.
 */
function lastCompletedDay(
  detail: CarnetEveningSummaryProps['detail'],
  nowStamp: number,
): { day: CarnetDay; dayNumber: number } | null {
  if (detail.days.length === 0) return null;
  const start = isoStamp(detail.startDate);
  const datedDays = detail.days
    .map((day) => {
      const dayNumber = day.dayNumber ?? day.index;
      const stamp =
        isoStamp(day.date) ?? (start !== null ? start + (dayNumber - 1) * DAY_MS : null);
      return { day, dayNumber, stamp };
    })
    .sort((a, b) => a.dayNumber - b.dayNumber);

  const completed = datedDays.filter((item) => item.stamp !== null && item.stamp < nowStamp);
  if (completed.length > 0) {
    const last = completed[completed.length - 1];
    return { day: last.day, dayNumber: last.dayNumber };
  }
  const end = isoStamp(detail.endDate);
  if (end !== null && end < nowStamp) {
    const last = datedDays[datedDays.length - 1];
    return last ? { day: last.day, dayNumber: last.dayNumber } : null;
  }
  return null;
}

function deriveEveningSummary(
  detail: CarnetEveningSummaryProps['detail'],
  nowStamp: number,
): EveningSummary | null {
  const last = lastCompletedDay(detail, nowStamp);
  /* Le résumé du soir est celui du dernier jour terminé : s'il n'a rien à
     raconter, on ne rend rien (aucun état vide inventé dans le tiroir). */
  if (last === null || last.day.moments.length === 0) return null;

  const dayStats = resolveDayStats({ days: detail.days, etapes: detail.etapes }).find(
    (stat) => stat.dayNumber === last.dayNumber,
  );
  const night =
    (detail.nights ?? []).find((item) => item.dayNumber === last.dayNumber) ?? null;
  const photo =
    last.day.moments.find(
      (moment): moment is CarnetMomentItem & { imageUrl: string } =>
        Boolean(moment.imageUrl),
    ) ?? null;

  return {
    dayNumber: last.dayNumber,
    day: last.day,
    km: dayStats?.distanceKm ?? last.day.distanceKm ?? null,
    elevationM: dayStats?.elevationM ?? last.day.elevationM ?? null,
    night,
    photo,
  };
}

function photoAlt(photo: CarnetMomentItem, dayNumber: number): string {
  return (
    photo.title?.trim() ||
    photo.caption?.trim() ||
    photo.place?.trim() ||
    `Photo du jour ${dayNumber}`
  );
}

export function CarnetEveningSummary({
  detail,
  now,
  onOpenDay,
  className,
}: CarnetEveningSummaryProps) {
  const summary = deriveEveningSummary(detail, civilStamp(now));
  if (summary === null) return null;

  const metrics = [
    summary.km !== null ? `${formatKm(summary.km)} km` : null,
    summary.elevationM !== null ? `+${formatInt(summary.elevationM)} m` : null,
    countLabel(summary.day.moments.length, 'moment'),
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

  const nightType = summary.night ? NIGHT_TYPE_LABELS[summary.night.type] : null;
  const nightAltitude =
    summary.night?.altitudeM != null ? `${formatInt(summary.night.altitudeM)} m` : null;

  return (
    <section
      className={cx('lkdv-suivi-evening', className)}
      aria-label={`Résumé du soir, jour ${summary.dayNumber}`}
    >
      <span className="lkdv-suivi-eyebrow">Résumé du soir</span>
      <div className="lkdv-suivi-evening-body">
        {summary.photo ? (
          <div className="lkdv-suivi-evening-photo">
            <AppImage
              src={summary.photo.imageUrl}
              alt={photoAlt(summary.photo, summary.dayNumber)}
              width={56}
              height={56}
              className="lkdv-suivi-evening-photo-img"
            />
          </div>
        ) : null}
        <div className="lkdv-suivi-evening-copy">
          <h3 className="lkdv-suivi-evening-title">J{summary.dayNumber}</h3>
          <p className="lkdv-suivi-evening-metrics">{metrics}</p>
          {summary.night ? (
            <p className="lkdv-suivi-evening-night">
              <Moon size={12} aria-hidden="true" />
              <span className="lkdv-suivi-evening-night-name">{summary.night.name}</span>
              {nightType ? (
                <span className="lkdv-suivi-evening-night-type">{nightType}</span>
              ) : null}
              {nightAltitude ? (
                <span className="lkdv-suivi-evening-night-alt">{nightAltitude}</span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
      {onOpenDay ? (
        <button
          type="button"
          className="lkdv-suivi-evening-cta"
          onClick={() => onOpenDay(summary.dayNumber)}
        >
          <span>Ouvrir le jour {summary.dayNumber}</span>
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}
