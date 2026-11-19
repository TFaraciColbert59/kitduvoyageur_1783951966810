'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventCardVM, GeoPoint } from '../shared/types';
import {
  fetchEventDayWeather,
  fetchEventDetail,
  shouldFetchWeather,
  type EventDetailExtras,
  type EventWeatherVM,
} from './communityDetails';

export interface EventDetailState {
  detail: EventDetailExtras | null;
  weather: EventWeatherVM | null;
  /** Prévision en cours : la carte garde sa hauteur, sans décalage de layout. */
  weatherLoading: boolean;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Détail enrichi d'une sortie : description, sécurité, RDV géolocalisé,
 * participants réels et météo du jour J (fenêtre J-7, repli silencieux).
 * La tuile fournit déjà la VM du feed : aucun re-fetch de la liste.
 *
 * FID-071 : la météo part **avant** le détail, à partir des coordonnées du
 * feed (`event.lat/lng`) ; si elles manquent, elle attend le point du RDV
 * (plus précis) lu par `fetchEventDetail`. La route utilisée est la même
 * (`/api/weather`, même origine) et rend la journée demandée.
 */
export function useEventDetail(
  event: EventCardVM | null,
  enabled = true,
  viewerId: string | null = null,
): EventDetailState {
  const [detail, setDetail] = useState<EventDetailExtras | null>(null);
  const [weather, setWeather] = useState<EventWeatherVM | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef(0);
  const eventId = event?.id ?? null;
  const eventDate = event?.eventDate ?? '';
  const eventPoint = event?.startsAt ?? null;
  const eventLat = event?.lat ?? null;
  const eventLng = event?.lng ?? null;

  useEffect(() => {
    if (!enabled || !eventId) {
      setDetail(null);
      setWeather(null);
      setWeatherLoading(false);
      setError(null);
      setLoading(false);
      return;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const eligible = shouldFetchWeather(eventDate);
    const feedPoint: GeoPoint | null =
      eventLat != null && eventLng != null ? { lat: eventLat, lng: eventLng } : null;
    setLoading(true);
    setError(null);
    setWeather(null);
    setWeatherLoading(eligible);
    void (async () => {
      // 1) Météo dès que possible : le point du feed suffit pour une prévision
      //    journalière, et la carte n'attend pas la lecture du détail.
      let forecast = eligible && feedPoint ? await fetchEventDayWeather(feedPoint, eventDate) : null;
      if (requestRef.current !== requestId) return;
      setWeather(forecast);
      if (forecast || feedPoint) setWeatherLoading(false);

      // 2) Détail (description, sécurité, RDV, participants).
      const result = await fetchEventDetail(eventId, undefined, viewerId);
      if (requestRef.current !== requestId) return;
      setLoading(false);
      if (result.error || !result.data) {
        setError('Sortie indisponible.');
        setDetail(null);
        setWeatherLoading(false);
        return;
      }
      setDetail(result.data);

      // 3) Sans coordonnées de feed, la météo attend le point du RDV.
      if (!forecast) {
        const point = result.data.meetingPointPoint ?? result.data.locationPoint;
        if (eligible && point && eventDate) {
          forecast = await fetchEventDayWeather(point, eventDate);
        }
        if (requestRef.current === requestId) setWeather(forecast);
      }
      if (requestRef.current === requestId) setWeatherLoading(false);
    })();
    // `eventPoint` ne sert qu'à invalider quand la sortie change de date/heure.
  }, [attempt, enabled, eventDate, eventId, eventLat, eventLng, eventPoint, viewerId]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { detail, weather, weatherLoading, loading, error, retry };
}

export default useEventDetail;
