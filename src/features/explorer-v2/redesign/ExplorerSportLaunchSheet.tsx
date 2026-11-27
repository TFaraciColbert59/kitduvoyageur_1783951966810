'use client';

import React from 'react';
import {
  Activity,
  Bike,
  Compass,
  Droplets,
  Footprints,
  Mountain,
  MountainSnow,
  Snowflake,
  Tent,
  Waves,
  X,
} from 'lucide-react';
import {
  StackSlideView,
  StaggerCard,
  StaggerList,
} from '@/components/carnet/v2/CarnetDrawerMotion';
import type { Sport, SportMetricKey, SportSelection } from '../state/types';

export interface ExplorerSportLaunchSheetProps {
  gpsReady?: boolean;
  activeRouteName?: string | null;
  onSelectSport: (sport: Sport, selection?: SportSelection) => void;
  onClose: () => void;
}

interface SportLaunchTile {
  readonly id: string;
  readonly label: string;
  readonly sport: Sport;
  readonly variantId: string;
  readonly catalogSlug: string;
  readonly icon: React.ReactNode;
  readonly tintBg: string;
  readonly tintColor: string;
  readonly metrics: readonly SportMetricKey[];
}

const SPORT_TILES: readonly SportLaunchTile[] = [
  {
    id: 'rando',
    label: 'Rando',
    sport: 'rando',
    variantId: 'rando-journee',
    catalogSlug: 'rando-journee',
    icon: <Mountain size={17} aria-hidden="true" />,
    tintBg: 'rgba(23, 64, 44, 0.12)',
    tintColor: '#17402C',
    metrics: ['distance', 'duration', 'elevation'],
  },
  {
    id: 'trail',
    label: 'Trail',
    sport: 'trail',
    variantId: 'trail-10k',
    catalogSlug: 'trail-10k',
    icon: <Footprints size={17} aria-hidden="true" />,
    tintBg: 'rgba(91, 127, 85, 0.16)',
    tintColor: '#17402C',
    metrics: ['distance', 'duration', 'elevation', 'pace'],
  },
  {
    id: 'vtt',
    label: 'VTT',
    sport: 'velo',
    variantId: 'velo-bikepacking',
    catalogSlug: 'bikepacking-3j',
    icon: <Bike size={17} aria-hidden="true" />,
    tintBg: 'rgba(23, 64, 44, 0.12)',
    tintColor: '#17402C',
    metrics: ['distance', 'duration', 'elevation', 'speed'],
  },
  {
    id: 'gravel',
    label: 'Gravel',
    sport: 'velo',
    variantId: 'velo-gravel',
    catalogSlug: 'gravel-bivouac',
    icon: <Bike size={17} aria-hidden="true" />,
    tintBg: 'rgba(150, 186, 142, 0.24)',
    tintColor: '#17402C',
    metrics: ['distance', 'duration', 'elevation', 'speed'],
  },
  {
    id: 'course',
    label: 'Course',
    sport: 'course',
    variantId: 'course-route',
    catalogSlug: 'course-5k',
    icon: <Activity size={17} aria-hidden="true" />,
    tintBg: 'rgba(91, 127, 85, 0.16)',
    tintColor: '#17402C',
    metrics: ['distance', 'duration', 'pace'],
  },
  {
    id: 'alpi',
    label: 'Alpinisme',
    sport: 'escalade',
    variantId: 'escalade-voie',
    catalogSlug: 'escalade-voie',
    icon: <MountainSnow size={17} aria-hidden="true" />,
    tintBg: 'rgba(23, 43, 36, 0.10)',
    tintColor: '#172B24',
    metrics: ['distance', 'duration', 'elevation'],
  },
  {
    id: 'ski',
    label: 'Ski',
    sport: 'ski',
    variantId: 'ski-rando',
    catalogSlug: 'ski-randonnee',
    icon: <Snowflake size={17} aria-hidden="true" />,
    tintBg: 'rgba(14, 116, 144, 0.12)',
    tintColor: '#0E7490',
    metrics: ['distance', 'duration', 'elevation'],
  },
  {
    id: 'kayak',
    label: 'Kayak',
    sport: 'kayak',
    variantId: 'kayak-riviere',
    catalogSlug: 'canoe-journee',
    icon: <Waves size={17} aria-hidden="true" />,
    tintBg: 'rgba(14, 116, 144, 0.14)',
    tintColor: '#0E7490',
    metrics: ['distance', 'duration', 'speed'],
  },
  {
    id: 'bivouac',
    label: 'Bivouac',
    sport: 'bivouac',
    variantId: 'bivouac-1n',
    catalogSlug: 'bivouac-1n',
    icon: <Tent size={17} aria-hidden="true" />,
    tintBg: 'rgba(150, 186, 142, 0.26)',
    tintColor: '#17402C',
    metrics: ['distance', 'duration', 'elevation'],
  },
  {
    id: 'velo',
    label: 'Vélo',
    sport: 'velo',
    variantId: 'velo-route',
    catalogSlug: 'velo-route',
    icon: <Bike size={17} aria-hidden="true" />,
    tintBg: 'rgba(23, 64, 44, 0.12)',
    tintColor: '#17402C',
    metrics: ['distance', 'duration', 'speed', 'elevation'],
  },
  {
    id: 'escalade',
    label: 'Escalade',
    sport: 'escalade',
    variantId: 'escalade-voie',
    catalogSlug: 'escalade-voie',
    icon: <Compass size={17} aria-hidden="true" />,
    tintBg: 'rgba(23, 43, 36, 0.10)',
    tintColor: '#172B24',
    metrics: ['distance', 'duration', 'elevation'],
  },
  {
    id: 'nage',
    label: 'Natation',
    sport: 'kayak',
    variantId: 'natation-eau-libre',
    catalogSlug: 'natation-eau-libre',
    icon: <Droplets size={17} aria-hidden="true" />,
    tintBg: 'rgba(14, 116, 144, 0.14)',
    tintColor: '#0E7490',
    metrics: ['distance', 'duration', 'pace'],
  },
];

