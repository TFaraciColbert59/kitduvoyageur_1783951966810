'use client';

import { useEffect, useState } from 'react';
import type { Coordinate } from './model';
import type { OfficialAlertsPayload } from './officialAlertsServer';
import styles from './cockpit.module.css';

export function OfficialAlertsPanel({ point }: { point?: Coordinate | null }) {
  const [data, setData] = useState<OfficialAlertsPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!point) return;
    const controller = new AbortController();
    setLoading(true);
    const [lon, lat] = point;
    fetch(`/api/hub/official-alerts?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&country=france`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: OfficialAlertsPayload | null) => {
        if (!controller.signal.aborted && json) setData(json);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [point]);

  if (!point) return null;
  if (loading && !data) return <p className={styles.meta}>Vérification des vigilances officielles…</p>;
  if (!data) return null;

  const topWeather = data.weatherAlerts.items.slice(0, 3);
  const topFires = data.wildfires.items.slice(0, 3);

  return (
    <div role="region" aria-label="Vigilances officielles et feux actifs" className={styles.stepExecution}>
      <p className={styles.meta}>
        Vigilances officielles (MeteoAlarm) :{' '}
        {data.weatherAlerts.status === 'ok'
          ? topWeather.length > 0
            ? `${topWeather.length} alerte(s) active(s)`
            : 'Aucune vigilance active signalée'
          : 'Flux indisponible'}
      </p>
      {topWeather.length > 0 && (
        <ul className={styles.list}>
          {topWeather.map((item) => (
            <li key={item.id}>
              <strong>{item.event}</strong>
              <p className={styles.meta}>{item.area || data.weatherAlerts.country} · {item.severity} · {item.source}</p>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.meta}>
        Feux actifs (NASA EONET, rayon {data.wildfires.radiusKm} km) :{' '}
        {data.wildfires.status === 'ok'
          ? topFires.length > 0
            ? `${topFires.length} événement(s) détecté(s)`
            : 'Aucun feu actif recensé dans le rayon'
          : 'Flux indisponible'}
      </p>
      {topFires.length > 0 && (
        <ul className={styles.list}>
          {topFires.map((fire) => (
            <li key={fire.id}>
              <strong>{fire.title}</strong>
              <p className={styles.meta}>{fire.distanceKm} km · {fire.source}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
