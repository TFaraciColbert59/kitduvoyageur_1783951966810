'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { readProgressionSessionsSnapshot } from '@/components/compte/drawer/progression/ProgressionAdvancedSections';
import type { ProgressionSession } from '@/features/compte/progression/engine';
import {
  readAllFinishedSessions,
  readSessionPoints,
  type LocalSessionRecord,
} from '../../activity/localSession';
import { buildProfile } from '../../geo/profile';
import type { ZoneSet } from '../../metrics/activityMetrics';
import {
  buildDefaultZoneSet,
  readLocalZoneSets,
  saveLocalZoneSet,
} from '../../metrics/telemetryAnalysis';
import type { Sport } from '../../state/types';
import {
  computeSummaryExpertAnalysis,
  interpolateDemElevationOnPoints,
  type SummaryExpertAnalysisInput,
  type SummaryExpertAnalysisResult,
  type SummaryTrackPointInput,
  type SummaryZoneThresholds,
} from './summaryAnalysisEngine';

export type DemRecalibrationState = 'idle' | 'loading' | 'applied' | 'error';

export interface DetectedSegmentEffortItem {
  readonly effortId: string;
  readonly segmentId: string;
  readonly segmentName?: string | null;
  readonly elapsedDurationS: number | null;
  readonly movingDurationS: number | null;
  readonly coveredDistanceM: number | null;
  readonly avgSpeedKmh: number | null;
  readonly elevationGainM: number | null;
  readonly isPersonalRecord: boolean;
  readonly personalRank: number | null;
}

const LOCAL_PHYSIO_EXTRAS_KEY = 'lkdv.metrics.physioExtras.v1';

interface StoredPhysioExtras {
  fcRest?: number;
  vmaKmh?: number;
}

function readLocalPhysioExtras(): StoredPhysioExtras {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(LOCAL_PHYSIO_EXTRAS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredPhysioExtras;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalPhysioExtras(extras: StoredPhysioExtras): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(LOCAL_PHYSIO_EXTRAS_KEY, JSON.stringify(extras));
  } catch {
    /* ignore quota / privacy mode */
  }
}

function normalizeDetectedEffort(raw: Record<string, unknown>, idx: number): DetectedSegmentEffortItem | null {
  const segmentId = typeof raw.segmentId === 'string' && raw.segmentId.length > 0 ? raw.segmentId : null;
  if (!segmentId) return null;
  const effortId =
    typeof raw.effortId === 'string' && raw.effortId.length > 0
      ? raw.effortId
      : typeof raw.id === 'string' && raw.id.length > 0
        ? raw.id
        : `${segmentId}-${idx}`;
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const movingDurationS = num(raw.movingDurationS) ?? num(raw.movingSeconds);
  const elapsedDurationS = num(raw.elapsedDurationS) ?? num(raw.elapsedSeconds);
  const coveredDistanceM = num(raw.coveredDistanceM) ?? num(raw.distanceM);
  const avgSpeedMps = num(raw.avgSpeedMps);
  const avgSpeedKmh =
    num(raw.avgSpeedKmh) ?? (avgSpeedMps !== null ? Math.round(avgSpeedMps * 36) / 10 : null);
  return {
    effortId,
    segmentId,
    segmentName: typeof raw.segmentName === 'string' ? raw.segmentName : null,
    elapsedDurationS,
    movingDurationS,
    coveredDistanceM,
    avgSpeedKmh,
    elevationGainM: num(raw.elevationGainM),
    isPersonalRecord: raw.isPersonalRecord === true || raw.isPr === true,
    personalRank: num(raw.personalRank),
  };
}

export interface SegmentDetectionState {
  readonly status: 'idle' | 'loading' | 'done' | 'unauthenticated' | 'error';
  readonly message: string | null;
  readonly efforts: readonly DetectedSegmentEffortItem[];
  readonly totalDetected: number;
}

export interface UseSummaryExpertAnalysisOptions
  extends Omit<SummaryExpertAnalysisInput, 'zoneSets' | 'thresholds' | 'historySessions'> {
  readonly open: boolean;
  readonly userId?: string | null;
  readonly onPointsHydrated?: (points: readonly SummaryTrackPointInput[]) => void;
}

const DEFAULT_THRESHOLDS: SummaryZoneThresholds = {
  fcMax: 190,
  fcRest: 58,
  ftpW: 250,
  vmaKmh: 14.5,
};

