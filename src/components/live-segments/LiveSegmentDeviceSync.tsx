'use client';

/**
 * Lot S03-UI / S4.10 — synchronisation des segments favoris vers un appareil.
 *
 * Le composant ne pousse rien lui-même : il prépare les références compactes
 * côté serveur (checksum, distance, dénivelé, objectif) puis les remet à
 * l'adaptateur natif. Un refus (permission, appareil incompatible, P01) est
 * affiché tel quel, jamais transformé en succès.
 */

import React, { useCallback, useState } from 'react';
import type { DeviceCapability } from '@/features/live-segments';
import type { LiveSegmentsApi } from './api';
import { LiveSegmentsApiError } from './api';
import {
  directionLabel,
  formatDistance,
  formatElevation,
} from './format';
import {
  LiveSegmentBadge,
  LiveSegmentButton,
  LiveSegmentEmpty,
  LiveSegmentPanel,
  LiveSegmentSpinner,
} from './primitives';
import type { DeviceSyncResponse } from './types';
import styles from './live-segments.module.css';

const PLATFORM_LABELS: Record<DeviceCapability['platform'], string> = {
  garmin_connect: 'Garmin Connect',
  wahoo_elemnt: 'Wahoo ELEMNT',
  hammerhead_karoo: 'Hammerhead Karoo',
  apple_watch: 'Apple Watch',
  wear_os: 'Wear OS',
  web_unsupported: 'Web (non compatible)',
};

export interface LiveSegmentDeviceSyncProps {
  device: DeviceCapability;
  segmentIds: readonly string[];
  api: LiveSegmentsApi;
  optedIn?: boolean;
  className?: string;
  onResult?: (result: DeviceSyncResponse) => void;
}

export function LiveSegmentDeviceSync({
  device,
  segmentIds,
  api,
  optedIn = true,
  className,
  onResult,
}: LiveSegmentDeviceSyncProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeviceSyncResponse | null>(null);

  const compatible =
    optedIn && device.supportsLiveSegments && device.platform !== 'web_unsupported';
  const canSync = compatible && device.hasPermission && segmentIds.length > 0;

  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.sync({
        device,
        segmentIds: [...segmentIds],
        optedIn,
      });
      setResult(response);
      onResult?.(response);
    } catch (cause) {
      setError(
        cause instanceof LiveSegmentsApiError
          ? cause.message
          : 'La synchronisation a échoué. Réessayez plus tard.',
      );
    } finally {
      setLoading(false);
    }
  }, [api, device, onResult, optedIn, segmentIds]);

  return (
    <LiveSegmentPanel
      className={[styles.panel, className].filter(Boolean).join(' ')}
      ariaLabel="Synchronisation de l’appareil"
      testId="live-segment-device-sync"
    >
      <div className={styles.panelHeader}>
        <div className={styles.headingBlock}>
          <p className={styles.eyebrow}>Appareil</p>
          <h2 className={styles.title}>{device.deviceName}</h2>
          <p className={styles.subtitle}>
            {PLATFORM_LABELS[device.platform]} · {device.maxSyncedSegments} segments maximum
          </p>
        </div>
        <LiveSegmentBadge
          tone={compatible ? (device.isOnline ? 'success' : 'warning') : 'danger'}
          icon={compatible ? (device.isOnline ? 'check' : 'offline') : 'alert'}
        >
          {!optedIn
            ? 'Désactivé'
            : !compatible
              ? 'Incompatible'
              : !device.hasPermission
                ? 'Permission refusée'
                : device.isOnline
                  ? 'Prêt'
                  : 'Hors ligne'}
        </LiveSegmentBadge>
      </div>

      <p className={styles.subtitle}>
        Envoie uniquement les références compactes : nom, distance, dénivelé, checksum et
        objectif fantôme. La trace complète reste sur le téléphone.
      </p>

      {!canSync ? (
        <LiveSegmentEmpty
          icon="alert"
          title="Synchronisation indisponible"
          description={
            !optedIn
              ? 'Les Live Segments sont désactivés dans vos réglages de confidentialité.'
              : !compatible
                ? 'Cet appareil ne prend pas en charge les Live Segments.'
                : !device.hasPermission
                  ? 'Autorisez l’accès aux segments sur l’appareil.'
                  : 'Aucun segment favori à synchroniser.'
          }
        />
      ) : (
        <LiveSegmentButton fullWidth onClick={() => void sync()} disabled={loading}>
          {loading ? 'Préparation…' : `Synchroniser ${segmentIds.length} segment(s)`}
        </LiveSegmentButton>
      )}

      {loading ? <LiveSegmentSpinner label="Préparation des références" /> : null}

      {error ? (
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className={styles.syncResult} role="status">
          <div className={styles.panelHeader}>
            <div className={styles.headingBlock}>
              <p className={styles.eyebrow}>Résultat</p>
              <p className={styles.title}>
                {result.references.length} référence(s) prête(s)
              </p>
              <p className={styles.subtitle}>
                {result.offline
                  ? 'Appareil hors ligne : les références sont à conserver dans la file locale.'
                  : 'Références remises à l’adaptateur de l’appareil.'}
              </p>
            </div>
            <LiveSegmentBadge tone="info" icon="send">
              {result.references.length}
            </LiveSegmentBadge>
          </div>

          {result.references.length === 0 ? (
            <LiveSegmentEmpty
              icon="info"
              title="Aucune référence"
              description="Aucun segment n’est éligible pour cet appareil."
            />
          ) : (
            <ul className={styles.referenceList} aria-label="Références synchronisées">
              {result.references.map((reference) => (
                <li key={reference.segmentId} className={styles.referenceItem}>
                  <div className={styles.headingBlock}>
                    <span className={styles.referenceName}>{reference.name}</span>
                    <span className={styles.subtitle}>
                      {reference.direction === 'forward'
                        ? 'FWD'
                        : reference.direction === 'reverse'
                          ? 'REV'
                          : directionLabel(reference.direction)}
                      {' · '}
                      {formatDistance(reference.totalDistanceM)} ·{' '}
                      {formatElevation(reference.elevationGainM)}
                    </span>
                  </div>
                  <span className={styles.referenceGhost}>
                    {reference.targetGhost
                      ? reference.targetGhost.label
                      : 'Sans fantôme'}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {result.skippedSegmentIds.length > 0 ? (
            <p className={styles.segmentGhostMuted}>
              {result.skippedSegmentIds.length} segment(s) ignoré(s) (limite, sport ou
              confidentialité).
            </p>
          ) : null}
        </div>
      ) : null}
    </LiveSegmentPanel>
  );
}
