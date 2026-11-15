'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bluetooth, HeartPulse, RefreshCw, ShieldCheck, Watch } from 'lucide-react';
import AppShell from '@/components/shell/AppShell';
import Button from '@/components/ui/Button';
import { CapsuleTabs } from '@/components/ui/CapsuleTabs';
import { EmptyState } from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import {
  ALL_HEALTH_CONSENT_SCOPES,
  BleSensorManager,
  HealthSyncService,
  P01_CONSENT_POLICY_VERSION,
  createDefaultHealthConsentState,
  grantHealthConsent,
  revokeHealthConsent,
} from '@/features/sensors';
import type {
  BleSensorDevice,
  BleServiceKind,
  HealthBridgeAvailability,
  HealthConsentScope,
  HealthConsentState,
  HealthWorkoutReadResult,
  QualifiedTelemetrySnapshot,
} from '@/features/sensors';
import BleDeviceCard from './BleDeviceCard';
import HealthConsentPanel from './HealthConsentPanel';
import HealthSyncPanel, { type HealthBusyAction } from './HealthSyncPanel';
import SensorTelemetryPanel from './SensorTelemetryPanel';
import {
  createConsentTransport,
  type ConsentTransport,
} from './consentClient';
import './sensors.css';

const SENSOR_SERVICES: readonly BleServiceKind[] = [
  'heart_rate',
  'cycling_sc',
  'cycling_power',
  'running_sc',
];

const READ_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type SensorsTabId = 'sensors' | 'health';

export interface SensorsScreenProps {
  /** Injection réservée aux tests et à l'app native. */
  manager?: BleSensorManager;
  healthService?: HealthSyncService;
  initialConsent?: HealthConsentState;
  /** `null` désactive la synchronisation serveur (tests hors réseau). */
  consentTransport?: ConsentTransport | null;
  now?: () => number;
  initialTab?: SensorsTabId;
}

/**
 * Écran « Capteurs & Santé » — S6.03 / S6.06 / S6.07.
 *
 * Le manager BLE et le service Santé sont ceux du contrat D02. L'écran ne
 * fabrique aucune mesure : sans capteur réel, chaque métrique reste
 * `unavailable` et le pont Web annonce `native_bridge_unavailable`.
 */
