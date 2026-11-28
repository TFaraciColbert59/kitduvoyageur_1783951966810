'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Flame,
  Gauge,
  Heart,
  Mountain,
  Sun,
} from 'lucide-react';
import type { WeatherSnapshot } from '../../adaptive/types';
import {
  buildEnhancedGpxXml,
  buildFitExportManifest,
} from '../../export/gpxAndFitExport';
import type { ActivityProfileSpec } from '../../specs/activityProfileSpec.types';
import type { ActivityState, StrengthLog } from '../../state/types';
import { ExplorerNestedSubDrawer } from '../primitives/ExplorerNestedSubDrawer';
import type { HudContrastVariant } from '../primitives/ExplorerNonModalSheet';
import {
  type SummaryTrackPointInput,
} from './summaryAnalysisEngine';
import { useSummaryExpertAnalysis } from './useSummaryExpertAnalysis';
import { OverviewBioPanel } from './panels/OverviewBioPanel';
import { CurvesTelemetryPanel } from './panels/CurvesTelemetryPanel';
import { ReliefClimbsPanel } from './panels/ReliefClimbsPanel';
import { PacingSplitsPanel } from './panels/PacingSplitsPanel';
import { PhysioLoadPanel } from './panels/PhysioLoadPanel';
import { EnvironmentRecoveryPanel } from './panels/EnvironmentRecoveryPanel';
import '@/styles/explorer-glass.css';

export type SummaryTrackPoint = SummaryTrackPointInput;

export interface SummaryExpertWaypoint {
  readonly lat: number;
  readonly lng: number;
  readonly label: string;
  readonly kind: string;
}

export interface SummaryExpertAnalysisSubDrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly profile: ActivityProfileSpec;
  readonly points: ReadonlyArray<SummaryTrackPoint>;
  readonly distanceM: number;
  readonly movingS: number;
  readonly elevGainM: number;
  readonly rpe?: number;
  readonly units?: 'metric' | 'imperial';
  /** Enriched full outing summary & context (optional for backwards compatibility). */
  readonly summary?: (ActivityState & { endedAt: number }) | null;
  readonly title?: string | null;
  readonly notes?: string | null;
  readonly waypoints?: ReadonlyArray<SummaryExpertWaypoint>;
  readonly locationLabel?: string | null;
  readonly centerCoords?: readonly [number, number] | null;
  readonly weather?: WeatherSnapshot | null;
  readonly packWeightKg?: number | null;
  readonly bodyWeightKg?: number | null;
  readonly strengthLog?: StrengthLog | null;
  readonly userId?: string | null;
  readonly contrast?: HudContrastVariant;
  readonly glovesMode?: boolean;
  readonly onProfileCursorChange?: (
    cursor: { lon: number; lat: number; distanceM: number; elevationM: number | null } | null,
  ) => void;
  readonly onHighlightSegment?: (
    segment: { coordinates: Array<[number, number]>; label?: string } | null,
  ) => void;
  /** Optional download hooks (used by tests or custom exporters). */
  readonly onExportGpxContent?: (xml: string, filename: string) => void;
  readonly onExportFitContent?: (json: string, filename: string) => void;
}

export type ExpertTabId =
  | 'overview'
  | 'curves'
  | 'relief'
  | 'pacing'
  | 'physio'
  | 'env';

const EXPERT_TABS: ReadonlyArray<{
  readonly id: ExpertTabId;
  readonly label: string;
  readonly shortLabel: string;
  readonly Icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
}> = [
  { id: 'overview', label: 'Synthèse & Effort', shortLabel: 'Synthèse', Icon: Flame },
  { id: 'curves', label: 'Courbes & Télémétrie', shortLabel: 'Courbes', Icon: Activity },
  { id: 'relief', label: 'Relief & Montées', shortLabel: 'Relief', Icon: Mountain },
  { id: 'pacing', label: 'Rythme, Splits & Records', shortLabel: 'Rythme', Icon: Gauge },
  { id: 'physio', label: 'Cardio, Puissance & Charge', shortLabel: 'Cardio', Icon: Heart },
  { id: 'env', label: 'Énergie, Météo & Récup', shortLabel: 'Récup', Icon: Sun },
];

