/**
 * A13 (S7) — Logique pure du montage Terrain Live sur la carte du cockpit.
 *
 * Ce module ne dépend ni de Leaflet ni de React : bornes de rayon, garde du
 * flag `terrain_live`, préparation des marqueurs et appels aux routes API
 * existantes (`/api/terrain/reports` et `/api/terrain/reports/[id]/confirm`).
 * Aucune identité n'est envoyée : elle vient exclusivement de la session.
 */
import type {
  TerrainConfirmation,
  TerrainPassability,
  TerrainReportCategory,
  TerrainSeverity,
} from '@/features/adventure-intelligence/schemas/live.schema';
import {
  SEVERITY_COLORS,
  categoryDisplay,
  type TerrainLiveReport,
} from './terrainDisplay';

/** Rayon par défaut du chargement autour de la position (mètres). */
export const TERRAIN_MAP_DEFAULT_RADIUS_M = 5000;
/** Borne basse du rayon de chargement (mètres). */
export const TERRAIN_MAP_MIN_RADIUS_M = 500;
/** Borne haute du rayon de chargement (mètres). */
export const TERRAIN_MAP_MAX_RADIUS_M = 20000;
/** Nombre maximal de marqueurs rendus (borné, anti-surcharge carte). */
export const TERRAIN_MAP_MAX_MARKERS = 200;

/** Borne le rayon dans [MIN, MAX] ; valeur non finie ⇒ défaut. */
export function clampTerrainRadiusM(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return TERRAIN_MAP_DEFAULT_RADIUS_M;
  }
  return Math.min(TERRAIN_MAP_MAX_RADIUS_M, Math.max(TERRAIN_MAP_MIN_RADIUS_M, Math.trunc(value)));
}

/** Flag `terrain_live` : absent ou faux ⇒ aucune couche, aucune requête. */
export function isTerrainLiveEnabled(
  flags: Record<string, boolean> | null | undefined
): boolean {
  return flags?.terrain_live === true;
}

/** Position exploitable ET flag actif ⇒ seul cas où le chargement démarre. */
export function shouldFetchTerrainReports(input: {
  enabled: boolean;
  lat: number | null | undefined;
  lng: number | null | undefined;
}): boolean {
  if (!input.enabled) return false;
  const { lat, lng } = input;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
}

/**
 * Nettoie les signalements destinés à la carte : coordonnées réelles
 * uniquement, ordre d'entrée conservé, plafond strict (jamais tronqué en
 * silence côté données : la carte n'affiche que ce qu'elle peut porter).
 */
export function sanitizeTerrainReports(reports: TerrainLiveReport[]): TerrainLiveReport[] {
  const valid = reports.filter(
    (report) =>
      Number.isFinite(report.lat) &&
      Number.isFinite(report.lng) &&
      report.lat >= -90 &&
      report.lat <= 90 &&
      report.lng >= -180 &&
      report.lng <= 180 &&
      typeof report.id === 'string' &&
      report.id.length > 0
  );
  return valid.slice(0, TERRAIN_MAP_MAX_MARKERS);
}

export interface TerrainMarkerSpec {
  lat: number;
  lng: number;
  color: string;
  radius: number;
  tooltip: string;
  ariaLabel: string;
}

const SEVERITY_RADIUS: Record<TerrainSeverity, number> = {
  info: 7,
  warning: 9,
  critical: 11,
};

/** Spécification pure d'un marqueur (partagée react-leaflet / Leaflet natif). */
export function terrainMarkerSpec(report: TerrainLiveReport): TerrainMarkerSpec {
  const display = categoryDisplay(report.category);
  const color = SEVERITY_COLORS[report.severity] ?? SEVERITY_COLORS.warning;
  return {
    lat: report.lat,
    lng: report.lng,
    color,
    radius: SEVERITY_RADIUS[report.severity] ?? SEVERITY_RADIUS.warning,
    tooltip: display.label,
    ariaLabel: `Signalement ${display.label} — ${report.lat.toFixed(4)}, ${report.lng.toFixed(4)}`,
  };
}

export interface TerrainApiRequest {
  url: string;
  init: RequestInit;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function confirmTerrainReportRequest(
  reportId: string,
  confirmation: TerrainConfirmation
): TerrainApiRequest {
  return {
    url: `/api/terrain/reports/${reportId}/confirm`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation }),
    },
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload = (await response.json()) as unknown;
    return typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Confirme un signalement via la route existante ; jamais de throw réseau. */
export async function confirmTerrainReportViaApi(
  reportId: string,
  confirmation: TerrainConfirmation,
  fetchImpl: FetchLike = globalThis.fetch
): Promise<{ ok: boolean; status: number }> {
  const request = confirmTerrainReportRequest(reportId, confirmation);
  try {
    const response = await fetchImpl(request.url, request.init);
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

export interface TerrainReportDraft {
  category: TerrainReportCategory;
  severity: TerrainSeverity;
  passability?: TerrainPassability | null;
  description?: string;
  lat: number;
  lng: number;
  gpsAccuracyM?: number | null;
  segmentId?: number | null;
}

/** Corps de création : identité et `source_type` jamais fournis par le client. */
export function createTerrainReportRequest(draft: TerrainReportDraft): TerrainApiRequest {
  const body: Record<string, unknown> = {
    category: draft.category,
    severity: draft.severity,
    lat: draft.lat,
    lng: draft.lng,
  };
  if (draft.passability != null) body.passability = draft.passability;
  if (typeof draft.description === 'string' && draft.description.length > 0) {
    body.description = draft.description;
  }
  if (draft.gpsAccuracyM != null && Number.isFinite(draft.gpsAccuracyM)) {
    body.gpsAccuracyM = draft.gpsAccuracyM;
  }
  if (draft.segmentId != null && Number.isInteger(draft.segmentId)) {
    body.segmentId = draft.segmentId;
  }
  return {
    url: '/api/terrain/reports',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  };
}

/** Crée un signalement via la route existante ; réponse métier jamais jetée. */
export async function createTerrainReportViaApi(
  draft: TerrainReportDraft,
  fetchImpl: FetchLike = globalThis.fetch
): Promise<{ ok: boolean; status: number; reportId?: string }> {
  const request = createTerrainReportRequest(draft);
  try {
    const response = await fetchImpl(request.url, request.init);
    const payload = await readJson(response);
    const reportId =
      typeof payload.reportId === 'string'
        ? payload.reportId
        : typeof payload.mergedWith === 'string'
          ? payload.mergedWith
          : undefined;
    return { ok: response.ok, status: response.status, ...(reportId ? { reportId } : {}) };
  } catch {
    return { ok: false, status: 0 };
  }
}
