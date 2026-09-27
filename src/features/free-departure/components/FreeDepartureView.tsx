'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getHikingSnapshot, useHikingActions } from '@/features/hiking/hooks/useHikingStore';
import { guessActivity } from '../engine/activityGuess';
import { permissionFromGeolocationError, type LocationPermission } from '../engine/location';
import type { ActivityGuess } from '../engine/activityGuess';
import { useFreeDepartureStore } from '../store/useFreeDepartureStore';
import { FreeDepartureScreen } from './FreeDepartureScreen';

/**
 * « Partir librement » — le point de depart, branche sur le cockpit existant.
 *
 * On ne reecrit PAS un second traceur : la session est celle de
 * `useHikingStore` / `/randonnee-active`, demarree sans `routeId` (« Suivi
 * libre »). Cette vue ne fait que la partie qui n'existait pas : dire ce que
 * l'app fera de la position, et demarrer au bon moment.
 */
export function FreeDepartureView() {
  const router = useRouter();
  // Actions seules : l'ecran ne *affiche* aucune mesure vivante, il n'a donc
  // aucune raison de se re-rendre a chaque point GPS.
  const hiking = useHikingActions();
  const activityId = useFreeDepartureStore((state) => state.activityId);
  const setActivity = useFreeDepartureStore((state) => state.setActivity);
  const [permission, setPermission] = useState<LocationPermission>('inconnue');
  const [guess, setGuess] = useState<ActivityGuess | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Un choix manuel prime sur toute proposition : on ne l'ecrase pas.
    if (activityId !== null) {
      setGuess(null);
      return;
    }
    // UNE lecture ponctuelle du traceur. Ecouter le flux GPS ferait re-rendre
    // tout l'ecran environ une fois par seconde pour une valeur qui, sur un
    // ecran d'avant-depart, ne change pas.
    const hike = getHikingSnapshot();
    setGuess(
      guessActivity({
        distanceKm: hike.positions.length > 1 ? hike.distanceKm : null,
        durationSeconds: hike.durationSeconds,
        averageSpeedKmH: hike.averageSpeedKmH > 0 ? hike.averageSpeedKmH : null,
        elevationGainM: hike.elevationGainM,
      })
    );
  }, [activityId]);

  /**
   * L'autorisation n'est demandee qu'ici, au clic sur « Demarrer ». On lit
   * l'etat courant sans declencher la boite systeme : un refus de l'utilisateur
   * doit rester un refus, pas une relance a chaque visite.
   */
  const requestPermission = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setPermission('indisponible');
      return;
    }
    if (typeof navigator.permissions?.query === 'function') {
      void navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          if (result.state === 'denied') setPermission('refusee');
          else if (result.state === 'granted') setPermission('accordee');
        })
        .catch(() => {
          /* Permissions API indisponible : on laisse l'etat inconnu. */
        });
    }
    // Un appel reel au GPS declenche la boite du navigateur si necessaire.
    navigator.geolocation.getCurrentPosition(
      () => setPermission('accordee'),
      (error) => setPermission(permissionFromGeolocationError(error?.code)),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, []);

  /** Demarrage sans itineraire : le cockpit affiche « Suivi libre ». */
  const handleStart = useCallback(() => {
    void hiking.startHike(undefined, null, null);
    router.push('/randonnee-active');
  }, [hiking, router]);

  const handleClose = useCallback(() => router.push('/hub'), [router]);

  const handlePickActivity = useCallback((next: string | null) => setActivity(next), [setActivity]);

  if (!mounted) {
    return (
      <div className="adventure-prep">
        <div className="prep-screen" aria-busy="true" aria-live="polite">
          <p className="prep-note">Préparation du départ…</p>
        </div>
      </div>
    );
  }

  return (
    <FreeDepartureScreen
      guess={guess}
      permission={permission}
      onRequestPermission={requestPermission}
      onStart={handleStart}
      onClose={handleClose}
      onPickActivity={handlePickActivity}
    />
  );
}

export default FreeDepartureView;
