'use client';

import React from 'react';
import { Download, MapPin, Wind } from 'lucide-react';
import { ActionPill } from '@/components/ui/ActionPill';
import type { OutingDetail, OutingPoint } from '@/features/compte/server/sorties';
import type { OutingWeather } from '@/features/compte/server/weather';
import {
  ElevationProfile,
  TraceMap,
  formatDuration,
  formatNumber,
  hasVisibleTrace,
  metricDisplay,
  outingMetricVisible,
  traceUnavailableState,
  visibleTracePoints,
  visibleTraceSegments,
  weatherIcon,
} from './shared';

export interface OutingTraceProps {
  detail: OutingDetail;
  onExport: () => void;
}

function altitudeRange(points: OutingPoint[]) {
  const values = points
    .map((point) => point.elevationM)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function WeatherBlock({ weather }: { weather: OutingWeather | null }) {
  if (!weather || weather.days.length === 0) {
    return (
      <section className="lkdv-sortie-section">
        <header>
          <b>Météo</b>
          <span>Aucune donnée</span>
        </header>
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
              <Wind size={13} aria-hidden="true" /> {alert}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function OutingTrace({ detail, onExport }: OutingTraceProps) {
  const segments = visibleTraceSegments(detail);
  const points = visibleTracePoints(detail);
  const altitude = outingMetricVisible(detail, 'elevation') ? altitudeRange(points) : null;
  const slope =
    outingMetricVisible(detail, 'elevationGain') &&
    outingMetricVisible(detail, 'distance') &&
    typeof detail.km === 'number' &&
    Number.isFinite(detail.km) &&
    typeof detail.dplus === 'number' &&
    Number.isFinite(detail.dplus) &&
    detail.km > 0
      ? (detail.dplus / (detail.km * 1000)) * 100
      : null;
  /* Jamais de recalcul client : le serveur seul décide de l'allure publiable. */
  const effortRows: Array<{ label: string; value: string }> = [];
  if (outingMetricVisible(detail, 'heartRate') && typeof detail.heartRateBpm === 'number' && Number.isFinite(detail.heartRateBpm)) {
    effortRows.push({ label: 'FC moyenne', value: `${formatNumber(detail.heartRateBpm)} bpm` });
  }
  if (outingMetricVisible(detail, 'power') && typeof detail.powerW === 'number' && Number.isFinite(detail.powerW)) {
    effortRows.push({ label: 'Puissance', value: `${formatNumber(detail.powerW)} W` });
  }
  if (outingMetricVisible(detail, 'cadence') && typeof detail.cadenceRpm === 'number' && Number.isFinite(detail.cadenceRpm)) {
    effortRows.push({ label: 'Cadence', value: `${formatNumber(detail.cadenceRpm)} rpm` });
  }
  if (outingMetricVisible(detail, 'calories') && typeof detail.caloriesKcal === 'number' && Number.isFinite(detail.caloriesKcal)) {
    effortRows.push({ label: 'Calories', value: `${formatNumber(detail.caloriesKcal)} kcal` });
  }

  if (!hasVisibleTrace(detail)) {
    const state = traceUnavailableState(detail);
    return (
      <div className="lkdv-sortie-pane">
        <div className="lkdv-sortie-state">
          <span aria-hidden="true">
            <MapPin size={22} />
          </span>
          <b>{state.title}</b>
          <p>{state.body}</p>
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
          <span>{points.length} points</span>
        </header>
        <div className="lkdv-sortie-map-wrap">
          <TraceMap segments={segments} />
          <div className="lkdv-sortie-map-legend" aria-hidden="true">
            <span><i className="start" /> Départ</span>
            <span><i className="end" /> Arrivée</span>
          </div>
        </div>
      </section>

      <div className="lkdv-sortie-grid">
        <div>
          <small>Altitude min.</small>
          <b>
            {!outingMetricVisible(detail, 'elevation')
              ? 'Masqué'
              : altitude
                ? `${formatNumber(altitude.min)} m`
                : '—'}
          </b>
        </div>
        <div>
          <small>Altitude max.</small>
          <b>
            {!outingMetricVisible(detail, 'elevation')
              ? 'Masqué'
              : altitude
                ? `${formatNumber(altitude.max)} m`
                : '—'}
          </b>
        </div>
        <div>
          <small>Pente moyenne</small>
          <b>
            {!outingMetricVisible(detail, 'elevationGain') ||
            !outingMetricVisible(detail, 'distance')
              ? 'Masqué'
              : slope !== null
                ? `${formatNumber(slope)} %`
                : '—'}
          </b>
        </div>
        <div>
          <small>Temps en mouvement</small>
          <b>
            {metricDisplay(detail, 'movingTime', detail.movingTimeS, (value) =>
              formatDuration(value)
            )}
          </b>
        </div>
        <div>
          <small>Durée totale</small>
          <b>
            {metricDisplay(detail, 'duration', detail.durationS, (value) =>
              formatDuration(value)
            )}
          </b>
        </div>
        <div>
          <small>Allure moyenne</small>
          <b>
            {metricDisplay(detail, 'pace', detail.paceMinPerKm, (value) =>
              `${formatNumber(value)} min/km`
            )}
          </b>
        </div>
      </div>

      {effortRows.length > 0 ? (
        <div className="lkdv-sortie-grid">
          {effortRows.map((row) => (
            <div key={row.label}>
              <small>{row.label}</small>
              <b>{row.value}</b>
            </div>
          ))}
        </div>
      ) : null}

      <section className="lkdv-sortie-section">
        <header>
          <b>Relief</b>
          <span>
            {!outingMetricVisible(detail, 'elevation')
              ? 'Non partagé'
              : altitude
                ? `de ${Math.round(altitude.min)} à ${Math.round(altitude.max)} m`
                : '—'}
          </span>
        </header>
        {outingMetricVisible(detail, 'elevation') ? (
          <ElevationProfile segments={segments} />
        ) : (
          <div className="lkdv-sortie-trace-empty">Profil altimétrique non partagé</div>
        )}
      </section>

      <WeatherBlock weather={detail.weather} />

      <div className="lkdv-apill-row">
        <ActionPill tone="primary" label="Télécharger le GPX" icon={<Download />} text="GPX" onClick={onExport} />
      </div>
    </div>
  );
}

export default OutingTrace;
