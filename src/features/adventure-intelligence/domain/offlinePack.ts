/**
 * A13 (S6) — Domaine du pack aventure hors-ligne (client-safe, zéro I/O).
 *
 * Bornes, codes d'avertissement et types partagés entre l'assemblage serveur
 * (`server/offlinePack.ts`) et les caches Dexie (`offline/pack.ts`). Aucune
 * donnée n'est définie ici : uniquement le contrat du pack. Les types
 * importés le sont en `import type` (effacés à la compilation) : ces modules
 * ne sont jamais chargés côté client.
 */
import type { SegmentGeometryRow } from '../server/routePrediction';
import type { TrailPoiRow } from '../server/liveSources';
import type { TerrainLiveReport } from '@/features/terrain-live/lib/terrainDisplay';

export const OFFLINE_PACK_VERSION = 1;
/** Versions de format que ce client sait lire et écrire (Phase 6). */
export const OFFLINE_PACK_SUPPORTED_VERSIONS: readonly number[] = [1];
export const MAX_OFFLINE_PACK_SEGMENTS = 500;
export const MAX_OFFLINE_PACK_POIS = 150;
export const MAX_OFFLINE_PACK_TERRAIN = 50;
export const MAX_OFFLINE_PACK_PREDICTIONS = 12;
export const MAX_OFFLINE_PACK_BYTES = 2_000_000;

export const OFFLINE_PACK_PLAN_NOT_FOUND_WARNING = 'plan_not_found';
export const OFFLINE_PACK_GEOMETRY_MISSING_WARNING = 'offline_pack_geometry_missing';
export const OFFLINE_PACK_TRUNCATED_WARNING = 'offline_pack_truncated';
export const OFFLINE_PACK_POI_UNAVAILABLE_WARNING = 'offline_pack_poi_unavailable';
export const OFFLINE_PACK_TERRAIN_DISABLED_WARNING = 'terrain_live_disabled';
export const OFFLINE_PACK_TERRAIN_UNAVAILABLE_WARNING = 'offline_pack_terrain_unavailable';

export interface OfflinePackPlanSnapshot {
  id: string;
  title: string | null;
  status: string;
  currentVersion: number;
  confidence: unknown;
  intent: unknown;
  /** Identités d'autres membres retirées : id opaque + rôle uniquement. */
  participants: { id: string; role: string }[];
  dates: unknown;
  destinations: unknown;
  sections: unknown;
  monitoringRules: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface OfflinePackVersion {
  version: number;
  reason: string;
  generatedBy: string;
  confidence: unknown;
  createdAt: string;
}

export interface OfflinePackPredictions {
  route: Record<string, unknown>[];
  segments: Record<string, unknown>[];
}

export interface OfflineAdventurePack {
  version: typeof OFFLINE_PACK_VERSION;
  adventureId: string;
  userId: string;
  generatedAt: string;
  sizeBytes: number;
  capped: boolean;
  plan: OfflinePackPlanSnapshot;
  planVersion: OfflinePackVersion | null;
  segments: SegmentGeometryRow[];
  predictions: OfflinePackPredictions;
  pois: TrailPoiRow[];
  terrain: TerrainLiveReport[];
  warnings: string[];
}

/** Version de pack supportée par ce client (jamais une supposition). */
export function isOfflinePackVersionSupported(version: unknown): boolean {
  return (
    typeof version === 'number' &&
    Number.isInteger(version) &&
    OFFLINE_PACK_SUPPORTED_VERSIONS.includes(version)
  );
}

export type OfflinePackValidation =
  | { ok: true; pack: OfflineAdventurePack }
  | { ok: false; error: string };

/** Erreur de version explicite, jamais silencieuse. */
export const OFFLINE_PACK_VERSION_UNSUPPORTED_PREFIX = 'offline_pack_version_non_supportee';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Valide un pack hors-ligne reçu ou relu : version supportée, champs racine
 * présents et typés, tableaux non falsifiés. Aucune réparation implicite :
 * un pack incompatible est refusé avec une raison explicite.
 */
export function validateOfflineAdventurePack(value: unknown): OfflinePackValidation {
  if (!isRecord(value)) return { ok: false, error: 'pack_non_objet' };
  if (!isOfflinePackVersionSupported(value.version)) {
    return {
      ok: false,
      error: `${OFFLINE_PACK_VERSION_UNSUPPORTED_PREFIX}:${String(value.version)}`,
    };
  }
  if (!isNonEmptyString(value.adventureId)) return { ok: false, error: 'adventureId_manquant' };
  if (!isNonEmptyString(value.userId)) return { ok: false, error: 'userId_manquant' };
  if (!isNonEmptyString(value.generatedAt) || !Number.isFinite(Date.parse(value.generatedAt))) {
    return { ok: false, error: 'generatedAt_invalide' };
  }
  if (typeof value.sizeBytes !== 'number' || !Number.isFinite(value.sizeBytes) || value.sizeBytes < 0) {
    return { ok: false, error: 'sizeBytes_invalide' };
  }
  if (typeof value.capped !== 'boolean') return { ok: false, error: 'capped_invalide' };
  if (!isRecord(value.plan) || !isNonEmptyString(value.plan.id)) {
    return { ok: false, error: 'plan_manquant' };
  }
  const predictions = value.predictions;
  if (
    !isRecord(predictions) ||
    !Array.isArray(predictions.route) ||
    !Array.isArray(predictions.segments)
  ) {
    return { ok: false, error: 'predictions_manquantes' };
  }
  if (!Array.isArray(value.segments)) return { ok: false, error: 'segments_manquants' };
  if (!Array.isArray(value.pois)) return { ok: false, error: 'pois_manquants' };
  if (!Array.isArray(value.terrain)) return { ok: false, error: 'terrain_manquant' };
  if (!Array.isArray(value.warnings) || !value.warnings.every((entry) => typeof entry === 'string')) {
    return { ok: false, error: 'warnings_invalides' };
  }
  return { ok: true, pack: value as unknown as OfflineAdventurePack };
}