export function ExplorerSportLaunchSheet({
  gpsReady = false,
  activeRouteName = null,
  onSelectSport,
  onClose,
}: ExplorerSportLaunchSheetProps) {
  return (
    <StackSlideView stackKey="sport-launch">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        {/* Sticky blurred header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '4px 12px 10px',
            background: 'rgba(249, 248, 244, 0.94)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '0.5px solid rgba(23, 64, 44, 0.08)',
          }}
        >
          <button
            type="button"
            className="xp20-close-pill"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={15} aria-hidden="true" />
          </button>

          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <strong
              style={{
                display: 'block',
                fontSize: 15,
                fontWeight: 800,
                color: '#172B24',
                lineHeight: 1.15,
              }}
            >
              Activité
            </strong>
            {activeRouteName ? (
              <span
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#56665D',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeRouteName}
              </span>
            ) : null}
          </div>

          <span
            aria-label={gpsReady ? 'GPS prêt' : 'GPS en recherche'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              height: 24,
              padding: '0 9px',
              borderRadius: 999,
              background: gpsReady ? 'rgba(150, 186, 142, 0.28)' : 'rgba(23, 43, 36, 0.06)',
              color: gpsReady ? '#17402C' : '#56665D',
              fontSize: 11,
              fontWeight: 700,
              flex: 'none',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: gpsReady ? '#2E7D4F' : '#8C9A91',
              }}
            />
            GPS
          </span>
        </div>

        {/* 2-col visual sports grid */}
        <div
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            padding: '10px 12px 28px',
          }}
        >
          <StaggerList className="xp20-grid-2">
            {SPORT_TILES.map((tile) => (
              <StaggerCard
                key={tile.id}
                asButton
                className="club-glass-card"
                onClick={() => {
                  const selection: SportSelection = {
                    sport: tile.sport,
                    variantId: tile.variantId,
                    variantLabel: tile.label,
                    catalogSlug: tile.catalogSlug,
                    environment: 'outdoor',
                    metrics: tile.metrics,
                  };
                  onSelectSport(tile.sport, selection);
                }}
                style={{
                  height: 68,
                  padding: '0 12px',
                  borderRadius: 18,
                  border: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      background: tile.tintBg,
                      color: tile.tintColor,
                      display: 'grid',
                      placeItems: 'center',
                      flex: 'none',
                    }}
                  >
                    {tile.icon}
                  </span>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: '#172B24',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tile.label}
                  </span>
                </div>

                {gpsReady ? (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: '#2E7D4F',
                      flex: 'none',
                    }}
                  />
                ) : null}
              </StaggerCard>
            ))}
          </StaggerList>
        </div>
      </div>
    </StackSlideView>
  );
}

export default ExplorerSportLaunchSheet;
