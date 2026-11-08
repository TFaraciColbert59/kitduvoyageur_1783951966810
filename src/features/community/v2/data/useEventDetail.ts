'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventCardVM } from '../shared/types';
import { fetchEventDetail, fetchEventWeather, type EventDetailExtras, type EventWeatherVM } from './communityDetails';

export interface EventDetailState {
  detail: EventDetailExtras | null;
  weather: EventWeatherVM | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Détail enrichi d'une sortie : description, sécurité, RDV géolocalisé,
 * participants réels et météo du jour J (fenêtre J-7, repli silencieux).
 * La tuile fournit déjà la VM du feed : aucun re-fetch de la liste.
 */
export function useEventDetail(event: EventCardVM | null, enabled = true): EventDetailState {
  const [detail, setDetail] = useState<EventDetailExtras | null>(null);
  const [weather, setWeather] = useState<EventWeatherVM | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef(0);
  const eventId = event?.id ?? null;
  const eventDate = event?.eventDate ?? '';
  const eventPoint = event?.startsAt ?? null;

  useEffect(() => {
    if (!enabled || !eventId) {
      setDetail(null);
      setWeather(null);
      setError(null);
      setLoading(false);
      return;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError(null);
    void (async () => {
      const result = await fetchEventDetail(eventId);
      if (requestRef.current !== requestId) return;
      setLoading(false);
      if (result.error || !result.data) {
        setError('Sortie indisponible.');
        setDetail(null);
        return;
      }
      setDetail(result.data);
      // La météo part après le détail : elle a besoin du point du lieu.
      const point = result.data.meetingPointPoint ?? result.data.locationPoint;
      if (point && eventDate) {
        const forecast = await fetchEventWeather(point, eventDate);
        if (requestRef.current === requestId) setWeather(forecast);
      }
    })();
    // `eventPoint` ne sert qu'à invalider quand la sortie change de date/heure.
  }, [attempt, enabled, eventDate, eventId, eventPoint]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { detail, weather, loading, error, retry };
}

export default useEventDetail;
