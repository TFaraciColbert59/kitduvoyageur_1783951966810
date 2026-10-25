'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHikingStore } from '@/features/hiking/hooks/useHikingStore';
import { buildSummary, toTracePoints } from '../engine/freeSession';
import { buildSummaryView, resolveLiveView } from '../engine/freeFlow';
import { permissionFromGeolocationError, type LocationPermission } from '../engine/location';
import type { FreePrivacyId } from '../engine/privacy';
import { useFreeDepartureStore } from '../store/useFreeDepartureStore';
import { FreeDepartureScreen } from './FreeDepartureScreen';
import { FreeLiveScreen } from './FreeLiveScreen';
import { FreeSummaryScreen } from './FreeSummaryScreen';

/**
 * « Partir librement » — la machine a trois etats (60 → 61 → 62).
 *
 * On n'ecrit pas un second traceur : la session est celle de `useHikingStore`,
 * demarree sans `routeId` (« Suivi libre »). Cette vue ne fait que ce qui
 * manquait — dire ce que l'app fera de la position avant de la demander, la
 * demander au bon moment, et figer les mesures a l'arret.
 *
 * Elle lit le traceur *vivant* parce que l'ecran 61 affiche un chrono : c'est
 * le seul des trois etats qui a besoin d'un flux, et il s'affiche seul. Les
 * ecrans 60 et 62 ne s'y abonnent pas — ils n'ont rien d'un flux a montrer.
 */

/** Le suivi n'enregistrera rien : on le dit, avec la raison, sur l'ecran 61. */
function trackingNoteFor(permission: LocationPermission, tracking: boolean): string | null {
  if (tracking) return null;
  if (permission === 'refusee') {
    return 'Tu as refusé la localisation : le chrono tourne, mais aucune trace n’est enregistrée.';
  }
  if (permission === 'indisponible') {
    return 'Aucun GPS exploitable sur cet appareil : le chrono tourne, sans trace.';
  }
  return 'Le GPS ne répond pas encore : le chrono tourne, la trace reprendra dès qu’il répondra.';
}