function mapLocalRecordToProgressionSession(rec: LocalSessionRecord): ProgressionSession {
  const sportLabel = rec.selection?.variantLabel ?? rec.sport;
  return {
    id: rec.serverSessionId ?? rec.clientSessionId,
    title: `Sortie ${sportLabel}`,
    startedAt: new Date(rec.startedAt).toISOString(),
    endedAt: rec.endedAt !== null ? new Date(rec.endedAt).toISOString() : null,
    km: Math.round((Math.max(0, rec.distanceM) / 1000) * 100) / 100,
    dplus: Math.round(Math.max(0, rec.elevGainM)),
    durationS: Math.round(Math.max(0, rec.movingS)),
    sport: rec.sport,
    massif: null,
  };
}

function mapSportToSegmentSport(
  sport: Sport,
  slugId: string,
): 'running' | 'trail' | 'cycling' | 'gravel' | 'mtb' | 'hiking' | 'walking' | 'ski' {
  if (slugId.includes('gravel')) return 'gravel';
  if (slugId.includes('mtb') || slugId.includes('vtt')) return 'mtb';
  switch (sport) {
    case 'course':
      return 'running';
    case 'trail':
      return 'trail';
    case 'velo':
      return 'cycling';
    case 'ski':
      return 'ski';
    case 'famille':
      return 'walking';
    default:
      return 'hiking';
  }
}

function extractInitialThresholds(zoneSets: readonly ZoneSet[]): SummaryZoneThresholds {
  const hr = zoneSets.find((z) => z.metric === 'heartRate');
  const pwr = zoneSets.find((z) => z.metric === 'power');
  const pace = zoneSets.find((z) => z.metric === 'pace');
  const extras = readLocalPhysioExtras();

  const fcMax =
    hr?.threshold?.value && hr.threshold.value >= 120 && hr.threshold.value <= 230
      ? Math.round(hr.threshold.value)
      : DEFAULT_THRESHOLDS.fcMax;
  const rawFcRest =
    typeof extras.fcRest === 'number' &&
    Number.isFinite(extras.fcRest) &&
    extras.fcRest >= 30 &&
    extras.fcRest <= 110
      ? Math.round(extras.fcRest)
      : DEFAULT_THRESHOLDS.fcRest;
  const fcRest = Math.min(rawFcRest, fcMax - 20);
  const ftpW =
    pwr?.threshold?.value && pwr.threshold.value >= 60 && pwr.threshold.value <= 600
      ? Math.round(pwr.threshold.value)
      : DEFAULT_THRESHOLDS.ftpW;
  // Prefer exact persisted VMA if present; otherwise derive back from threshold pace (~85% VMA)
  const vmaKmh =
    typeof extras.vmaKmh === 'number' &&
    Number.isFinite(extras.vmaKmh) &&
    extras.vmaKmh >= 6 &&
    extras.vmaKmh <= 26
      ? Math.round(extras.vmaKmh * 10) / 10
      : pace?.threshold?.value && pace.threshold.value >= 140 && pace.threshold.value <= 600
        ? Math.round((3600 / pace.threshold.value / 0.85) * 10) / 10
        : DEFAULT_THRESHOLDS.vmaKmh;

  return {
    fcMax,
    fcRest,
    ftpW,
    vmaKmh,
  };
}

