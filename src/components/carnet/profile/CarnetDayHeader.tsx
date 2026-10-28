'use client';

import React from 'react';
import type { CarnetStatsTab } from '@/features/carnet/detail/stats';
import type { CarnetDay, CarnetDetail } from '@/features/carnet/detail/types';
import {
  formatDayLabel,
  formatDuration,
  formatElevation,
  formatKm,
} from '@/features/carnet/detail/format';

/** Une cellule de la rangée de statistiques : même gabarit sur les deux pages. */
export interface CarnetDayStat {
  /** Onglet du sous-drawer statistiques ouvert au clic. */
  tab: CarnetStatsTab;
  label: string;
  value: string;
}

/**
 * `106,4 km` — ou le tiret unité quand la valeur n'existe pas. Une distance
 * absente s'écrit `— km`, jamais `0 km`.
 */
export function statDistance(km: number | null): string {
  return formatKm(km) ?? '— km';
}

/** `2 002 m` — ou `— m`. */
export function statElevation(meters: number | null): string {
  return formatElevation(meters) ?? '— m';
}

/** `6 h` — ou `— h`. */
export function statDuration(seconds: number | null): string {
  return formatDuration(seconds) ?? '— h';
}

/**
 * Rangée du Résumé : les totaux du carnet.
 *
 * Distance et D+ viennent du total du carnet — la même valeur que la ligne de
 * lieu, le sous-drawer statistiques et le JSON-LD —, le `summary` des jours
 * prenant le relais quand ce total manque. Le nombre de jours et de moments
 * vient du `summary` : c'est le nombre réel de pages du balayage. Aucune
 * valeur inventée, aucun zéro décoratif, et jamais deux totaux différents sur
 * la même carte.
 */
export function summaryStats(detail: CarnetDetail): CarnetDayStat[] {
  const summary = detail.summary ?? { distanceKm: null, elevationM: null, days: 0, moments: 0 };
  const days = summary.days > 0 ? summary.days : detail.etapes.length;
  return [
    {
      tab: 'distance',
      label: 'DISTANCE',
      value: statDistance(detail.distanceKm ?? summary.distanceKm),
    },
    {
      tab: 'elevation',
      label: 'DÉNIVELÉ +',
      value: statElevation(detail.elevationM ?? summary.elevationM),
    },
    { tab: 'days', label: 'JOURS', value: days > 0 ? String(days) : '—' },
  ];
}

/** Rangée d'un jour : sa distance, son dénivelé, sa durée réelle. */
export function dayStats(day: CarnetDay): CarnetDayStat[] {
  return [
    { tab: 'distance', label: 'DISTANCE', value: statDistance(day.distanceKm) },
    { tab: 'elevation', label: 'DÉNIVELÉ +', value: statElevation(day.elevationM) },
    /* La durée du jour se lit dans les jours du sous-drawer statistiques. */
    { tab: 'days', label: 'DURÉE', value: statDuration(day.durationS) },
  ];
}

/** « 25 avr. » pour un jour daté, « Jour 3 » sinon. « Résumé » sur la page 0. */
export function dayPageLabel(day: CarnetDay | null): string {
  if (!day) return 'Résumé';
  return formatDayLabel(day.date) ?? `Jour ${day.index}`;
}

/** Nombre de moments de la page : tous pour le Résumé, ceux du jour sinon. */
export function dayPageMoments(detail: CarnetDetail, day: CarnetDay | null): number {
  if (day) return day.moments.length;
  const summary = detail.summary ?? { moments: 0 };
  return summary.moments > 0 ? summary.moments : detail.moments.length;
}

export interface CarnetDayHeaderProps {
  detail: CarnetDetail;
  /** `null` sur la page Résumé. */
  day: CarnetDay | null;
  /** Couverture de la carte (mini tracé), laissée au parent. */
  cover: React.ReactNode;
  onOpenStat: (stat: CarnetStatsTab) => void;
}

/**
 * Haut de la carte : la **pastille de jour** (un marqueur, jamais un titre) et
 * les statistiques de la page — totaux du carnet sur le Résumé, chiffres du
 * jour sur J1..Jn. Le gabarit est celui du Compte : couverture 66 px, trois
 * statistiques de 19/700 sur une étiquette de 10,5/500.
 */
export function CarnetDayHeader({ detail, day, cover, onOpenStat }: CarnetDayHeaderProps) {
  const stats = day ? dayStats(day) : summaryStats(detail);
  const label = dayPageLabel(day);
  const moments = dayPageMoments(detail, day);

  return (
    <>
      <div className="ckp-daypill" aria-live="polite">
        <span className="ckp-daypill-dot" aria-hidden="true" />
        <b className="ckp-daypill-label">{label}</b>
        <span className="ckp-daypill-count">
          {moments} moment{moments > 1 ? 's' : ''}
        </span>
      </div>

      <div className="ckp-head">
        {cover}

        <div className="ckp-id-stats">
          {stats.map((stat) => (
            <button
              key={stat.label}
              type="button"
              className="ckp-stat"
              onClick={() => onOpenStat(stat.tab)}
              aria-label={`${stat.label} ${stat.value}`}
            >
              <b className="ckp-stat-v">{stat.value}</b>
              <span className="ckp-stat-l">{stat.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default CarnetDayHeader;
