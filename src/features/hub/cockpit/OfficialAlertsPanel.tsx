'use client';

import { useEffect, useState } from 'react';
import type { Coordinate } from './model';
import type { OfficialAlertsPayload } from './officialAlertsServer';
import { DrawerRow, DrawerSection, StatusBadge } from './DrawerPrimitives';
import ds from './cockpitDrawers.module.css';

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
  if (loading && !data) {
    return (
      <DrawerSection title="Vigilances officielles" padded>
        <p className={ds.heroSub}>Interrogation MeteoAlarm CAP 1.2 & NASA EONET…</p>
      </DrawerSection>
    );
  }
  if (!data) return null;

  const topWeather = data.weatherAlerts.items.slice(0, 4);
  const topFires = data.wildfires.items.slice(0, 3);

  return (
    <div className={ds.drawerRoot} style={{ paddingBottom: 0 }} role="region" aria-label="Vigilances officielles et feux actifs">
      <DrawerSection
        title="Vigilances officielles (MeteoAlarm)"
        right={
          <StatusBadge tone={data.weatherAlerts.status !== 'ok' ? 'neutral' : topWeather.length > 0 ? 'warn' : 'good'}>
            {data.weatherAlerts.status !== 'ok'
              ? 'Indisponible'
              : topWeather.length > 0 ? `${topWeather.length} active(s)` : 'Aucune'}
          </StatusBadge>
        }
      >
        {topWeather.length > 0 ? topWeather.map((item) => {
          const severe = /extreme|severe/i.test(item.severity);
          return (
            <DrawerRow
              key={item.id}
              icon="alert-triangle"
              iconTone={severe ? 'bad' : 'warn'}
              title={item.event}
              subtitle={`${item.area || data.weatherAlerts.country} · ${item.source}`}
              right={<StatusBadge tone={severe ? 'bad' : 'warn'}>{item.severity}</StatusBadge>}
            />
          );
        }) : (
          <DrawerRow
            icon="shield-check"
            iconTone="good"
            title="Aucune vigilance active signalée"
            subtitle={`Zone ${data.weatherAlerts.country} · MeteoAlarm CAP 1.2`}
          />
        )}
      </DrawerSection>

      <DrawerSection
        title={`Feux actifs · Rayon ${data.wildfires.radiusKm} km`}
        right={
          <StatusBadge tone={data.wildfires.status !== 'ok' ? 'neutral' : topFires.length > 0 ? 'bad' : 'good'}>
            {data.wildfires.status !== 'ok'
              ? 'Indisponible'
              : topFires.length > 0 ? `${topFires.length} détecté(s)` : 'RAS'}
          </StatusBadge>
        }
      >
        {topFires.length > 0 ? topFires.map((fire) => (
          <DrawerRow
            key={fire.id}
            icon="flame"
            iconTone="bad"
            title={fire.title}
            subtitle={fire.source}
            right={<StatusBadge tone="bad">{fire.distanceKm} km</StatusBadge>}
          />
        )) : (
          <DrawerRow
            icon="check"
            iconTone="good"
            title="Aucun feu actif recensé dans le rayon"
            subtitle="NASA EONET v3 · vérifier arrêtés locaux"
          />
        )}
      </DrawerSection>
    </div>
  );
}
