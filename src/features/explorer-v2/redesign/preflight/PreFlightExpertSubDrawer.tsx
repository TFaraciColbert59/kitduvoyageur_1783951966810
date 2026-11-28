'use client';

import React from 'react';
import {
  Bluetooth,
  Check,
  Compass,
  Download,
  Gauge,
  PauseCircle,
  Radio,
  Shield,
  ShieldCheck,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type { ActivityProfileSpec } from '../../specs/activityProfileSpec.types';
import { ExplorerNestedSubDrawer } from '../primitives/ExplorerNestedSubDrawer';
import { formatPipelineLabelFr, IosToggleSwitch } from '../primitives/IosGlassControls';

export interface PreFlightExpertSettings {
  beaconEnabled: boolean;
  epzRadiusM: number;
  autoPauseEnabled: boolean;
  voiceGuidanceEnabled: boolean;
  baroAutoCalibrate: boolean;
  selectedBleSensors: string[];
}

export interface PreFlightExpertSubDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ActivityProfileSpec;
  settings: PreFlightExpertSettings;
  onChangeSettings: (patch: Partial<PreFlightExpertSettings>) => void;
  beraRiskLevel?: number | null;
  offlineReady?: boolean;
  onDownloadOffline?: () => void;
  hasProEntitlement?: boolean;
}

const BLE_GATT_META: Record<string, { title: string; subtitle: string }> = {
  '0x180D': { title: 'Ceinture cardiaque', subtitle: 'Fréquence cardiaque temps réel · GATT 0x180D' },
  '0x1814': { title: 'Podomètre & Foulée', subtitle: 'Allure & cadence course · GATT 0x1814' },
  '0x1816': { title: 'Cadence & Vitesse vélo', subtitle: 'Capteur roue/pédalier · GATT 0x1816' },
  '0x1818': { title: 'Capteur de puissance', subtitle: 'Watts & NP · GATT 0x1818' },
  '0x1826': { title: 'Home-Trainer / Erg', subtitle: 'Contrôle FTMS & ERG · GATT 0x1826' },
};

const EPZ_RADII = [0, 200, 500, 1000] as const;

