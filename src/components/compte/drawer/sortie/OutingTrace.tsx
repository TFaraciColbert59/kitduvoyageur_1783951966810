'use client';

import React from 'react';
import type { OutingDetail, OutingPoint } from '@/features/compte/server/sorties';
import type { OutingWeather } from '@/features/compte/server/weather';
import { ElevationProfile, TraceMap, formatDuration, formatNumber, weatherIcon } from './shared';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export interface OutingTraceProps {
  detail: OutingDetail;
  onExport: () => void;
}

function altitudeRange(points: OutingPoint[]) {
  const values = points
    .map((point) => point.elevationM)
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** Temps en mouvement : on retire les pauses de plus de 10 minutes. */
function movingSeconds(points: OutingPoint[]): number | null {
  const timed = points.filter((point) => point.timestamp);
  if (timed.length < 2) return null;
  let total = 0;
  for (let index = 1; index < timed.length; index += 1) {
    const previous = Date.parse(timed[index - 1].timestamp as string);
    const current = Date.parse(timed[index].timestamp as string);
    if (!Number.isFinite(previous) || !Number.isFinite(current)) continue;
    const delta = (current - previous) / 1000;
    if (delta > 0 && delta < 600) total += delta;
  }
  return total > 0 ? Math.round(total) : null;
}

function WeatherBlock({ weather }: { weather: OutingWeather | null }) {
  if (!weather || weather.days.length === 0) {
    return (
      <section className="lkdv-sortie-section">
        <header>
          <b>Météo</b>
          <span>Aucune donnée</span>
        </header>
        <p className="lkdv-sortie-empty-line">
          Météo non disponible pour cette sortie : aucune position GPS n’est rattachée.
        </p>
      </section>
    );
  }

  return (
    <section className="lkdv-sortie-section">
      <header>
        <b>Météo au départ</b>
        <span>Open-Meteo · {new Date(weather.fetchedAt).toLocaleDateString('fr-FR')}</span>
      </header>
      <div className="lkdv-sortie-weather">
        {weather.days.slice(0, 3).map((day) => (
          <div key={day.date} className="lkdv-sortie-weather-day">
            <span className="lkdv-sortie-weather-date">
              {new Date(`${day.date}T12:00:00`).toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
              })}
            </span>
            <span className="lkdv-sortie-weather-ico">{weatherIcon(day.icon, 20)}</span>
            <b>
              {day.tMax !== null ? `${Math.round(day.tMax)}°` : '—'}
              {day.tMin !== null ? <small>{Math.round(day.tMin)}°</small> : null}
            </b>
            <span className="lkdv-sortie-weather-label">{day.label}</span>
            <span className="lkdv-sortie-weather-meta">
              {day.precipMm !== null ? `${day.precipMm.toFixed(1)} mm` : '—'}
              {day.windKmh !== null ? ` · ${Math.round(day.windKmh)} km/h` : ''}
            </span>
          </div>
        ))}
      </div>
      {weather.alerts.length > 0 ? (
        <ul className="lkdv-sortie-alerts">
          {weather.alerts.map((alert) => (
            <li key={alert}>
              <LKDVIcon name="vent" size={13} aria-hidden="true" /> {alert}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function OutingTrace({ detail, onExport }: OutingTraceProps) {
  const altitude = altitudeRange(detail.points);
  const moving = movingSeconds(detail.points);
  const slope = detail.km > 0 ? (detail.dplus / (detail.km * 1000)) * 100 : null;
  const pace =
    detail.durationS && detail.km > 0 ? detail.durationS / 60 / detail.km : null;

  if (detail.points.length < 2) {
    return (
      <div className="lkdv-sortie-pane">
        <div className="lkdv-sortie-state">
          <span aria-hidden="true">
            <LKDVIcon name="point_interet" size={22} />
          </span>
          <b>Aucune trace GPS rattachée</b>
          <p>
            Cette sortie a bien été enregistrée, mais aucune trace n’est disponible. Tu peux
            toujours consulter le résumé et le matériel.
          </p>
        </div>
        <WeatherBlock weather={detail.weather} />
      </div>
    );
  }

  return (
    <div className="lkdv-sortie-pane">
      <section className="lkdv-sortie-section">
        <header>
          <b>Trace enregistrée</b>
          <span>{detail.points.length} points</span>
        </header>
        <div className="lkdv-sortie-map-wrap">
          <TraceMap points={detail.points} />
          <div className="lkdv-sortie-map-legend" aria-hidden="true">
            <span><i className="start" /> Départ</span>
            <span><i className="end" /> Arrivée</span>
          </div>
        </div>
      </section>

      <div className="lkdv-sortie-grid">
        <div>
          <small>Altitude min.</small>
          <b>{altitude ? `${formatNumber(altitude.min)} m` : '—'}</b>
        </div>
        <div>
          <small>Altitude max.</small>
          <b>{altitude ? `${formatNumber(altitude.max)} m` : '—'}</b>
        </div>
        <div>
          <small>Pente moyenne</small>
          <b>{slope !== null ? `${formatNumber(slope)} %` : '—'}</b>
        </div>
        <div>
          <small>Temps en mouvement</small>
          <b>{formatDuration(moving)}</b>
        </div>
        <div>
          <small>Durée totale</small>
          <b>{formatDuration(detail.durationS)}</b>
        </div>
        <div>
          <small>Allure moyenne</small>
          <b>{pace !== null ? `${formatNumber(pace)} min/km` : '—'}</b>
        </div>
      </div>

      <section className="lkdv-sortie-section">
        <header>
          <b>Relief</b>
          <span>{altitude ? `de ${Math.round(altitude.min)} à ${Math.round(altitude.max)} m` : '—'}</span>
        </header>
        <ElevationProfile points={detail.points} />
      </section>

      <WeatherBlock weather={detail.weather} />

      <button type="button" className="lkdv-sortie-btn primary wide" onClick={onExport}>
        <LKDVIcon name="telecharger" size={15} aria-hidden="true" /> Télécharger le GPX
      </button>
    </div>
  );
}

export default OutingTrace;
