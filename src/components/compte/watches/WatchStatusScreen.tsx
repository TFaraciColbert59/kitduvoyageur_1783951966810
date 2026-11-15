'use client';

/**
 * Lot D03-UI — écran « Montres » : diagnostic natif, compatibilité et
 * déclaration d'un appareil.
 *
 * Le diagnostic est fail-closed : tant que les cibles WatchKit / Gradle
 * `:wear` ne sont pas compilées, l'écran affiche « Cible native absente » et
 * n'annonce aucune capacité matérielle.
 */

import React, { useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import type {
  WatchDeviceProfile,
  WatchPermissionSnapshot,
  WatchPlatform,
} from '@/features/watches';
import {
  PLATFORMS,
  formatBytes,
  nativeStatusLabel,
  platformLabel,
} from './format';
import {
  Button,
  Card,
  Notice,
  Section,
  StatusPill,
  type PillTone,
} from './primitives';
import { WatchCapabilityGrid } from './WatchCapabilityGrid';
import type { WatchDeviceRegistrationResponse, WatchStatusResponse } from './types';

function statusTone(status: WatchStatusResponse['status']): PillTone {
  return status === 'available' ? 'ok' : 'error';
}

function createDeviceId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `watch-${cryptoApi.randomUUID()}`;
  }
  return `watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_PERMISSIONS: WatchPermissionSnapshot = {
  locationWhenInUse: 'prompt',
  locationAlwaysOrWorkout: 'prompt',
  healthWorkoutWrite: 'prompt',
  healthMetricsRead: 'prompt',
};

export interface WatchStatusScreenProps {
  status: WatchStatusResponse | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRegisterDevice?: (
    profile: WatchDeviceProfile,
  ) => Promise<WatchDeviceRegistrationResponse | void>;
  onRemoveDevice?: (deviceId: string) => Promise<void>;
}

export function WatchStatusScreen({
  status,
  loading = false,
  error = null,
  onRetry,
  onRegisterDevice,
  onRemoveDevice,
}: WatchStatusScreenProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const devices = status?.devices ?? [];
  const selected = useMemo(
    () => devices.find((device) => device.profile.deviceId === selectedDeviceId) ?? devices[0] ?? null,
    [devices, selectedDeviceId],
  );
  const capabilities = selected?.capabilities ?? status?.capabilities;

  if (loading && !status) {
    return (
      <Card>
        <p className="lkv-watch__hint" role="status">
          Lecture du diagnostic natif…
        </p>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <Notice tone="error">{error ?? 'Diagnostic des montres indisponible.'}</Notice>
        {onRetry ? <Button onClick={onRetry}>Réessayer</Button> : null}
      </Card>
    );
  }

  const unavailable = status.status !== 'available';
  const missingTargets = status.diagnostic.missingTargets ?? [];

  async function submitDevice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onRegisterDevice) return;
    const form = new FormData(event.currentTarget);
    const modelName = String(form.get('modelName') ?? '').trim();
    const osVersion = String(form.get('osVersion') ?? '').trim();
    if (modelName.length === 0 || osVersion.length === 0) {
      setFormError('Le modèle et la version du système sont requis.');
      return;
    }
    const profile: WatchDeviceProfile = {
      deviceId: createDeviceId(),
      platform: String(form.get('platform') ?? 'apple_watch') as WatchPlatform,
      modelName,
      osVersion,
      hasBuiltInGps: form.get('hasBuiltInGps') === 'on',
      storageAvailableBytes:
        Math.max(0, Number(form.get('storageMb') ?? 0)) * 1024 * 1024,
      batteryPercent:
        form.get('batteryPercent') === null || String(form.get('batteryPercent')).length === 0
          ? null
          : Number(form.get('batteryPercent')),
      pairedPhonePlatform: String(form.get('pairedPhonePlatform') ?? 'ios') as
        | 'ios'
        | 'android'
        | 'web',
      permissions: {
        ...DEFAULT_PERMISSIONS,
        locationWhenInUse: String(form.get('locationWhenInUse') ?? 'prompt') as
          WatchPermissionSnapshot['locationWhenInUse'],
        locationAlwaysOrWorkout: String(
          form.get('locationAlwaysOrWorkout') ?? 'prompt',
        ) as WatchPermissionSnapshot['locationAlwaysOrWorkout'],
        healthWorkoutWrite: String(form.get('healthWorkoutWrite') ?? 'prompt') as
          WatchPermissionSnapshot['healthWorkoutWrite'],
        healthMetricsRead: String(form.get('healthMetricsRead') ?? 'prompt') as
          WatchPermissionSnapshot['healthMetricsRead'],
      },
    };
    setBusy(true);
    setFormError(null);
    try {
      await onRegisterDevice(profile);
      setSelectedDeviceId(profile.deviceId);
      setShowForm(false);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Déclaration impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function removeDevice(deviceId: string) {
    if (!onRemoveDevice) return;
    setBusy(true);
    try {
      await onRemoveDevice(deviceId);
      if (selectedDeviceId === deviceId) setSelectedDeviceId(null);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Suppression impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lkv-watch__stack" data-testid="watch-status-screen">
      {error ? (
        <Notice tone="error">
          {error} {onRetry ? <Button onClick={onRetry}>Réessayer</Button> : null}
        </Notice>
      ) : null}

      <Card className="lkv-watch__hero" data-status={status.status}>
        <div className="lkv-watch__hero-copy">
          <p className="lkv-watch__eyebrow">S6.01 · Diagnostic natif</p>
          <h2 className="lkv-watch__hero-title">Applications montre</h2>
          <p className="lkv-watch__hero-sub">
            Apple Watch, Wear OS et Galaxy Watch partagent le même contrat de séance,
            de paquets hors ligne et de Live Sync.
          </p>
        </div>
        <StatusPill tone={statusTone(status.status)}>
          {nativeStatusLabel(status.status)}
        </StatusPill>
      </Card>

      {unavailable ? (
        <Notice tone="error">
          <strong>Cible native absente :</strong> aucune séance ne peut être enregistrée
          directement sur la montre tant que les cibles Xcode WatchKit et le module Gradle
          Wear OS ne sont pas compilés. Le contrat, la file hors ligne et les écrans restent
          utilisables, mais aucune capacité matérielle n’est simulée.
        </Notice>
      ) : (
        <Notice tone="ok">Pont compagnon natif détecté : les capacités sont résolues ci-dessous.</Notice>
      )}

      <Section
        title="Périmètre natif manquant"
        hint="Chaque cible listée est vérifiée dans le dépôt ; son absence est explicite."
      >
        {missingTargets.length === 0 ? (
          <Notice tone="ok">Aucune cible native manquante.</Notice>
        ) : (
          <ul className="lkv-watch__list">
            {missingTargets.map((target) => (
              <li key={`${target.platform}-${target.expectedTargetType}`}>
                <Card as="article" className="lkv-watch__target">
                  <div className="lkv-watch__row">
                    <strong>{platformLabel(target.platform)}</strong>
                    <StatusPill tone={target.presentInRepo ? 'ok' : 'error'}>
                      {target.presentInRepo ? 'Présente' : 'Absente'}
                    </StatusPill>
                  </div>
                  <p className="lkv-watch__hint">
                    Attendu : <code>{target.expectedProjectPath}</code>
                  </p>
                  <details>
                    <summary>{target.missingComponents.length} composant(s) manquant(s)</summary>
                    <ul className="lkv-watch__sublist">
                      {target.missingComponents.map((component) => (
                        <li key={component}>{component}</li>
                      ))}
                    </ul>
                  </details>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Matrice de compatibilité"
        hint="Versions minimales, transport et API natives par plateforme."
      >
        <div className="lkv-watch__grid lkv-watch__grid--3">
          {status.matrix.map((entry) => (
            <Card as="article" key={entry.platform}>
              <div className="lkv-watch__row">
                <h3 className="lkv-watch__card-title">{platformLabel(entry.platform)}</h3>
                <StatusPill tone="neutral">{entry.vendor}</StatusPill>
              </div>
              <dl className="lkv-watch__facts">
                <div>
                  <dt>OS minimum</dt>
                  <dd>{entry.minOsVersion}</dd>
                </div>
                <div>
                  <dt>Transport</dt>
                  <dd>{entry.transportChannel === 'watch_connectivity' ? 'WatchConnectivity' : 'Wear DataLayer'}</dd>
                </div>
              </dl>
              <p className="lkv-watch__hint">Modèles : {entry.modelsSupported.join(' · ')}</p>
              <p className="lkv-watch__hint">API : {entry.nativeApis.join(' · ')}</p>
              <p className="lkv-watch__hint">Fiches : {entry.ficheRefs.join(', ')}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="Mes montres"
        hint="Le profil déclaré sert à résoudre les capacités ; il n’en autorise aucune par défaut."
        action={
          onRegisterDevice ? (
            <Button onClick={() => setShowForm((value) => !value)} aria-expanded={showForm}>
              <Plus size={16} aria-hidden="true" /> Déclarer une montre
            </Button>
          ) : undefined
        }
      >
        {showForm && onRegisterDevice ? (
          <Card as="section" className="lkv-watch__form-card">
            <form className="lkv-watch__form" onSubmit={(event) => void submitDevice(event)}>
              <div className="lkv-watch__field">
                <label htmlFor="watch-platform">Plateforme</label>
                <select id="watch-platform" name="platform" defaultValue="apple_watch">
                  {PLATFORMS.map((item) => (
                    <option key={item.platform} value={item.platform}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lkv-watch__field">
                <label htmlFor="watch-model">Modèle</label>
                <input id="watch-model" name="modelName" placeholder="Apple Watch Ultra 2" required />
              </div>
              <div className="lkv-watch__field">
                <label htmlFor="watch-os">Version du système</label>
                <input id="watch-os" name="osVersion" defaultValue="11.0" required />
              </div>
              <div className="lkv-watch__field">
                <label htmlFor="watch-storage">Stockage libre (Mo)</label>
                <input id="watch-storage" name="storageMb" type="number" min={0} defaultValue={64} />
              </div>
              <div className="lkv-watch__field">
                <label htmlFor="watch-battery">Batterie (%)</label>
                <input
                  id="watch-battery"
                  name="batteryPercent"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={80}
                />
              </div>
              <div className="lkv-watch__field">
                <label htmlFor="watch-phone">Téléphone associé</label>
                <select id="watch-phone" name="pairedPhonePlatform" defaultValue="ios">
                  <option value="ios">iOS</option>
                  <option value="android">Android</option>
                  <option value="web">Web</option>
                </select>
              </div>
              <div className="lkv-watch__field">
                <label htmlFor="watch-location">Localisation à l’usage</label>
                <select id="watch-location" name="locationWhenInUse" defaultValue="prompt">
                  <option value="granted">Accordée</option>
                  <option value="prompt">À demander</option>
                  <option value="denied">Refusée</option>
                </select>
              </div>
              <div className="lkv-watch__field">
                <label htmlFor="watch-location-always">Localisation séance</label>
                <select id="watch-location-always" name="locationAlwaysOrWorkout" defaultValue="prompt">
                  <option value="granted">Accordée</option>
                  <option value="prompt">À demander</option>
                  <option value="denied">Refusée</option>
                </select>
              </div>
              <div className="lkv-watch__field">
                <label htmlFor="watch-health-write">Écriture séance Santé</label>
                <select id="watch-health-write" name="healthWorkoutWrite" defaultValue="prompt">
                  <option value="granted">Accordée</option>
                  <option value="prompt">À demander</option>
                  <option value="denied">Refusée</option>
                </select>
              </div>
              <div className="lkv-watch__field">
                <label htmlFor="watch-health-read">Lecture cardio Santé</label>
                <select id="watch-health-read" name="healthMetricsRead" defaultValue="prompt">
                  <option value="granted">Accordée</option>
                  <option value="prompt">À demander</option>
                  <option value="indeterminate">Indéterminée</option>
                  <option value="denied">Refusée</option>
                </select>
              </div>
              <label className="lkv-watch__check">
                <input type="checkbox" name="hasBuiltInGps" defaultChecked />
                GPS intégré à la montre
              </label>
              {formError ? <Notice tone="error">{formError}</Notice> : null}
              <div className="lkv-watch__actions">
                <Button type="submit" variant="primary" disabled={busy}>
                  Enregistrer la montre
                </Button>
                <Button variant="ghost" onClick={() => setShowForm(false)} disabled={busy}>
                  Annuler
                </Button>
              </div>
            </form>
          </Card>
        ) : null}

        {devices.length === 0 ? (
          <Notice tone="info">
            Aucune montre déclarée. Sans profil, la matrice reste alignée sur le diagnostic
            natif et n’invente aucune capacité.
          </Notice>
        ) : (
          <div className="lkv-watch__device-picker" role="list">
            {devices.map((device) => (
              <Card as="article" key={device.profile.deviceId} className="lkv-watch__device">
                <button
                  type="button"
                  className="lkv-watch__device-select"
                  aria-pressed={selected?.profile.deviceId === device.profile.deviceId}
                  onClick={() => setSelectedDeviceId(device.profile.deviceId)}
                >
                  <strong>{device.profile.modelName}</strong>
                  <span>{platformLabel(device.profile.platform)} · {device.profile.osVersion}</span>
                  <span>Stockage libre : {formatBytes(device.profile.storageAvailableBytes)}</span>
                </button>
                {onRemoveDevice ? (
                  <Button
                    variant="ghost"
                    aria-label={`Retirer ${device.profile.modelName}`}
                    onClick={() => void removeDevice(device.profile.deviceId)}
                    disabled={busy}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </Button>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </Section>

      {capabilities ? (
        <Section
          title={selected ? `Capacités · ${selected.profile.modelName}` : 'Capacités résolues'}
          hint="Une capacité indisponible n’est jamais remplacée par une valeur supposée."
          action={
            <Button variant="ghost" onClick={onRetry} disabled={!onRetry}>
              <RefreshCw size={15} aria-hidden="true" /> Rafraîchir
            </Button>
          }
        >
          <Card>
            <WatchCapabilityGrid capabilities={capabilities} />
          </Card>
        </Section>
      ) : null}
    </div>
  );
}