export function SensorsScreen({
  manager: managerProp,
  healthService: healthServiceProp,
  initialConsent,
  consentTransport,
  now = Date.now,
  initialTab = 'sensors',
}: SensorsScreenProps) {
  const [manager] = useState(() => managerProp ?? new BleSensorManager());
  const [healthService] = useState(
    () => healthServiceProp ?? new HealthSyncService({ initialConsent: initialConsent }),
  );
  const [transport] = useState<ConsentTransport | null>(() =>
    consentTransport === undefined ? createConsentTransport() : consentTransport,
  );

  const [tab, setTab] = useState<SensorsTabId>(initialTab);
  const [devices, setDevices] = useState<BleSensorDevice[]>(() => manager.getDevices());
  const [snapshot, setSnapshot] = useState<QualifiedTelemetrySnapshot>(() =>
    manager.getTelemetrySnapshot(now()),
  );
  const [nowMs, setNowMs] = useState(() => now());
  const [scanning, setScanning] = useState(false);
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [consent, setConsent] = useState<HealthConsentState>(
    () => initialConsent ?? createDefaultHealthConsentState(),
  );
  const [consentNotice, setConsentNotice] = useState<string | null>(null);
  const [availability, setAvailability] = useState<HealthBridgeAvailability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [healthBusy, setHealthBusy] = useState<HealthBusyAction>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [readResult, setReadResult] = useState<HealthWorkoutReadResult | null>(null);

  const refreshSensorState = useCallback(
    (at: number) => {
      setNowMs(at);
      setDevices(manager.getDevices());
      setSnapshot(manager.getTelemetrySnapshot(at));
    },
    [manager],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const at = now();
      setNowMs(at);
      setSnapshot(manager.getTelemetrySnapshot(at));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [manager, now]);

  useEffect(() => {
    healthService.setConsentState(consent);
  }, [consent, healthService]);

  useEffect(() => {
    if (!transport) return;
    let cancelled = false;
    transport
      .load()
      .then((loaded) => {
        if (cancelled || !loaded) return;
        setConsent(loaded);
        healthService.setConsentState(loaded);
      })
      .catch(() => {
        /* le repli local est déjà chargé */
      });
    return () => {
      cancelled = true;
    };
  }, [transport, healthService]);

  useEffect(() => {
    let cancelled = false;
    setAvailabilityLoading(true);
    healthService
      .getAvailability()
      .then((result) => {
        if (cancelled) return;
        setAvailability(result);
      })
      .catch(() => {
        if (cancelled) return;
        setAvailability({
          platform: 'web',
          provider: null,
          status: 'native_bridge_unavailable',
          reason: 'La vérification du pont Santé a échoué.',
        });
        setHealthError('La vérification du pont Santé a échoué.');
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [healthService]);

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    setNotice(null);
    try {
      const result = await manager.scan(SENSOR_SERVICES, now());
      setDevices(result.devices);
      if (!result.available) {
        setNotice(
          'Bluetooth LE n’est pas disponible dans ce navigateur. Ouvre l’app iOS ou Android pour appairer un capteur réel.',
        );
      } else if (result.devices.length === 0) {
        setNotice('Aucun capteur réel détecté. Aucune fréquence cardiaque n’est simulée.');
      } else {
        setNotice(`${result.devices.length} capteur(s) détecté(s).`);
      }
    } catch {
      setNotice('La recherche Bluetooth a échoué. Aucun capteur n’a été ajouté.');
    } finally {
      setScanning(false);
      refreshSensorState(now());
    }
  };

  const handleConnect = async (deviceId: string) => {
    setBusyDeviceId(deviceId);
    setNotice(null);
    try {
      const device = await manager.connect(deviceId, now());
      if (!device) {
        setNotice('Capteur inconnu : reconnexion impossible.');
      } else if (device.state === 'connected') {
        setNotice(`${device.name || 'Capteur'} connecté.`);
      } else {
        setNotice(device.lastError ?? 'La connexion Bluetooth a échoué.');
      }
    } catch {
      setNotice('La connexion Bluetooth a échoué.');
    } finally {
      setBusyDeviceId(null);
      refreshSensorState(now());
    }
  };

  const handleDisconnect = async (deviceId: string) => {
    setBusyDeviceId(deviceId);
    setNotice(null);
    try {
      await manager.disconnect(deviceId, now());
    } catch {
      setNotice('La déconnexion a échoué.');
    } finally {
      setBusyDeviceId(null);
      refreshSensorState(now());
    }
  };

  const persistConsent = (next: HealthConsentState) => {
    setConsent(next);
    setConsentNotice(null);
    if (!transport) return;
    transport
      .save(next)
      .then((saved) => {
        if (saved) {
          setConsent(saved);
          healthService.setConsentState(saved);
        } else {
          setConsentNotice('Consentement conservé sur cet appareil ; le serveur n’a pas répondu.');
        }
      })
      .catch(() => {
        setConsentNotice('Consentement conservé sur cet appareil ; le serveur n’a pas répondu.');
      });
  };

  const handleToggleConsent = (scope: HealthConsentScope, granted: boolean) => {
    const at = now();
    const next = granted
      ? grantHealthConsent(consent, [scope], 'user_prompt', at)
      : revokeHealthConsent(consent, [scope], 'settings', at);
    persistConsent(next);
  };

  const handleRequestPermissions = async () => {
    const scopes = ALL_HEALTH_CONSENT_SCOPES.filter((scope) => consent.grants[scope]?.granted);
    if (scopes.length === 0) {
      setHealthError('Cochez au moins un scope avant de demander l’autorisation au système.');
      return;
    }
    setHealthBusy('permissions');
    setHealthError(null);
    try {
      healthService.setConsentState(consent);
      const result = await healthService.requestPermissions(scopes, now());
      setAvailability(result.availability);
      persistConsent(result.consentState);
      if (result.availability.status === 'native_bridge_unavailable') {
        setHealthError(result.availability.reason ?? 'Le pont Santé natif est indisponible.');
      }
    } catch {
      setHealthError('La demande d’autorisation Santé a échoué.');
    } finally {
      setHealthBusy(null);
    }
  };

  const handleReadWorkouts = async () => {
    setHealthBusy('read');
    setHealthError(null);
    setReadResult(null);
    try {
      const at = now();
      healthService.setConsentState(consent);
      const result = await healthService.readWorkouts({
        sinceMs: at - READ_WINDOW_MS,
        untilMs: at,
        requiredScopes: ['workouts_read'],
      });
      if (result.ok) {
        setReadResult(result.data);
      } else {
        setHealthError(result.reason);
      }
    } catch {
      setHealthError('La lecture des séances Santé a échoué.');
    } finally {
      setHealthBusy(null);
    }
  };

  const tabs = [
    { id: 'sensors', label: 'Capteurs', icon: <Bluetooth size={16} /> },
    { id: 'health', label: 'Santé', icon: <HeartPulse size={16} /> },
  ];
  const activeIndex = tab === 'sensors' ? 0 : 1;

  return (
    <AppShell>
      <div className="lkdv-sensors">
        <PageHeader
          variant="large"
          back
          backHref="/compte"
          backLabel="Retour au compte"
          title="Capteurs & Santé"
          subtitle="BLE GATT, HealthKit et Health Connect"
        />

        <div className="lkdv-sensors-hero lkv-glass">
          <span aria-hidden="true">
            <ShieldCheck size={19} />
          </span>
          <div>
            <b>Rien n’est simulé</b>
            <p>
              Une mesure absente reste indisponible. Un capteur non appairé n’affiche jamais de
              fréquence cardiaque inventée.
            </p>
          </div>
        </div>

        <CapsuleTabs
          items={tabs}
          activeIndex={activeIndex}
          onIndexChange={(index) => setTab(index === 1 ? 'health' : 'sensors')}
          ariaLabel="Capteurs et Santé"
          idFor={(id) => `lkdv-sensors-tab-${id}`}
          panelIdFor={(id) => `lkdv-sensors-panel-${id}`}
        />

        <div
          role="tabpanel"
          id={`lkdv-sensors-panel-${tab}`}
          aria-labelledby={`lkdv-sensors-tab-${tab}`}
          className="lkdv-sensors-panel"
        >
          {tab === 'sensors' ? (
            <>
              <section className="lkdv-sensor-scanbar lkv-glass" aria-label="Recherche de capteurs">
                <div>
                  <b>Capteurs BLE</b>
                  <span>
                    {devices.length === 0
                      ? 'Aucun appareil connu'
                      : `${devices.length} appareil(s) connu(s)`}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<RefreshCw size={15} />}
                  onClick={() => void handleScan()}
                  loading={scanning}
                >
                  Rechercher
                </Button>
              </section>

              {notice ? (
                <p className="lkdv-sensor-notice" role="status">
                  {notice}
                </p>
              ) : null}

              {devices.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Bluetooth size={24} aria-hidden="true" />}
                  title="Aucun capteur appairé"
                  description="Lancez une recherche : seuls les capteurs BLE réellement détectés apparaîtront."
                />
              ) : (
                <div className="lkdv-sensor-device-list">
                  {devices.map((device) => (
                    <BleDeviceCard
                      key={device.deviceId}
                      device={device}
                      nowMs={nowMs}
                      busy={busyDeviceId === device.deviceId}
                      onConnect={(deviceId) => void handleConnect(deviceId)}
                      onDisconnect={(deviceId) => void handleDisconnect(deviceId)}
                    />
                  ))}
                </div>
              )}

              <SensorTelemetryPanel
                snapshot={snapshot}
                nowMs={nowMs}
                summary={manager.getTelemetrySummary()}
              />
            </>
          ) : (
            <>
              <HealthSyncPanel
                availability={availability}
                availabilityLoading={availabilityLoading}
                consentState={consent}
                readResult={readResult}
                busyAction={healthBusy}
                error={healthError}
                onRequestPermissions={() => void handleRequestPermissions()}
                onReadWorkouts={() => void handleReadWorkouts()}
              />

              {consentNotice ? (
                <p className="lkdv-sensor-notice" role="status">
                  {consentNotice}
                </p>
              ) : null}

              <HealthConsentPanel
                state={consent}
                onToggle={handleToggleConsent}
                disabled={healthBusy !== null}
              />

              <p className="lkdv-sensors-policy">
                Politique de consentement {P01_CONSENT_POLICY_VERSION} · aucun scope accordé par
                défaut.
              </p>
            </>
          )}
        </div>

        <div className="lkdv-sensors-footer" aria-hidden="true">
          <Watch size={14} /> D02 · S6.03 · S6.06 · S6.07
        </div>
      </div>
    </AppShell>
  );
}

export default SensorsScreen;
