'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { formatElevation, formatKm } from '@/features/carnet/detail/format';
import { CARNET_STATS_TABS, summarizeCarnet, type CarnetStatsTab } from '@/features/carnet/detail/stats';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { extractCoords, traceLengthKm } from '../traceGeometry';
import { CarnetSubCapsule } from '../CarnetSubCapsule';

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

/**
 * Sous-drawer unique des trois statistiques de la carte.
 * Trois sous-onglets dans l'ordre Distance / Dénivelé / Jours, chacun alimenté
 * par les seules données réelles du carnet.
 */
export function CarnetStatsPane({ detail, tab, onTabChange }: CarnetStatsPaneProps) {
  const stats = summarizeCarnet(detail);
  const tracePoints = extractCoords(detail.trace);
  const traceKm = traceLengthKm(detail.trace);

  return (
    <div className="ckp-pane ckp-stats">
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
          <div className="ckp-stat-hero">
            <b>{km(stats.distanceKm) ?? '—'}</b>
            <span>distance totale</span>
          </div>

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
          <div className="ckp-stat-hero">
            <b>{formatElevation(stats.elevationM) ?? '—'}</b>
            <span>dénivelé positif cumulé</span>
          </div>

          {stats.elevationM === null && stats.daysWithElevation.length === 0 ? (
            <Empty text="Dénivelé non renseigné." />
          ) : (
            <>
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
          <div className="ckp-stat-hero">
            <b>{stats.daysCount.toLocaleString('fr-FR')}</b>
            <span>{stats.daysCount > 1 ? 'jours' : 'jour'}</span>
          </div>

          {stats.days.length === 0 ? (
            <Empty text="Aucun jour renseigné." />
          ) : (
            <div className="ckp-daylist">
              {stats.days.map(({ day, moments }) => (
                <article className="ckp-day" key={day.id}>
                  <div className="ckp-day-rail">
                    <span className="ckp-day-badge">{day.dayNumber}</span>
                    <span className="ckp-day-line" aria-hidden="true" />
                  </div>
                  <div className="ckp-day-body">
                    <span className="ckp-day-label">{day.label}</span>
                    {day.from || day.to ? (
                      <b className="ckp-day-title">{[day.from, day.to].filter(Boolean).join(' → ')}</b>
                    ) : null}
                    <div className="ckp-day-meta">
                      {km(day.distanceKm) ? <span>{km(day.distanceKm)}</span> : null}
                      {dplus(day.elevationM) ? <span>{dplus(day.elevationM)}</span> : null}
                      {day.durationText ? <span>{day.durationText}</span> : null}
                    </div>
                    {day.overnight ? (
                      <span className="ckp-day-overnight">Nuit · {day.overnight}</span>
                    ) : null}
                    {moments.length > 0 ? (
                      <ul className="ckp-moment-list" aria-label={`Moments du jour ${day.dayNumber}`}>
                        {moments.map((moment) => (
                          <li key={moment.id}>
                            <Icon name="image-plus" size={12} aria-hidden="true" />
                            <span className="ckp-moment-txt">
                              <span className="ckp-moment-meta">
                                {[moment.time, moment.place].filter(Boolean).join(' · ') || 'Moment'}
                              </span>
                              {moment.caption ? (
                                <span className="ckp-moment-caption">{moment.caption}</span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default CarnetStatsPane;