export function useSummaryExpertAnalysis(options: UseSummaryExpertAnalysisOptions) {
  const { open, summary, points, profile, userId } = options;

  const [hydratedPoints, setHydratedPoints] = useState<readonly SummaryTrackPointInput[] | null>(
    null,
  );
  const [demOverridePoints, setDemOverridePoints] = useState<
    readonly SummaryTrackPointInput[] | null
  >(null);
  const [demStatus, setDemStatus] = useState<DemRecalibrationState>('idle');
  const [demMessage, setDemMessage] = useState<string | null>(null);

  const [historySessions, setHistorySessions] = useState<readonly ProgressionSession[]>(() =>
    readProgressionSessionsSnapshot(),
  );

  const [zoneSets, setZoneSets] = useState<ZoneSet[]>(() => readLocalZoneSets(summary.sport));
  const [thresholds, setThresholds] = useState<SummaryZoneThresholds>(() =>
    extractInitialThresholds(readLocalZoneSets(summary.sport)),
  );

  const [segmentDetection, setSegmentDetection] = useState<SegmentDetectionState>({
    status: 'idle',
    message: null,
    efforts: [],
    totalDetected: 0,
  });

  // Reset overrides when switching to another outing
  const sessionKey = summary.clientSessionId ?? summary.sessionId ?? String(summary.startedAt);
  useEffect(() => {
    setHydratedPoints(null);
    setDemOverridePoints(null);
    setDemStatus('idle');
    setDemMessage(null);
    setSegmentDetection({ status: 'idle', message: null, efforts: [], totalDetected: 0 });
  }, [sessionKey]);

  // Reload sport-scoped zone sets when switching to a different sport
  useEffect(() => {
    const loaded = readLocalZoneSets(summary.sport);
    setZoneSets(loaded);
    setThresholds(extractInitialThresholds(loaded));
  }, [summary.sport]);

  // 1. Hydrate full-resolution points from IndexedDB if richer than prop `points`
  useEffect(() => {
    if (!open || !summary.clientSessionId) return;
    let cancelled = false;
    void readSessionPoints(summary.clientSessionId)
      .then((stored) => {
        if (cancelled || stored.length === 0) return;
        const propEleCount = points.filter((p) => typeof p.ele === 'number').length;
        const storedEleCount = stored.filter((p) => typeof p.ele === 'number').length;
        if (stored.length > points.length || storedEleCount > propEleCount) {
          const propByTime = new Map<number, SummaryTrackPointInput>();
          for (const p of points) {
            if (typeof p.t === 'number' && Number.isFinite(p.t)) {
              propByTime.set(p.t, p);
            }
          }
          const mapped: SummaryTrackPointInput[] = stored.map((pt) => {
            const existing = propByTime.get(pt.t);
            return {
              lat: pt.lat,
              lng: pt.lng,
              ele: pt.ele ?? existing?.ele ?? null,
              t: pt.t,
              acc: pt.acc ?? existing?.acc ?? null,
              speed: pt.speed ?? existing?.speed ?? null,
              speedKmh:
                typeof pt.speed === 'number' && Number.isFinite(pt.speed) && pt.speed >= 0
                  ? pt.speed * 3.6
                  : existing?.speedKmh ?? null,
              hr: existing?.hr ?? null,
              cad: existing?.cad ?? null,
              powerW: existing?.powerW ?? null,
              tempC: existing?.tempC ?? null,
            };
          });
          setHydratedPoints(mapped);
          options.onPointsHydrated?.(mapped);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, summary.clientSessionId]);

  // 2. Load 2-layer local history (localStorage progression snapshot + IndexedDB finished sessions)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const snap = readProgressionSessionsSnapshot();
    void readAllFinishedSessions(90)
      .then((localRecords) => {
        if (cancelled) return;
        const byId = new Map<string, ProgressionSession>();
        for (const s of snap) byId.set(s.id, s);
        for (const rec of localRecords) {
          const mapped = mapLocalRecordToProgressionSession(rec);
          if (!byId.has(mapped.id)) {
            byId.set(mapped.id, mapped);
          }
        }
        setHistorySessions(Array.from(byId.values()));
      })
      .catch(() => {
        if (!cancelled) setHistorySessions(snap);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const effectivePoints = useMemo<readonly SummaryTrackPointInput[]>(() => {
    if (demOverridePoints && demOverridePoints.length > 0) return demOverridePoints;
    if (hydratedPoints && hydratedPoints.length > 0) return hydratedPoints;
    return points;
  }, [demOverridePoints, hydratedPoints, points]);

  // 3. Update & persist zone thresholds via saveLocalZoneSet() + physio extras (fcRest, exact vmaKmh)
  const updateZoneThresholds = useCallback(
    (next: Partial<SummaryZoneThresholds>) => {
      setThresholds((prev) => {
        const fcMax = Math.max(120, Math.min(230, Math.round(next.fcMax ?? prev.fcMax)));
        const rawFcRest = Math.max(30, Math.min(110, Math.round(next.fcRest ?? prev.fcRest)));
        const merged: SummaryZoneThresholds = {
          fcMax,
          fcRest: Math.min(rawFcRest, fcMax - 20),
          ftpW: Math.max(60, Math.min(600, Math.round(next.ftpW ?? prev.ftpW))),
          vmaKmh: Math.max(6, Math.min(26, Math.round((next.vmaKmh ?? prev.vmaKmh) * 10) / 10)),
        };

        const discipline = summary.sport || 'all';
        const hrSet = buildDefaultZoneSet('heartRate', discipline, merged.fcMax);
        const powerSet = buildDefaultZoneSet('power', discipline, merged.ftpW);
        // Threshold pace (~85% VMA) in seconds/km
        const thresholdPaceSPerKm = Math.round(3600 / (merged.vmaKmh * 0.85));
        const paceSet = buildDefaultZoneSet('pace', discipline, thresholdPaceSPerKm);

        saveLocalZoneSet(hrSet);
        saveLocalZoneSet(powerSet);
        const allUpdated = saveLocalZoneSet(paceSet);
        saveLocalPhysioExtras({ fcRest: merged.fcRest, vmaKmh: merged.vmaKmh });
        setZoneSets(
          allUpdated.filter((z) => z.discipline === discipline || z.discipline === 'all'),
        );
        return merged;
      });
    },
    [summary.sport],
  );

  // 4. 1-tap AWS Terrarium DEM elevation recalibration (0 €, pure client, C-MET null-safe)
  const recalibrateDemElevation = useCallback(async () => {
    const sourcePts = (hydratedPoints && hydratedPoints.length > 0 ? hydratedPoints : points).filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
    );
    if (sourcePts.length < 2) {
      setDemStatus('error');
      setDemMessage('Au moins 2 points GPS requis pour le recalage altimétrique DEM.');
      return;
    }
    setDemStatus('loading');
    setDemMessage('Échantillonnage du relief AWS Terrarium (zoom 12)…');
    try {
      const positions: Array<[number, number]> = sourcePts.map((p) => [p.lng, p.lat]);
      const demProfile = await buildProfile({
        id: Date.now(),
        positions,
        demZoom: 12,
      });
      const validSamples = demProfile.points.filter((p) => p.ele !== null).length;
      if (validSamples < 2) {
        setDemStatus('error');
        setDemMessage('Tuiles DEM inaccessibles hors ligne : altitudes conservées telles quelles.');
        return;
      }
      const patched = interpolateDemElevationOnPoints(sourcePts, demProfile);
      const validPatched = patched.filter((p) => p.ele !== null).length;
      const covPct = Math.round((validPatched / patched.length) * 100);
      setDemOverridePoints(patched);
      setDemStatus('applied');
      setDemMessage(
        `Altitude recalée via AWS Terrarium (${covPct} % couverts · +${Math.round(demProfile.gain_m)} m D+).`,
      );
    } catch {
      setDemStatus('error');
      setDemMessage('Recalage DEM impossible (réseau ou décodeur indisponible).');
    }
  }, [hydratedPoints, points]);

  // 5. Opt-in segment detection calling POST /api/segments/detect strictly on click
  const detectSegments = useCallback(async () => {
    const validGeoPoints = effectivePoints.filter(
      (pt) =>
        Number.isFinite(pt.lat) &&
        Number.isFinite(pt.lng) &&
        pt.lat >= -90 &&
        pt.lat <= 90 &&
        pt.lng >= -180 &&
        pt.lng <= 180,
    );
    if (validGeoPoints.length < 2) {
      setSegmentDetection({
        status: 'error',
        message: 'Trace GPS trop courte pour détecter des segments.',
        efforts: [],
        totalDetected: 0,
      });
      return;
    }
    if (!userId) {
      setSegmentDetection({
        status: 'unauthenticated',
        message: 'Connectez-vous à votre compte pour scanner les segments du catalogue.',
        efforts: [],
        totalDetected: 0,
      });
      return;
    }
    setSegmentDetection({
      status: 'loading',
      message: 'Analyse des passages sur le catalogue de segments…',
      efforts: [],
      totalDetected: 0,
    });
    try {
      const step = Math.max(1, Math.floor(validGeoPoints.length / 1500));
      const sampled = validGeoPoints.filter(
        (_, i) => i % step === 0 || i === validGeoPoints.length - 1,
      );
      const isAssisted =
        profile.identity.slugId.includes('ebike') || profile.identity.slugId.includes('vae');
      const res = await fetch('/api/segments/detect', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity: {
            activityId: summary.sessionId ?? summary.clientSessionId ?? `local-${summary.startedAt}`,
            activityVersion: 1,
            userId,
            sport: mapSportToSegmentSport(summary.sport, profile.identity.slugId),
            visibility: 'private',
            ...(isAssisted ? { ebikeOrAssisted: true } : {}),
            points: sampled.map((pt, idx) => ({
              lat: pt.lat,
              lng: pt.lng,
              ele: typeof pt.ele === 'number' && Number.isFinite(pt.ele) ? pt.ele : null,
              timestamp: new Date(
                typeof pt.t === 'number' && Number.isFinite(pt.t)
                  ? pt.t
                  : summary.startedAt + idx * 5000,
              ).toISOString(),
              accuracyM:
                typeof pt.acc === 'number' && Number.isFinite(pt.acc) && pt.acc >= 0 ? pt.acc : null,
              speedMps:
                typeof pt.speed === 'number' && Number.isFinite(pt.speed)
                  ? pt.speed
                  : typeof pt.speedKmh === 'number' && Number.isFinite(pt.speedKmh)
                    ? pt.speedKmh / 3.6
                    : null,
              heartRateBpm:
                typeof pt.hr === 'number' && Number.isFinite(pt.hr) ? pt.hr : null,
              powerW:
                typeof pt.powerW === 'number' && Number.isFinite(pt.powerW) ? pt.powerW : null,
              cadenceRpm:
                typeof pt.cad === 'number' && Number.isFinite(pt.cad) ? pt.cad : null,
            })),
          },
        }),
      });

      if (res.status === 401 || res.status === 403) {
        setSegmentDetection({
          status: 'unauthenticated',
          message: 'Session expirée ou non authentifiée pour le scan des segments.',
          efforts: [],
          totalDetected: 0,
        });
        return;
      }
      if (!res.ok) {
        setSegmentDetection({
          status: 'error',
          message: `Détection des segments indisponible (HTTP ${res.status}).`,
          efforts: [],
          totalDetected: 0,
        });
        return;
      }
      const data = (await res.json()) as {
        validEfforts?: Array<Record<string, unknown>>;
        counts?: { valid?: number; total?: number };
      };
      const rawEfforts = Array.isArray(data.validEfforts) ? data.validEfforts : [];
      const efforts = rawEfforts
        .map((item, idx) => (item && typeof item === 'object' ? normalizeDetectedEffort(item, idx) : null))
        .filter((item): item is DetectedSegmentEffortItem => item !== null);
      setSegmentDetection({
        status: 'done',
        message:
          efforts.length > 0
            ? `${efforts.length} segment${efforts.length > 1 ? 's' : ''} validé${efforts.length > 1 ? 's' : ''} sur cette trace.`
            : 'Aucun segment public du catalogue traversé sur ce secteur.',
        efforts,
        totalDetected: data.counts?.total ?? efforts.length,
      });
    } catch {
      setSegmentDetection({
        status: 'error',
        message: 'Scan des segments impossible hors ligne.',
        efforts: [],
        totalDetected: 0,
      });
    }
  }, [effectivePoints, profile.identity.slugId, summary, userId]);

  const analysis = useMemo<SummaryExpertAnalysisResult>(
    () =>
      computeSummaryExpertAnalysis({
        profile: options.profile,
        summary: options.summary,
        points: effectivePoints,
        title: options.title,
        notes: options.notes,
        rpe: options.rpe,
        units: options.units,
        locationLabel: options.locationLabel,
        centerCoords: options.centerCoords,
        weather: options.weather,
        packWeightKg: options.packWeightKg,
        bodyWeightKg: options.bodyWeightKg,
        strengthLog: options.strengthLog,
        sourceOrigin: options.sourceOrigin,
        timeZone: options.timeZone,
        zoneSets,
        thresholds,
        historySessions,
      }),
    [
      effectivePoints,
      historySessions,
      options.bodyWeightKg,
      options.centerCoords,
      options.locationLabel,
      options.notes,
      options.packWeightKg,
      options.profile,
      options.rpe,
      options.sourceOrigin,
      options.summary,
      options.timeZone,
      options.title,
      options.units,
      options.weather,
      options.strengthLog,
      thresholds,
      zoneSets,
    ],
  );

  return {
    analysis,
    effectivePoints,
    thresholds,
    updateZoneThresholds,
    demStatus,
    demMessage,
    recalibrateDemElevation,
    segmentDetection,
    detectSegments,
  };
}