function triggerClientDownload(content: string, mimeType: string, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugifyFilename(raw: string): string {
  return (
    raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'sortie-explorer'
  );
}

export function SummaryExpertAnalysisSubDrawer({
  open,
  onOpenChange,
  profile,
  points,
  distanceM,
  movingS,
  elevGainM,
  rpe = 5,
  units = 'metric',
  summary = null,
  title = null,
  notes = null,
  waypoints = [],
  locationLabel = null,
  centerCoords = null,
  weather = null,
  packWeightKg = null,
  bodyWeightKg = null,
  strengthLog = null,
  userId = null,
  contrast = 'standard',
  glovesMode = false,
  onProfileCursorChange,
  onHighlightSegment,
  onExportGpxContent,
  onExportFitContent,
}: SummaryExpertAnalysisSubDrawerProps) {
  const [activeTab, setActiveTab] = useState<ExpertTabId>('overview');
  const [cursorIndex, setCursorIndex] = useState<number | null>(null);
  const bodyRootRef = useRef<HTMLDivElement | null>(null);

  // Reset vertical scroll position of the nested drawer body when switching sub-panels
  useEffect(() => {
    const scrollContainer = bodyRootRef.current?.closest('.xp20-nested-body');
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }, [activeTab]);

  const resolvedSummary = useMemo(() => {
    if (summary) {
      return {
        ...summary,
        distanceM: Math.max(0, summary.distanceM || distanceM),
        movingS: summary.movingS > 0 ? summary.movingS : movingS,
        elevGainM: Math.max(0, summary.elevGainM || elevGainM),
      };
    }
    const now = Date.now();
    const safeMoving = Math.max(0, movingS);
    return {
      sport: profile.identity.legacySport,
      startedAt: now - safeMoving * 1000,
      endedAt: now,
      distanceM: Math.max(0, distanceM),
      movingS: safeMoving,
      elevGainM: Math.max(0, elevGainM),
    };
  }, [distanceM, elevGainM, movingS, profile.identity.legacySport, summary]);

  const {
    analysis,
    effectivePoints,
    thresholds,
    updateZoneThresholds,
    demStatus,
    demMessage,
    recalibrateDemElevation,
    segmentDetection,
    detectSegments,
  } = useSummaryExpertAnalysis({
    open,
    profile,
    summary: resolvedSummary,
    points,
    title,
    notes,
    rpe,
    units,
    locationLabel,
    centerCoords,
    weather,
    packWeightKg,
    bodyWeightKg,
    strengthLog,
    userId,
  });

  // Sync chart/inline-trace cursor with MapLibre profileCursor
  const handleCursorIndexChange = useCallback(
    (idx: number | null) => {
      setCursorIndex(idx);
      if (!onProfileCursorChange) return;
      if (idx === null) {
        onProfileCursorChange(null);
        return;
      }
      const pt = analysis.telemetry.aligned[idx];
      if (!pt) {
        onProfileCursorChange(null);
        return;
      }
      onProfileCursorChange({
        lon: pt.lng,
        lat: pt.lat,
        distanceM: Math.round(pt.distanceKm * 1000),
        elevationM: pt.altitudeM,
      });
    },
    [analysis.telemetry.aligned, onProfileCursorChange],
  );

  const onProfileCursorChangeRef = useRef(onProfileCursorChange);
  onProfileCursorChangeRef.current = onProfileCursorChange;
  const onHighlightSegmentRef = useRef(onHighlightSegment);
  onHighlightSegmentRef.current = onHighlightSegment;

  // Clean up map overlays when closing the sub-drawer or unmounting
  useEffect(() => {
    if (!open) {
      setCursorIndex(null);
      onProfileCursorChangeRef.current?.(null);
      onHighlightSegmentRef.current?.(null);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      onProfileCursorChangeRef.current?.(null);
      onHighlightSegmentRef.current?.(null);
    };
  }, []);

  const handleExportEnhancedGpx = useCallback(() => {
    const exportPoints =
      analysis.telemetry.aligned.length > 0
        ? analysis.telemetry.aligned.map((pt) => ({
            lat: pt.lat,
            lng: pt.lng,
            ele: pt.altitudeM,
            t: pt.timestampMs ?? undefined,
            hr: pt.heartRateBpm,
            cad: pt.cadence,
            powerW: pt.powerW,
          }))
        : effectivePoints.map((pt) => ({
            lat: pt.lat,
            lng: pt.lng,
            ele: pt.ele ?? null,
            t: pt.t,
            hr: pt.hr ?? null,
            cad: pt.cad ?? null,
            powerW: pt.powerW ?? null,
          }));

    const xml = buildEnhancedGpxXml({
      title: analysis.title,
      profile,
      points: exportPoints,
      waypoints,
    });
    const filename = `${slugifyFilename(analysis.title)}-expert.gpx`;
    if (onExportGpxContent) {
      onExportGpxContent(xml, filename);
    } else {
      triggerClientDownload(xml, 'application/gpx+xml;charset=utf-8', filename);
    }
  }, [analysis.telemetry.aligned, analysis.title, effectivePoints, onExportGpxContent, profile, waypoints]);

  const handleExportFitManifest = useCallback(() => {
    const manifest = buildFitExportManifest({
      sessionId: analysis.outingId,
      profile,
      startedAtMs: resolvedSummary.startedAt,
      distanceM: resolvedSummary.distanceM,
      movingS: analysis.movingS,
      elevGainM: analysis.verticality.elevGainM,
    });
    const json = JSON.stringify(manifest, null, 2);
    const filename = `${slugifyFilename(analysis.title)}-fit-manifest.json`;
    if (onExportFitContent) {
      onExportFitContent(json, filename);
    } else {
      triggerClientDownload(json, 'application/json;charset=utf-8', filename);
    }
  }, [
    analysis.movingS,
    analysis.outingId,
    analysis.title,
    analysis.verticality.elevGainM,
    onExportFitContent,
    profile,
    resolvedSummary.distanceM,
    resolvedSummary.startedAt,
  ]);

  const stickySubHeader = (
    <div className="xp20-exp-scope xp20-exp-sticky-bar" data-testid="xp20-exp-sticky-header">
      {/* Compact Adaptive Sport KPI Strip */}
      <div className="xp20-exp-hero-strip" aria-label="Indicateurs clés de la sortie">
        <div className="xp20-exp-hero-pill">
          <span>Métrique</span>
          <strong>
            {analysis.primarySpeed.valueText} <small>{analysis.primarySpeed.unitLabel}</small>
          </strong>
        </div>
        <div className="xp20-exp-hero-pill">
          <span>Charge ({analysis.loadProjection.canonicalTierLabelFr})</span>
          <strong>
            {Math.round(analysis.loadProjection.canonicalLoad.loadUnits)} <small>UA</small>
          </strong>
        </div>
        <div className="xp20-exp-hero-pill">
          <span>D+ / km-E</span>
          <strong>
            +{analysis.verticality.elevGainM} m <small>· {analysis.sortiePerformance.effortScoreKe.toFixed(1)}</small>
          </strong>
        </div>
      </div>

      {/* Sticky 6-Sub-Panel Pill Bar */}
      <div
        className="xp20-exp-tabs"
        role="tablist"
        aria-label="Sous-volets d'analyse avancée"
        data-base-ui-swipe-ignore="x"
      >
        {EXPERT_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              id={`xp20-exp-tab-btn-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`xp20-exp-tabpanel-${tab.id}`}
              aria-label={tab.label}
              data-testid={`xp20-exp-tab-${tab.id}`}
              className={`xp20-exp-tab-pill${isActive ? ' is-active' : ''}`}
              onClick={(event) => {
                setActiveTab(tab.id);
                event.currentTarget.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
              }}
            >
              {isActive ? (
                <motion.span
                  layoutId="xp20-exp-tab-pill-bg"
                  className="xp20-exp-tab-pill-bg"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  aria-hidden="true"
                />
              ) : null}
              <span className="xp20-exp-tab-pill-inner">
                <Icon size={13} aria-hidden />
                <span>{tab.shortLabel}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <ExplorerNestedSubDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Analyse avancée"
      subtitle={`${profile.identity.labelFr} · ${analysis.distanceKm.toFixed(2)} km · ${analysis.primarySpeed.valueText} ${analysis.primarySpeed.unitLabel}`}
      contrast={contrast}
      glovesMode={glovesMode}
      minHeight="78dvh"
      maxHeight="92dvh"
      stickySubHeader={stickySubHeader}
    >
      <div
        ref={bodyRootRef}
        role="tabpanel"
        id={`xp20-exp-tabpanel-${activeTab}`}
        aria-labelledby={`xp20-exp-tab-btn-${activeTab}`}
        className="xp20-exp-scope xp20-exp-shell"
        data-testid="xp20-exp-analysis-root"
      >
        {activeTab === 'overview' ? (
          <OverviewBioPanel
            analysis={analysis}
            startedAt={resolvedSummary.startedAt}
            endedAt={resolvedSummary.endedAt}
            routeName={summary?.route?.name ?? null}
            locationLabel={locationLabel}
          />
        ) : null}

        {activeTab === 'curves' ? (
          <CurvesTelemetryPanel
            analysis={analysis}
            cursorIndex={cursorIndex}
            onCursorIndexChange={handleCursorIndexChange}
            demStatus={demStatus}
            demMessage={demMessage}
            onRecalibrateDem={() => void recalibrateDemElevation()}
          />
        ) : null}

        {activeTab === 'relief' ? (
          <ReliefClimbsPanel
            analysis={analysis}
            onHighlightSegment={onHighlightSegment}
          />
        ) : null}

        {activeTab === 'pacing' ? (
          <PacingSplitsPanel
            analysis={analysis}
            laps={summary?.laps ?? []}
            segmentDetection={segmentDetection}
            onDetectSegments={() => void detectSegments()}
          />
        ) : null}

        {activeTab === 'physio' ? (
          <PhysioLoadPanel
            analysis={analysis}
            thresholds={thresholds}
            onUpdateThresholds={updateZoneThresholds}
          />
        ) : null}

        {activeTab === 'env' ? (
          <EnvironmentRecoveryPanel
            analysis={analysis}
            onExportEnhancedGpx={handleExportEnhancedGpx}
            onExportFitManifest={handleExportFitManifest}
          />
        ) : null}
      </div>
    </ExplorerNestedSubDrawer>
  );
}