export function PreFlightExpertSubDrawer({
  open,
  onOpenChange,
  profile,
  settings,
  onChangeSettings,
  beraRiskLevel = null,
  offlineReady = false,
  onDownloadOffline,
  hasProEntitlement = false,
}: PreFlightExpertSubDrawerProps) {
  const showBera =
    profile.environment.weatherEndpoints.includes('meteo_france_bra') ||
    profile.identity.familyId === 'snow_winter' ||
    profile.identity.familyId === 'alpinism_vertical';

  const supportedBleUuids = [
    ...profile.acquisition.bleServices.recommended,
    ...profile.acquisition.bleServices.optional,
  ];

  const toggleSensor = (uuid: string) => {
    const exists = settings.selectedBleSensors.includes(uuid);
    const next = exists
      ? settings.selectedBleSensors.filter((u) => u !== uuid)
      : [...settings.selectedBleSensors, uuid];
    onChangeSettings({ selectedBleSensors: next });
  };

  const sectionCardStyle: React.CSSProperties = {
    borderRadius: 22,
    padding: '13px 13px',
    background: 'rgba(255, 255, 255, 0.88)',
    border: '0.5px solid rgba(23, 64, 44, 0.1)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 16px rgba(16, 32, 25, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };

  const sectionHeadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#56665D',
    paddingLeft: 2,
  };

  return (
    <ExplorerNestedSubDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Réglages experts"
      subtitle={`${profile.identity.labelFr} · ${formatPipelineLabelFr(profile.acquisition.pipeline)}`}
    >
      <div className="flex flex-col gap-3.5 pb-2">
        {/* Capteurs Bluetooth LE */}
        <section style={sectionCardStyle}>
          <div style={sectionHeadingStyle}>
            <Bluetooth size={13} aria-hidden="true" />
            <span>Capteurs Bluetooth LE</span>
          </div>
          {supportedBleUuids.length === 0 ? (
            <p className="px-1 text-[12.5px] font-medium" style={{ color: '#56665D' }}>
              Aucun capteur externe requis pour cette activité.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {supportedBleUuids.map((uuid) => {
                const active = settings.selectedBleSensors.includes(uuid);
                const meta = BLE_GATT_META[uuid] ?? {
                  title: `Capteur Bluetooth`,
                  subtitle: `Service ${uuid}`,
                };
                return (
                  <button
                    key={uuid}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleSensor(uuid)}
                    style={{
                      minHeight: 52,
                      padding: '9px 12px',
                      borderRadius: 16,
                      border: active
                        ? '1px solid rgba(23, 64, 44, 0.35)'
                        : '0.5px solid rgba(23, 64, 44, 0.09)',
                      background: active ? 'rgba(23, 64, 44, 0.07)' : 'rgba(247, 248, 244, 0.9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-bold" style={{ color: '#172B24' }}>
                        {meta.title}
                      </div>
                      <div className="text-[11px] font-medium" style={{ color: '#56665D' }}>
                        {meta.subtitle}
                      </div>
                    </div>
                    <span
                      style={{
                        height: 28,
                        padding: '0 11px',
                        borderRadius: 999,
                        background: active
                          ? 'linear-gradient(180deg, #1f543a, #17402c)'
                          : '#FFFFFF',
                        color: active ? '#FBFAF6' : '#17402C',
                        border: active ? 'none' : '0.5px solid rgba(23, 64, 44, 0.18)',
                        fontSize: 11.5,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        flexShrink: 0,
                      }}
                    >
                      {active ? <Check size={12} aria-hidden="true" /> : null}
                      {active ? 'Associé' : 'Associer'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Baromètre & Altitude */}
        <section style={sectionCardStyle}>
          <div style={sectionHeadingStyle}>
            <Gauge size={13} aria-hidden="true" />
            <span>Baromètre &amp; Dénivelé</span>
          </div>
          <IosToggleSwitch
            checked={settings.baroAutoCalibrate}
            onToggle={() => onChangeSettings({ baroAutoCalibrate: !settings.baroAutoCalibrate })}
            icon={<Gauge size={16} />}
            label="Recalage altimétrique DEM"
            description={`Filtre barométrique anti-bruit (${profile.acquisition.barometer.hysteresisM} m)`}
          />
        </section>

        {/* Sécurité, BERA, Beacon & EPZ */}
        <section style={sectionCardStyle}>
          <div style={sectionHeadingStyle}>
            <Shield size={13} aria-hidden="true" />
            <span>Sécurité &amp; Confidentialité</span>
          </div>

          {showBera ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: 15,
                padding: '10px 12px',
                background: 'rgba(185, 138, 46, 0.11)',
                border: '0.5px solid rgba(185, 138, 46, 0.28)',
                fontSize: 12.5,
                fontWeight: 700,
                color: '#6C4A0B',
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Compass size={15} aria-hidden="true" />
                Bulletin Avalanche (BERA)
              </span>
              <span>
                {beraRiskLevel !== null ? `Risque ${beraRiskLevel}/5` : 'Consulter le massif'}
              </span>
            </div>
          ) : null}

          <IosToggleSwitch
            checked={settings.beaconEnabled}
            onToggle={() => onChangeSettings({ beaconEnabled: !settings.beaconEnabled })}
            icon={<Radio size={16} />}
            label="Balise Beacon Live"
            description="Partage temps réel sécurisé par lien invité révocable"
          />

          <div style={{ paddingTop: 2 }}>
            <div
              className="mb-2 flex items-center gap-1.5 px-1 text-[12.5px] font-bold"
              style={{ color: '#172B24' }}
            >
              <ShieldCheck size={14} color="#17402C" aria-hidden="true" />
              <span>Zone privée domicile (EPZ anti-triangulation)</span>
            </div>
            <div
              role="radiogroup"
              aria-label="Rayon EPZ"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 4,
                padding: 4,
                borderRadius: 14,
                background: 'rgba(23, 64, 44, 0.07)',
              }}
            >
              {EPZ_RADII.map((r) => {
                const selected = settings.epzRadiusM === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onChangeSettings({ epzRadiusM: r })}
                    style={{
                      height: 36,
                      borderRadius: 11,
                      border: 0,
                      background: selected ? '#FFFFFF' : 'transparent',
                      color: selected ? '#17402C' : '#56665D',
                      fontSize: 12.5,
                      fontWeight: selected ? 800 : 600,
                      boxShadow: selected ? '0 2px 8px rgba(16, 32, 25, 0.12)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                  >
                    {r === 0 ? 'Off' : `${r} m`}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Automatisation & Hors-ligne */}
        <section style={sectionCardStyle}>
          <div style={sectionHeadingStyle}>
            <Volume2 size={13} aria-hidden="true" />
            <span>Automatisation &amp; Cartes Offline</span>
          </div>

          <IosToggleSwitch
            checked={settings.autoPauseEnabled}
            onToggle={() => onChangeSettings({ autoPauseEnabled: !settings.autoPauseEnabled })}
            icon={<PauseCircle size={16} />}
            label="Auto-Pause intelligente"
            description={`Seuil arrêt ${(profile.algorithms.autoPause.speedThresholdMs * 3.6).toFixed(1)} km/h`}
          />

          <IosToggleSwitch
            checked={settings.voiceGuidanceEnabled}
            onToggle={() =>
              onChangeSettings({ voiceGuidanceEnabled: !settings.voiceGuidanceEnabled })
            }
            icon={<Volume2 size={16} />}
            label="Guidage vocal Turn-by-Turn"
            description="Annonces de direction et splits kilométriques"
          />

          {!offlineReady && onDownloadOffline ? (
            <button
              type="button"
              onClick={onDownloadOffline}
              style={{
                height: 46,
                borderRadius: 999,
                border: 0,
                background: 'linear-gradient(180deg, #1f543a, #17402c)',
                color: '#FBFAF6',
                fontSize: 13.5,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                boxShadow: '0 8px 18px rgba(23, 64, 44, 0.22)',
              }}
            >
              <Download size={15} aria-hidden="true" />
              <span>Télécharger le secteur hors-ligne</span>
            </button>
          ) : null}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 13,
              padding: '8px 12px',
              background: 'rgba(23, 64, 44, 0.05)',
              fontSize: 11.5,
              fontWeight: 600,
              color: '#56665D',
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={13} color="#17402C" aria-hidden="true" />
              Tracking, EPZ &amp; SOS
            </span>
            <span style={{ color: '#17402C', fontWeight: 800 }}>
              {hasProEntitlement ? 'Pro actif' : '100 % inclus'}
            </span>
          </div>
        </section>
      </div>
    </ExplorerNestedSubDrawer>
  );
}
