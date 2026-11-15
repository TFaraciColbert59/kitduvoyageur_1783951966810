'use client';

import React from 'react';
import { Battery, Bluetooth, Link2, RefreshCw, Unlink2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { BleSensorDevice } from '@/features/sensors';
import SensorStatusBadge, { type SensorStatusTone } from './SensorStatusBadge';
import {
  batteryStatusLabel,
  bleServiceLabel,
  formatBatteryPercent,
  formatDeviceId,
  formatMeasurementAge,
  formatReconnectDelay,
  formatRssi,
  sensorStateLabel,
} from './sensorFormat';

function stateTone(device: BleSensorDevice): SensorStatusTone {
  switch (device.state) {
    case 'connected':
      return 'success';
    case 'connecting':
    case 'reconnecting':
    case 'scanning':
      return 'info';
    case 'permission_denied':
    case 'error':
      return 'danger';
    case 'unavailable':
    case 'disconnected':
      return 'warning';
    default:
      return 'neutral';
  }
}

function batteryTone(device: BleSensorDevice): SensorStatusTone {
  switch (device.batteryStatus) {
    case 'critical':
      return 'danger';
    case 'low':
      return 'warning';
    case 'normal':
      return 'success';
    default:
      return 'neutral';
  }
}

export interface BleDeviceCardProps {
  device: BleSensorDevice;
  nowMs: number;
  busy?: boolean;
  onConnect: (deviceId: string) => void;
  onDisconnect: (deviceId: string) => void;
}

/**
 * Carte d'un capteur réel. Toutes les valeurs absentes restent des tirets :
 * aucun RSSI, niveau de batterie ou état n'est simulé.
 */
export function BleDeviceCard({
  device,
  nowMs,
  busy = false,
  onConnect,
  onDisconnect,
}: BleDeviceCardProps) {
  const canDisconnect = device.state === 'connected';
  const connecting = device.state === 'connecting' || device.state === 'reconnecting';

  return (
    <article className="lkdv-sensor-device lkv-glass" data-state={device.state} aria-busy={busy}>
      <header className="lkdv-sensor-device-head">
        <span className="lkdv-sensor-device-ico" aria-hidden="true">
          <Bluetooth size={18} />
        </span>
        <div className="lkdv-sensor-device-title">
          <h3>{device.name || 'Capteur sans nom'}</h3>
          <p>{formatDeviceId(device.deviceId)}</p>
        </div>
        <SensorStatusBadge label={sensorStateLabel(device.state)} tone={stateTone(device)} />
      </header>

      <div className="lkdv-sensor-chip-row" aria-label="Services GATT détectés">
        {device.services.length > 0 ? (
          device.services.map((service) => (
            <span className="lkdv-sensor-chip" key={service}>
              {bleServiceLabel(service)}
            </span>
          ))
        ) : (
          <span className="lkdv-sensor-chip" data-empty="true">
            Services non détectés
          </span>
        )}
        {device.paired ? <span className="lkdv-sensor-chip">Appairé</span> : null}
      </div>

      <dl className="lkdv-sensor-device-facts">
        <div>
          <dt>Signal</dt>
          <dd>{formatRssi(device.rssi)}</dd>
        </div>
        <div>
          <dt>
            <Battery size={13} aria-hidden="true" /> Batterie
          </dt>
          <dd>
            {formatBatteryPercent(device.batteryPercent)}
            <span className="lkdv-sensor-fact-hint" data-tone={batteryTone(device)}>
              {batteryStatusLabel(device.batteryStatus)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Dernière vue</dt>
          <dd>{formatMeasurementAge(device.lastSeenAtMs, nowMs)}</dd>
        </div>
      </dl>

      {device.state === 'reconnecting' ? (
        <p className="lkdv-sensor-device-notice" role="status">
          <RefreshCw size={14} aria-hidden="true" />
          Tentative {device.reconnectAttempt} · prochaine dans{' '}
          {formatReconnectDelay(device.nextReconnectDelayMs)}
        </p>
      ) : null}

      {device.lastError ? (
        <p className="lkdv-sensor-device-error" role="alert">
          {device.lastError}
        </p>
      ) : null}

      <footer className="lkdv-sensor-device-actions">
        {canDisconnect ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<Unlink2 size={15} />}
            onClick={() => onDisconnect(device.deviceId)}
            disabled={busy}
          >
            Déconnecter
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            icon={connecting ? <RefreshCw size={15} /> : <Link2 size={15} />}
            onClick={() => onConnect(device.deviceId)}
            loading={busy || connecting}
            disabled={busy || connecting}
          >
            {device.paired ? 'Reconnecter' : 'Connecter'}
          </Button>
        )}
      </footer>
    </article>
  );
}

export default BleDeviceCard;