export function FreeDepartureView() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const phase = useFreeDepartureStore((state) => state.phase);
  const activityId = useFreeDepartureStore((state) => state.activityId);
  const confirmed = useFreeDepartureStore((state) => state.confirmed);
  const permission = useFreeDepartureStore((state) => state.permission);
  const finishedAt = useFreeDepartureStore((state) => state.finishedAt);
  const summary = useFreeDepartureStore((state) => state.summary);
  const keepTrace = useFreeDepartureStore((state) => state.keepTrace);
  const shareWithGroup = useFreeDepartureStore((state) => state.shareWithGroup);
  const groupSize = useFreeDepartureStore((state) => state.groupSize);
  const setPhase = useFreeDepartureStore((state) => state.setPhase);
  const setActivity = useFreeDepartureStore((state) => state.setActivity);
  const setPermission = useFreeDepartureStore((state) => state.setPermission);
  const confirmActivity = useFreeDepartureStore((state) => state.confirmActivity);
  const markFinished = useFreeDepartureStore((state) => state.markFinished);
  const setKeepTrace = useFreeDepartureStore((state) => state.setKeepTrace);
  const setShareWithGroup = useFreeDepartureStore((state) => state.setShareWithGroup);

  const tracking = useHikingStore();

  useEffect(() => setMounted(true), []);



  /**
   * L'autorisation n'est demandee qu'ici, au clic sur « Demarrer », et
   * seulement si elle n'a jamais ete accordee. Un refus de l'utilisateur doit
   * rester un refus : on ne relance pas la boite systeme a chaque visite, et
   * l'ecran 60 continue de s'afficher avec la consequence expliquee.
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
          /* Permissions API indisponible : l'etat reste inconnu. */
        });
    }
    // Un appel reel au GPS declenche la boite du navigateur si necessaire.
    navigator.geolocation.getCurrentPosition(
      () => setPermission('accordee'),
      (error) => setPermission(permissionFromGeolocationError(error?.code)),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, [setPermission]);

  /** Demarrage sans itineraire : le cockpit affiche « Suivi libre ». */
  const handleStart = useCallback(() => {
    void tracking.startHike(undefined, null, null);
    setPhase('pendant');
  }, [setPhase, tracking]);

  const handlePause = useCallback(() => tracking.pauseHike(), [tracking]);
  const handleResume = useCallback(() => tracking.resumeHike(), [tracking]);

  /**
   * Arret : on fige les mesures AVANT d'arreter le traceur, sinon le dernier
   * point GPS n'entre pas dans le resume. Le store bascule en « apres ».
   */
  const handleFinish = useCallback(() => {
    const trace = toTracePoints(tracking.positions);
    markFinished(
      buildSummary({
        distanceKm: tracking.distanceKm,
        durationSeconds: tracking.durationSeconds,
        averageSpeedKmH: tracking.averageSpeedKmH,
        elevationGainM: tracking.elevationGainM,
        positions: trace,
        endedAt: Date.now(),
      })
    );
    void tracking.stopHike();
  }, [markFinished, tracking]);

  const handleClose = useCallback(() => router.push('/hub'), [router]);

  /** `null` = retour a la detection automatique. */
  const handlePickActivity = useCallback(
    (next: string | null) => {
      if (next === null) setActivity(null);
      else confirmActivity(next);
    },
    [confirmActivity, setActivity]
  );

  const handleTogglePrivacy = useCallback(
    (id: FreePrivacyId, checked: boolean) => {
      if (id === 'trace') setKeepTrace(checked);
      else setShareWithGroup(checked);
    },
    [setKeepTrace, setShareWithGroup]
  );

  const live = useMemo(
    () =>
      resolveLiveView({
        distanceKm: tracking.distanceKm,
        durationSeconds: tracking.durationSeconds,
        averageSpeedKmH: tracking.averageSpeedKmH,
        elevationGainM: tracking.elevationGainM,
        positions: toTracePoints(tracking.positions),
        paused: tracking.isPaused,
        activityId,
        // Sans point et sans droit accorde, rien ne s'enregistrera : on le
        // dit sur l'ecran plutot que de laisser croire a une trace.
        canTrack:
          permission === 'accordee' || (permission === 'inconnue' && tracking.positions.length > 0),
        trackingNote: trackingNoteFor(permission, tracking.positions.length > 0),
      }),
    [activityId, permission, tracking]
  );

  const after = useMemo(
    () =>
      buildSummaryView({
        phase,
        activityId,
        confirmed,
        permission,
        finishedAt,
        summary,
        keepTrace,
        shareWithGroup,
        groupSize,
      }),
    [
      activityId,
      confirmed,
      finishedAt,
      groupSize,
      keepTrace,
      permission,
      phase,
      shareWithGroup,
      summary,
    ]
  );

  if (!mounted) {
    return (
      <div className="adventure-prep">
        <div className="prep-screen" aria-busy="true" aria-live="polite">
          <p className="prep-note">Préparation du départ…</p>
        </div>
      </div>
    );
  }

  if (phase === 'pendant') {
    return (
      <FreeLiveScreen
        {...live}
        onPause={handlePause}
        onResume={handleResume}
        onFinish={handleFinish}
      />
    );
  }

  if (phase === 'apres') {
    return (
      <FreeSummaryScreen
        label={after.label}
        activityIcon={after.activityIcon}
        isGuess={after.isGuess}
        justification={after.justification}
        guessConfidence={after.guessConfidence}
        unknownReason={after.unknownReason}
        duration={after.duration}
        distance={after.distance}
        elevation={after.elevation}
        trace={after.trace}
        privacy={after.privacy}
        onTogglePrivacy={handleTogglePrivacy}
        onPickActivity={handlePickActivity}
        onClose={handleClose}
        currentActivityId={activityId}
      />
    );
  }

  return (
    <FreeDepartureScreen
      permission={permission}
      onRequestPermission={requestPermission}
      onStart={handleStart}
      onClose={handleClose}
      onPickActivity={handlePickActivity}
      onUseAutoDetection={() => setActivity(null)}
    />
  );
}

export default FreeDepartureView;


