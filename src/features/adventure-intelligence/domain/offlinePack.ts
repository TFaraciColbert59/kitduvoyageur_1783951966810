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
