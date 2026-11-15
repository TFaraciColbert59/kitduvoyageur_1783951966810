'use client';

import React from 'react';

import Button from '@/components/ui/Button';
import LkvIcon from '@/components/ui/LkvIcon';
import type { WatchDeviceInfo, WatchSnapshot } from '@/features/live-tracking';

import { formatAge, formatRemaining } from './model';
import { Chip, PanelCard, SectionHeading, formatDateTime } from './shared';

export interface WatchLiveStatusProps {
  snapshot: WatchSnapshot | null;
  device?: WatchDeviceInfo | null;
  nowMs?: number;
  onSync?: () => void;
  syncing?: boolean;
}

const PLATFORM_LABEL: Record<WatchSnapshot['platform'], string> = {
  apple_watch: 'Apple Watch',
  wear_os: 'Wear OS',
};

export function WatchLiveStatus({
  snapshot,
  device = null,
  nowMs = Date.now(),
  onSync,
  syncing = false,
}: WatchLiveStatusProps) {
  return (
    <PanelCard aria-labelledby="watch-live-title">
      <SectionHeading
        id="watch-live-title"
        eyebrow="Montre"
        title="Suivi depuis le poignet"
        description="Apple Watch et Wear OS peuvent démarrer ou arrêter le partage sans sortir le téléphone."
      />

      {snapshot ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={snapshot.isSharingActive ? 'live' : 'neutral'}>
              {PLATFORM_LABEL[snapshot.platform]}
            </Chip>
            <span className="text-[12px] text-[color:var(--glass-secondary)]">
              {snapshot.isSharingActive
                ? `${snapshot.activeLinkCount} lien${snapshot.activeLinkCount > 1 ? 's' : ''} actif${snapshot.activeLinkCount > 1 ? 's' : ''}`
                : 'Partage inactif'}
            </span>
          </div>
          <dl className="space-y-2 text-[13px]">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[color:var(--glass-secondary)]">Dernière position</dt>
              <dd className="font-medium text-[color:var(--glass-label)]">
                {formatAge(snapshot.lastPositionAgeSeconds)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[color:var(--glass-secondary)]">Échéance</dt>
              <dd className="font-medium text-[color:var(--glass-label)]">
                {snapshot.expiresAtIso
                  ? `${formatRemaining(snapshot.expiresAtIso, nowMs)} · ${formatDateTime(snapshot.expiresAtIso)}`
                  : 'Aucun lien actif'}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl bg-[var(--lkv-surface-muted)] p-4">
          <span aria-hidden className="mt-0.5 text-[color:var(--glass-secondary)]">
            <LkvIcon name="compass" size={22} />
          </span>
          <div>
            <p className="text-[14px] font-medium text-[color:var(--glass-label)]">
              Aucune montre connectée
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--glass-secondary)]">
              L’app mobile transmet l’état du partage à la montre une fois celle-ci appairée. Aucun
              statut n’est inventé sans appareil réel.
            </p>
          </div>
        </div>
      )}

      {device ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Chip tone={device.isPaired ? 'live' : 'danger'}>
              {device.isPaired ? 'Appairée' : 'Non appairée'}
            </Chip>
            <Chip tone={device.hasLocationPermission ? 'live' : 'warning'}>
              {device.hasLocationPermission ? 'Localisation OK' : 'Localisation refusée'}
            </Chip>
            <Chip tone={device.hasBackgroundPermission ? 'live' : 'warning'}>
              {device.hasBackgroundPermission ? 'Arrière-plan OK' : 'Arrière-plan refusé'}
            </Chip>
          </div>
          <p className="text-[11px] text-[color:var(--glass-secondary)]">
            {PLATFORM_LABEL[device.platform]} · OS {device.osVersion} · app {device.appVersion}
          </p>
        </div>
      ) : null}

      {onSync ? (
        <div className="mt-4">
          <Button variant="secondary" size="sm" loading={syncing} onClick={onSync}>
            Synchroniser la montre
          </Button>
        </div>
      ) : null}
    </PanelCard>
  );
}

export default WatchLiveStatus;
