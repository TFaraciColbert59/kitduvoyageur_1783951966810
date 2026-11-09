'use client';

import { useEffect, useState } from 'react';
import type { EventCardVM, GeoPoint } from '../shared/types';
import {
  fetchEventDayWeather,
  shouldFetchWeather,
  type EventWeatherVM,
} from './communityDetails';

export interface EventTileWeatherState {
  /** Prévision du jour J, ou `null` (hors fenêtre, coordonnées absentes, panne). */
  weather: EventWeatherVM | null;
  /** Une requête est en vol : la tuile ne montre rien tant qu'elle n'a pas abouti. */
  loading: boolean;
}

/**
 * Météo de la tuile Sorties (FID-071, maquette `.wxc` L1071 et L2466) : la
 * prévision n'est demandée que dans la fenêtre J-7 → J0, à partir des
 * coordonnées du feed (`community_events_feed.lat/lng`). Hors fenêtre ou sans
 * coordonnées, aucune requête : la tuile n'affiche pas de pastille (état
 * maquette « absence »), et rien ne réserve de place (pastille absolue : zéro
 * décalage de mise en page).
 *
 * L'appel est dédupliqué et mis en cache par `fetchEventDayWeather` ; la tuile
 * se démonte sans effet de bord (`cancelled`).
 */
export function useEventTileWeather(
  event: EventCardVM | null | undefined,
  enabled = true,
): EventTileWeatherState {
  const [weather, setWeather] = useState<EventWeatherVM | null>(null);
  const [loading, setLoading] = useState(false);
  const eventId = event?.id ?? null;
  const eventDate = event?.eventDate ?? '';
  const lat = event?.lat ?? null;
  const lng = event?.lng ?? null;

  useEffect(() => {
    if (!enabled || !eventId || lat == null || lng == null || !shouldFetchWeather(eventDate)) {
      setWeather(null);
      setLoading(false);
      return;
    }
    const point: GeoPoint = { lat, lng };
    let cancelled = false;
    setLoading(true);
    void fetchEventDayWeather(point, eventDate).then((forecast) => {
      if (cancelled) return;
      setWeather(forecast);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, eventDate, eventId, lat, lng]);

  return { weather, loading };
}

export default useEventTileWeather;
