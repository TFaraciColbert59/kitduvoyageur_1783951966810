'use client';

import React from 'react';
import {
  Activity,
  Bike,
  Compass,
  Dumbbell,
  Footprints,
  HeartPulse,
  Mountain,
  MountainSnow,
  Sailboat,
  Snowflake,
  Tent,
  Upload,
  Waves,
} from 'lucide-react';
import type {
  AcquisitionPipelineId,
  ActivityProfileSpec,
  PrimarySpeedUnit,
  SportFamilyId,
} from '../../specs/activityProfileSpec.types';

/**
 * Libellés humains propres (zéro snake_case technique dans l'interface utilisateur).
 */
export function formatPipelineLabelFr(pipeline: AcquisitionPipelineId): string {
  switch (pipeline) {
    case 'gps_outdoor':
      return 'GPS Outdoor';
    case 'gps_baro_alpine':
      return 'GPS + Baromètre Alpin';
    case 'gps_water':
      return 'GPS Nautique';
    case 'indoor_no_gps':
      return 'Intérieur · Sans GPS';
    case 'hybrid_sensor':
      return 'Hybride Capteurs & GPS';
    case 'manual_import':
      return 'Import .GPX / .FIT';
    default:
      return 'Suivi adaptatif';
  }
}

export function formatSpeedUnitBadgeFr(unit: PrimarySpeedUnit, slugId?: string): string {
  if (slugId === 'manual_generic_import') return 'Import GPX · FIT';
  switch (unit) {
    case 'min_per_km':
      return 'Allure · min/km';
    case 'km_per_h':
      return 'Vitesse · km/h';
    case 'm_per_h_vam':
      return 'Ascension · m/h';
    case 'knots':
      return 'Nautique · nœuds';
    case 'min_per_100m':
      return 'Natation · /100 m';
    case 'min_per_500m':
      return 'Rame · /500 m';
    case 'watts':
      return 'Puissance · Watts';
    case 'reps_tonnage':
      return 'Force · Séries & kg';
    case 'duration_only':
      return 'Chrono · Durée';
    default:
      return 'Suivi sport';
  }
}

export function renderSportIcon(
  familyId: SportFamilyId,
  slugId?: string,
  size = 17,
): React.ReactNode {
  if (slugId === 'manual_generic_import') return <Upload size={size} aria-hidden="true" />;
  if (slugId === 'trekking_bivouac') return <Tent size={size} aria-hidden="true" />;
  if (slugId === 'trail_running' || slugId === 'ultra_trail') {
    return <Footprints size={size} aria-hidden="true" />;
  }
  switch (familyId) {
    case 'running_trail':
      return <Activity size={size} aria-hidden="true" />;
    case 'hiking_trekking':
      return <Mountain size={size} aria-hidden="true" />;
    case 'cycling_mobility':
      return <Bike size={size} aria-hidden="true" />;
    case 'alpinism_vertical':
      return <MountainSnow size={size} aria-hidden="true" />;
    case 'snow_winter':
      return <Snowflake size={size} aria-hidden="true" />;
    case 'swimming_aquatic':
      return <Waves size={size} aria-hidden="true" />;
    case 'nautical_wind_glide':
      return <Sailboat size={size} aria-hidden="true" />;
    case 'indoor_strength_cardio':
      return <Dumbbell size={size} aria-hidden="true" />;
    case 'rehab_wellness':
      return <HeartPulse size={size} aria-hidden="true" />;
    default:
      return <Compass size={size} aria-hidden="true" />;
  }
}

export function getProfileSubtitleFr(profile: ActivityProfileSpec): string {
  if (profile.privacyAndCompliance.rgpdArt9SensitiveHealth) {
    return 'Confidentiel · Santé';
  }
  return formatSpeedUnitBadgeFr(profile.algorithms.primarySpeedUnit, profile.identity.slugId);
}

export interface IosToggleSwitchProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  accentColor?: string;
}

/**
 * Interrupteur natif style iOS 18 Liquid Glass (track vert forêt + pastille blanche animée).
 */
export function IosToggleSwitch({
  checked,
  onToggle,
  label,
  description,
  icon,
  accentColor = 'var(--xp-hud-accent, #17402c)',
}: IosToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      style={{
        width: '100%',
        minHeight: 52,
        padding: '10px 12px',
        borderRadius: 16,
        border: '0.5px solid rgba(23, 64, 44, 0.08)',
        background: checked ? 'rgba(23, 64, 44, 0.045)' : 'rgba(255, 255, 255, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color 180ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 auto' }}>
        {icon ? (
          <span
            aria-hidden="true"
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              background: checked ? 'rgba(23, 64, 44, 0.14)' : 'rgba(23, 64, 44, 0.07)',
              color: '#17402C',
              display: 'grid',
              placeItems: 'center',
              flex: 'none',
            }}
          >
            {icon}
          </span>
        ) : null}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: 'var(--xp-hud-ink, #172b24)',
              lineHeight: 1.2,
            }}
          >
            {label}
          </div>
          {description ? (
            <div
              style={{
                marginTop: 2,
                fontSize: 11.5,
                fontWeight: 500,
                color: 'var(--xp-hud-ink-muted, #56665d)',
                lineHeight: 1.25,
              }}
            >
              {description}
            </div>
          ) : null}
        </div>
      </div>

      {/* Track iOS 18 */}
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          width: 46,
          height: 28,
          borderRadius: 999,
          flex: 'none',
          background: checked ? accentColor : 'rgba(23, 64, 44, 0.16)',
          transition: 'background-color 180ms ease',
          padding: 3,
          boxSizing: 'border-box',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: '#FFFFFF',
            boxShadow: '0 2px 6px rgba(16, 32, 25, 0.22)',
            transform: checked ? 'translateX(18px)' : 'translateX(0px)',
            transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </span>
    </button>
  );
}
