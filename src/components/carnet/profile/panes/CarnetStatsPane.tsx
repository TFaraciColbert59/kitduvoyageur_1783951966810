'use client';

import React, { useRef } from 'react';
import { formatElevation, formatKm } from '@/features/carnet/detail/format';
import { CARNET_STATS_TABS, summarizeCarnet, type CarnetStatsTab } from '@/features/carnet/detail/stats';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { extractCoords, traceLengthKm } from '../traceGeometry';
import { CarnetSubCapsule } from '../CarnetSubCapsule';
import { CarnetDayRow } from './CarnetDayRow';
import { useScrollCut } from '../useScrollCut';
import {
  dailyBarHeights,
  elevationProfile,
  splitThirds,
  splitUnit,
  type SeriesValue,
} from '../statsGeometry';

export interface CarnetStatsPaneProps {
  detail: CarnetDetail;
  tab: CarnetStatsTab;
  onTabChange: (tab: CarnetStatsTab) => void;
}

function km(value: number | null): string | null {
  return formatKm(value);
}

function dplus(value: number | null): string | null {
  const formatted = formatElevation(value);
  return formatted ? `${formatted} D+` : null;
}

function perKm(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  return `${Math.round(value).toLocaleString('fr-FR')} m/km`;
}

function count(value: number, singular: string, plural: string): string {
  return `${value.toLocaleString('fr-FR')} ${value > 1 ? plural : singular}`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ckp-stat-row">
      <span className="ckp-stat-key">{label}</span>
      <span className="ckp-stat-val">{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="ckp-pane-empty">{text}</p>;
}

/** Chiffre principal 34/700 + unité 13/500 sur la même ligne, aligné à gauche. */
function Hero({ formatted, context }: { formatted: string | null; context: string }) {
  const { value, unit } = splitUnit(formatted);
  return (
    <>
      <div className="ckp-stat-hero">
        <b>{value}</b>
        {unit ? <span className="ckp-stat-unit">{unit}</span> : null}
      </div>
      <p className="ckp-stat-context">{context}</p>
    </>
  );
}

/**
 * Barre de répartition 6 px : trois segments #17402C à 100 / 70 / 45 %,
 * rayon 999, 12 px sous le chiffre, sans axe ni légende. Les largeurs sont les
 * sommes réelles des trois tiers de la série ; sans valeur, aucune barre.
 */
function SplitBar({ series }: { series: SeriesValue[] }) {
  const bands = splitThirds(series);
  if (!bands) return null;
  const opacity = [1, 0.7, 0.45];
  return (
    <div className="ckp-split" aria-hidden="true">
      {bands.map((value, index) => (
        <i key={index} style={{ flexGrow: value, opacity: opacity[index] }} />
      ))}
    </div>
  );
}

const PROFILE_WIDTH = 374;
const PROFILE_HEIGHT = 72;

/**
 * Sous-drawer unique des trois statistiques de la carte.
 * Trois sous-onglets dans l'ordre Distance / Dénivelé / Jours, chacun alimenté
 * par les seules données réelles du carnet. Une série absente ne produit ni
 * aire ni barre : l'état vide le dit, plutôt qu'une courbe décorative.
 */
export function CarnetStatsPane({ detail, tab, onTabChange }: CarnetStatsPaneProps) {
  const stats = summarizeCarnet(detail);
  const tracePoints = extractCoords(detail.trace);
  const traceKm = traceLengthKm(detail.trace);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrolled = useScrollCut(rootRef);

  const distanceSeries: SeriesValue[] = detail.days.map((day) => day.distanceKm);
  const elevationSeries: SeriesValue[] = detail.days.map((day) => day.elevationM);
  const daySeries: SeriesValue[] = detail.days.map(() => 1);
  const profile = elevationProfile(elevationSeries, PROFILE_WIDTH, PROFILE_HEIGHT);
  const bars = dailyBarHeights(distanceSeries);

  const distance = splitUnit(km(stats.distanceKm));
  const elevation = splitUnit(formatElevation(stats.elevationM));
  const dayCount = splitUnit(`${stats.daysCount.toLocaleString('fr-FR')} ${stats.daysCount > 1 ? 'jours' : 'jour'}`);

  const summary: Record<CarnetStatsTab, { label: string; total: string }> = {
    distance: { label: 'Distance', total: km(stats.distanceKm) ?? '—' },
    elevation: { label: 'Dénivelé', total: formatElevation(stats.elevationM) ?? '—' },
    days: { label: 'Jours', total: dayCount.unit ? `${dayCount.value} ${dayCount.unit}` : dayCount.value },
  };
  const total = summary[tab];

  /* Trois repères verticaux : les vrais jours placés aux quarts de l'axe. */
  const ticks = detail.days.length
    ? [0.25, 0.5, 0.75].map((ratio) => {
        const index = Math.min(detail.days.length - 1, Math.round(ratio * (detail.days.length - 1)));
        return `J${detail.days[index].dayNumber}`;
      })
    : [];

  return (
    <div className="ckp-pane ckp-stats" ref={rootRef}>
      <div className="ckp-stats-sticky" data-on={scrolled ? 'true' : undefined} aria-hidden="true">
        <div>
          <span>{total.label}</span>
          <b>{total.total}</b>
        </div>
      </div>

      <div className="ckp-pane-sub">
        <CarnetSubCapsule
          items={CARNET_STATS_TABS}
          active={tab}
          onChange={(id) => onTabChange(id as CarnetStatsTab)}
          ariaLabel="Statistiques du carnet"
        />
      </div>

      {tab === 'distance' ? (
        <div className="ckp-pane" role="tabpanel" aria-label="Distance">
          <Hero formatted={km(stats.distanceKm) ?? '—'} context="distance totale" />
          <SplitBar series={distanceSeries} />
          <div className="ckp-stats-sep" />

          <div className="ckp-stat-rows">
            <Row label="Étapes" value={count(stats.daysCount, 'étape', 'étapes')} />
            <Row label="Distance moyenne / étape" value={km(stats.averageDistanceKm) ?? '—'} />
            <Row label="Dénivelé par km" value={perKm(stats.elevationPerKm) ?? '—'} />
            <Row label="Départ" value={stats.startPlace ?? '—'} />
            <Row label="Arrivée" value={stats.endPlace ?? '—'} />
            <Row
              label="Trace GPS"
              value={
                tracePoints.length > 1
                  ? `${count(tracePoints.length, 'point', 'points')}${traceKm ? ` · ${km(traceKm)}` : ''}`
                  : '—'
              }
            />
          </div>

          {stats.daysWithDistance.length > 0 ? (
            <div className="ckp-stat-block">
              <span className="ckp-stat-block-title">Distance par jour</span>
              {stats.daysWithDistance.map((day) => (
                <Row key={day.id} label={day.label} value={km(day.distanceKm) ?? '—'} />
              ))}
            </div>
          ) : (
            <Empty text="Distances par étape non renseignées." />
          )}
        </div>
      ) : null}

      {tab === 'elevation' ? (
        <div className="ckp-pane" role="tabpanel" aria-label="Dénivelé">
          <Hero formatted={formatElevation(stats.elevationM) ?? '—'} context="dénivelé positif cumulé" />
          <SplitBar series={elevationSeries} />

          {profile ? (
            <>
              <div className="ckp-stats-sep" />
              <div className="ckp-elev">
                {ticks.length === 3 ? (
                  <div className="ckp-elev-axis" aria-hidden="true">
                    {ticks.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                ) : null}
                <svg
                  viewBox={`0 0 ${PROFILE_WIDTH} ${PROFILE_HEIGHT}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d={profile.area} fill="rgba(23,64,44,.12)" />
                  {[0.25, 0.5, 0.75].map((ratio) => (
                    <line
                      key={ratio}
                      x1={PROFILE_WIDTH * ratio}
                      x2={PROFILE_WIDTH * ratio}
                      y1="0"
                      y2={PROFILE_HEIGHT}
                      stroke="rgba(23,43,36,.06)"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  <path
                    d={profile.line}
                    fill="none"
                    stroke="#17402C"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <span
                  className="ckp-elev-summit"
                  style={{
                    left: `${(profile.summit.x / PROFILE_WIDTH) * 100}%`,
                    top: `${profile.summit.y}px`,
                  }}
                >
                  <i aria-hidden="true" />
                  <b>{formatElevation(profile.max) ?? '—'}</b>
                </span>
              </div>
              <div className="ckp-elev-bars" aria-hidden="true">
                {bars.map((height, index) => (
                  <i
                    key={detail.days[index]?.id ?? index}
                    data-empty={height === null ? 'true' : undefined}
                    style={{ height: height ?? 2 }}
                  />
                ))}
              </div>
            </>
          ) : null}

          {stats.elevationM === null && stats.daysWithElevation.length === 0 ? (
            <Empty text="Dénivelé non renseigné." />
          ) : (
            <>
              <div className="ckp-stats-sep" />
              <div className="ckp-stat-rows">
                <Row label="Moyenne / jour" value={dplus(stats.averageElevationM) ?? '—'} />
                <Row
                  label="Maximum d’une journée"
                  value={
                    stats.maxElevationDay
                      ? `${dplus(stats.maxElevationDay.elevationM) ?? '—'} · ${stats.maxElevationDay.label}`
                      : '—'
                  }
                />
                <Row label="Dénivelé par km" value={perKm(stats.elevationPerKm) ?? '—'} />
                <Row
                  label="Jours sans dénivelé"
                  value={stats.daysWithoutElevation.toLocaleString('fr-FR')}
                />
              </div>

              {stats.daysWithElevation.length > 0 ? (
                <div className="ckp-stat-block">
                  <span className="ckp-stat-block-title">Dénivelé par jour</span>
                  {stats.daysWithElevation.map((day) => (
                    <Row key={day.id} label={day.label} value={dplus(day.elevationM) ?? '—'} />
                  ))}
                </div>
              ) : (
                <Empty text="Dénivelé par étape non renseigné." />
              )}
            </>
          )}
        </div>
      ) : null}

      {tab === 'days' ? (
        <div className="ckp-pane" role="tabpanel" aria-label="Jours">
          <Hero
            formatted={`${stats.daysCount.toLocaleString('fr-FR')} ${stats.daysCount > 1 ? 'jours' : 'jour'}`}
            context={stats.daysCount > 1 ? 'jours de marche' : 'jour de marche'}
          />
          <SplitBar series={daySeries} />
          <div className="ckp-stats-sep" />

          {stats.days.length === 0 ? (
            <Empty text="Aucun jour renseigné." />
          ) : (
            <div className="ckp-daylist">
              {stats.days.map(({ day, moments }) => (
                <CarnetDayRow key={day.id} day={day} moments={moments} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default CarnetStatsPane;
