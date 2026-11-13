/**
 * Lot A02 — Normalisation de l'historique, édition métadonnées/sport/tags/médias,
 * édition rapide post-sync et cycle de vie suppression/restauration 30 jours
 * (K5.04, S1.17, S1.18, S1.20, S1.24, S2.01, S2.16).
 */

import { normalizeVisibility, parsePositions } from '@/features/compte/server/sorties';
import {
  SPORT_FAMILIES,
  getSportVariant,
} from '@/features/explorer-v2/sheet/sportSelection';
import type { Sport } from '@/features/explorer-v2/state/types';
import {
  clonePoints,
  computeActivityStats,
  parseTimestampMs,
} from './metrics';
import {
  ACTIVITY_TAGS,
  PROVENANCE_ORIGIN_LABELS,
  QUICK_EDIT_SYNC_WINDOW_MS,
  SOFT_DELETE_RETENTION_MS,
  type ActivityMetadataEditOutcome,
  type ActivityMetadataPatch,
  type ActivityProvenanceOrigin,
  type ActivityTag,
  type LifecycleActivityRecord,
  type LifecycleMediaAction,
  type LifecycleMediaEditOutcome,
  type LifecycleMediaItem,
  type LifecyclePoint,
  type LifecycleRevision,
  type ProjectionRecalculationEvent,
  type QuickEditAfterSyncState,
  type RestoreActivityOutcome,
  type RestoreEligibility,
  type SoftDeleteOutcome,
} from './types';

const VALID_SPORTS: ReadonlySet<string> = new Set<string>(
  SPORT_FAMILIES.map((f) => f.sport),
);

const VALID_TAGS: ReadonlySet<string> = new Set<string>(ACTIVITY_TAGS);

export function isValidSport(value: unknown): value is Sport {
  return typeof value === 'string' && VALID_SPORTS.has(value);
}

export function isValidActivityTag(value: unknown): value is ActivityTag {
  return typeof value === 'string' && VALID_TAGS.has(value);
}

/**
 * Valide et déduplique une liste de tags d'activité (S1.20).
 */
export function normalizeActivityTags(
  rawTags: readonly unknown[] | null | undefined,
): { ok: true; tags: ActivityTag[] } | { ok: false; invalidTag: string } {
  if (!rawTags || rawTags.length === 0) return { ok: true, tags: [] };
  const seen = new Set<ActivityTag>();
  const out: ActivityTag[] = [];
  for (const item of rawTags) {
    const normalized = typeof item === 'string' ? item.trim().toLowerCase().replace(/\s+/g, '_') : '';
    if (!isValidActivityTag(normalized)) {
      return { ok: false, invalidTag: String(item) };
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return { ok: true, tags: out };
}

export interface LegacyHikeSessionInput {
  id: string;
  user_id: string;
  route_id?: number | string | null;
  route_name?: string | null;
  massif?: string | null;
  title?: string | null;
  notes?: string | null;
  sport?: Sport | string | null;
  variant_id?: string | null;
  tags?: readonly string[] | null;
  started_at?: string | null;
  ended_at?: string | null;
  distance_km?: number | string | null;
  duration_seconds?: number | null;
  elevation_gain_m?: number | string | null;
  max_altitude_m?: number | null;
  positions_timed?: unknown;
  positions_geojson?: unknown;
  points?: readonly LifecyclePoint[] | null;
  visibility?: string | null;
  kit_id?: string | null;
  gear_ids?: readonly string[] | null;
  carnet_ids?: readonly string[] | null;
  group_ids?: readonly string[] | null;
  media?: readonly LifecycleMediaItem[] | null;
  deleted_at?: string | null;
  revision?: number | null;
}

export interface ExplorerActivitySessionInput {
  id: string;
  user_id: string;
  client_session_id?: string | null;
  sport: Sport | string;
  variant_id?: string | null;
  route_id?: number | string | null;
  route_name?: string | null;
  massif?: string | null;
  place_label?: string | null;
  title?: string | null;
  notes?: string | null;
  tags?: readonly string[] | null;
  started_at?: string | null;
  ended_at?: string | null;
  synced_at?: string | null;
  origin?: ActivityProvenanceOrigin;
  device_name?: string | null;
  visibility?: string | null;
  kit_id?: string | null;
  gear_ids?: readonly string[] | null;
  carnet_ids?: readonly string[] | null;
  group_ids?: readonly string[] | null;
  media?: readonly LifecycleMediaItem[] | null;
  points?: readonly LifecyclePoint[] | null;
  positions_timed?: unknown;
  positions_geojson?: unknown;
  distance_m?: number | null;
  duration_seconds?: number | null;
  elevation_gain_m?: number | null;
  deleted_at?: string | null;
  revision?: number | null;
}

function extractLifecyclePoints(
  explicitPoints: readonly LifecyclePoint[] | null | undefined,
  positionsTimed: unknown,
  positionsGeojson: unknown,
): LifecyclePoint[] {
  if (Array.isArray(explicitPoints) && explicitPoints.length > 0) {
    return clonePoints(explicitPoints);
  }
  const basePoints = parsePositions(positionsTimed, positionsGeojson);
  if (Array.isArray(positionsTimed) && positionsTimed.length === basePoints.length) {
    return basePoints.map((pt, idx) => {
      const raw = (positionsTimed[idx] ?? {}) as Record<string, unknown>;
      return {
        ...pt,
        speedMs: typeof raw.speedMs === 'number' ? raw.speedMs : typeof raw.speed === 'number' ? raw.speed : null,
        accuracyM: typeof raw.accuracyM === 'number' ? raw.accuracyM : typeof raw.acc === 'number' ? raw.acc : null,
        heartRateBpm: typeof raw.heartRateBpm === 'number' ? raw.heartRateBpm : typeof raw.hr === 'number' ? raw.hr : null,
        cadenceRpm: typeof raw.cadenceRpm === 'number' ? raw.cadenceRpm : typeof raw.cadence === 'number' ? raw.cadence : null,
        powerWatts: typeof raw.powerWatts === 'number' ? raw.powerWatts : typeof raw.power === 'number' ? raw.power : null,
        discontinuity: raw.discontinuity === true,
      };
    });
  }
  return basePoints.map((pt) => ({ ...pt }));
}

function normalizeMediaList(
  rawMedia: readonly LifecycleMediaItem[] | null | undefined,
): LifecycleMediaItem[] {
  if (!Array.isArray(rawMedia) || rawMedia.length === 0) return [];
  return rawMedia
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item, idx) => ({
      id: item.id,
      kind: item.kind === 'video' ? 'video' : 'photo',
      storagePath: item.storagePath,
      url: item.url ?? null,
      caption: item.caption ?? null,
      position: idx,
    }));
}

/**
 * Normalise une ancienne randonnée (`hike_sessions`) dans le contrat unifié A02
 * en conservant son identifiant historique, ses liens et ses statistiques (S1.17, K5.04).
 */
export function normalizeLegacyHikeSession(
  row: LegacyHikeSessionInput,
  nowMs = Date.now(),
): LifecycleActivityRecord {
  const sport: Sport = isValidSport(row.sport) ? row.sport : 'rando';
  const points = extractLifecyclePoints(
    row.points,
    row.positions_timed,
    row.positions_geojson,
  );
  const distanceKmNum =
    row.distance_km !== null && row.distance_km !== undefined
      ? Number(row.distance_km)
      : NaN;
  const fallbackDistanceM =
    points.length === 0 && Number.isFinite(distanceKmNum) && distanceKmNum > 0
      ? Math.round(distanceKmNum * 1000)
      : null;
  const elevGainNum =
    row.elevation_gain_m !== null && row.elevation_gain_m !== undefined
      ? Number(row.elevation_gain_m)
      : NaN;
  const fallbackElevationGainM =
    points.length === 0 && Number.isFinite(elevGainNum) && elevGainNum >= 0
      ? Math.round(elevGainNum)
      : null;

  const stats = computeActivityStats(points, sport, {
    startedAt: row.started_at ?? null,
    endedAt: row.ended_at ?? null,
    fallbackDurationS: row.duration_seconds ?? null,
    overrideDistanceM: fallbackDistanceM,
    overrideElevationGainM: fallbackElevationGainM,
    fallbackMaxAltitudeM: row.max_altitude_m ?? null,
  });

  const dateLabel = row.started_at ? row.started_at.slice(0, 10) : null;
  const title =
    row.title?.trim() ||
    row.route_name?.trim() ||
    (dateLabel ? `Sortie du ${dateLabel}` : 'Sortie');

  const parsedTags = normalizeActivityTags(row.tags);
  const media = normalizeMediaList(row.media);
  const deletedAt = row.deleted_at ?? null;
  const deletedMs = parseTimestampMs(deletedAt);
  const purgeAfter =
    deletedMs !== null
      ? new Date(deletedMs + SOFT_DELETE_RETENTION_MS).toISOString()
      : null;

  const baseRecord: LifecycleActivityRecord = {
    id: row.id,
    userId: row.user_id,
    revision: typeof row.revision === 'number' && row.revision >= 1 ? row.revision : 1,
    lifecycleStatus: deletedAt ? 'deleted' : 'active',
    deletedAt,
    purgeAfter,
    title: title.slice(0, 120),
    notes: (row.notes ?? '').slice(0, 2000),
    sport,
    variantId: row.variant_id ?? null,
    tags: parsedTags.ok ? parsedTags.tags : [],
    visibility: normalizeVisibility(row.visibility),
    startedAt: row.started_at ?? null,
    endedAt: row.ended_at ?? null,
    routeId: row.route_id !== null && row.route_id !== undefined ? String(row.route_id) : null,
    routeName: row.route_name?.trim() || null,
    massif: row.massif?.trim() || null,
    placeLabel: row.massif?.trim() || row.route_name?.trim() || null,
    kitId: row.kit_id ?? null,
    gearIds: Array.isArray(row.gear_ids) ? [...row.gear_ids] : [],
    carnetIds: Array.isArray(row.carnet_ids) ? [...row.carnet_ids] : [],
    groupIds: Array.isArray(row.group_ids) ? [...row.group_ids] : [],
    media,
    coverUrl: media[0]?.url ?? media[0]?.storagePath ?? null,
    provenance: {
      origin: 'hike_session',
      sourceId: row.id,
      clientSessionId: null,
      deviceName: null,
      syncedAt: row.ended_at ?? row.started_at ?? null,
      label: PROVENANCE_ORIGIN_LABELS.hike_session,
    },
    parentActivityId: null,
    parentRevision: null,
    splitPartIndex: null,
    points,
    originalPoints: clonePoints(points),
    stats,
    correctionState: {
      distanceMethod: 'raw',
      elevationMethod: 'raw',
      appliedAt: null,
      previousSnapshot: null,
    },
    recordsEligibility: {
      eligible: true,
      invalidatedRecords: false,
      reasons: [],
    },
    quickEditState: {
      status: 'not_applicable',
      visible: false,
      syncedAt: null,
      expiresAt: null,
      editableFields: ['title', 'visibility', 'sport', 'tags', 'kitId', 'gearIds'],
    },
    revisions: [
      {
        revision: 1,
        kind: 'initial',
        operationId: null,
        createdAt: row.started_at ?? new Date(nowMs).toISOString(),
        summary: 'Import historique hike_sessions',
      },
    ],
    lastProjectionEvent: null,
  };

  return baseRecord;
}

/**
 * Normalise une séance Explorer ou un import appareil (`activity_sessions`)
 * dans le contrat unifié A02 (S1.17, S1.18, S2.16).
 */
export function normalizeExplorerActivitySession(
  row: ExplorerActivitySessionInput,
  nowMs = Date.now(),
): LifecycleActivityRecord {
  const sport: Sport = isValidSport(row.sport) ? row.sport : 'rando';
  const origin: ActivityProvenanceOrigin = row.origin ?? 'activity_session';
  const points = extractLifecyclePoints(
    row.points,
    row.positions_timed,
    row.positions_geojson,
  );

  const fallbackDistanceM =
    points.length === 0 && typeof row.distance_m === 'number' && row.distance_m > 0
      ? row.distance_m
      : null;
  const fallbackElevationGainM =
    points.length === 0 &&
    typeof row.elevation_gain_m === 'number' &&
    row.elevation_gain_m >= 0
      ? row.elevation_gain_m
      : null;

  const stats = computeActivityStats(points, sport, {
    startedAt: row.started_at ?? null,
    endedAt: row.ended_at ?? null,
    fallbackDurationS: row.duration_seconds ?? null,
    overrideDistanceM: fallbackDistanceM,
    overrideElevationGainM: fallbackElevationGainM,
  });

  const dateLabel = row.started_at ? row.started_at.slice(0, 10) : null;
  const title =
    row.title?.trim() ||
    row.route_name?.trim() ||
    (dateLabel ? `Séance du ${dateLabel}` : 'Séance');

  const parsedTags = normalizeActivityTags(row.tags);
  const media = normalizeMediaList(row.media);
  const deletedAt = row.deleted_at ?? null;
  const deletedMs = parseTimestampMs(deletedAt);
  const purgeAfter =
    deletedMs !== null
      ? new Date(deletedMs + SOFT_DELETE_RETENTION_MS).toISOString()
      : null;

  const syncedAt = row.synced_at ?? row.ended_at ?? row.started_at ?? null;
  const provenanceLabel =
    row.device_name && (origin === 'device_import' || origin === 'gpx_import')
      ? `${PROVENANCE_ORIGIN_LABELS[origin]} · ${row.device_name}`
      : PROVENANCE_ORIGIN_LABELS[origin];

  const record: LifecycleActivityRecord = {
    id: row.id,
    userId: row.user_id,
    revision: typeof row.revision === 'number' && row.revision >= 1 ? row.revision : 1,
    lifecycleStatus: deletedAt ? 'deleted' : 'active',
    deletedAt,
    purgeAfter,
    title: title.slice(0, 120),
    notes: (row.notes ?? '').slice(0, 2000),
    sport,
    variantId: row.variant_id ?? null,
    tags: parsedTags.ok ? parsedTags.tags : [],
    visibility: normalizeVisibility(row.visibility),
    startedAt: row.started_at ?? null,
    endedAt: row.ended_at ?? null,
    routeId: row.route_id !== null && row.route_id !== undefined ? String(row.route_id) : null,
    routeName: row.route_name?.trim() || null,
    massif: row.massif?.trim() || null,
    placeLabel:
      row.place_label?.trim() || row.massif?.trim() || row.route_name?.trim() || null,
    kitId: row.kit_id ?? null,
    gearIds: Array.isArray(row.gear_ids) ? [...row.gear_ids] : [],
    carnetIds: Array.isArray(row.carnet_ids) ? [...row.carnet_ids] : [],
    groupIds: Array.isArray(row.group_ids) ? [...row.group_ids] : [],
    media,
    coverUrl: media[0]?.url ?? media[0]?.storagePath ?? null,
    provenance: {
      origin,
      sourceId: row.id,
      clientSessionId: row.client_session_id ?? null,
      deviceName: row.device_name?.trim() || null,
      syncedAt,
      label: provenanceLabel,
    },
    parentActivityId: null,
    parentRevision: null,
    splitPartIndex: null,
    points,
    originalPoints: clonePoints(points),
    stats,
    correctionState: {
      distanceMethod: 'raw',
      elevationMethod: 'raw',
      appliedAt: null,
      previousSnapshot: null,
    },
    recordsEligibility: {
      eligible: true,
      invalidatedRecords: false,
      reasons: [],
    },
    quickEditState: {
      status: 'not_applicable',
      visible: false,
      syncedAt,
      expiresAt: null,
      editableFields: ['title', 'visibility', 'sport', 'tags', 'kitId', 'gearIds'],
    },
    revisions: [
      {
        revision: 1,
        kind: 'initial',
        operationId: row.client_session_id ?? null,
        createdAt: syncedAt ?? new Date(nowMs).toISOString(),
        summary: `Création ${origin}`,
      },
    ],
    lastProjectionEvent: null,
  };

  return {
    ...record,
    quickEditState: deriveQuickEditState(record, nowMs),
  };
}

/**
 * Fusionne sans doublon l'historique des anciennes randonnées (`hike_sessions`)
 * et des nouvelles séances (`activity_sessions`), trié du plus récent au plus ancien (S1.17, S2.16).
 */
export function mergeUnifiedActivityHistory(
  legacyRecords: readonly LifecycleActivityRecord[],
  explorerRecords: readonly LifecycleActivityRecord[],
): LifecycleActivityRecord[] {
  const byId = new Map<string, LifecycleActivityRecord>();
  const byClientSessionId = new Map<string, string>();

  for (const item of legacyRecords) {
    byId.set(item.id, item);
  }

  for (const item of explorerRecords) {
    const clientSid = item.provenance.clientSessionId;
    if (clientSid && byClientSessionId.has(clientSid)) {
      const existingId = byClientSessionId.get(clientSid)!;
      const existing = byId.get(existingId);
      if (existing && item.revision >= existing.revision) {
        byId.set(existingId, item);
      }
      continue;
    }

    const existing = byId.get(item.id);
    if (!existing || item.revision >= existing.revision) {
      byId.set(item.id, item);
      if (clientSid) byClientSessionId.set(clientSid, item.id);
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    const ta = parseTimestampMs(a.startedAt) ?? 0;
    const tb = parseTimestampMs(b.startedAt) ?? 0;
    if (tb !== ta) return tb - ta;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Modifie les métadonnées, le sport, la variante, la visibilité, le matériel
 * et les tags d'une activité (K5.04, S1.20).
 *
 * Lorsque le sport change :
 * - les statistiques dérivées sont recalculées selon les seuils du nouveau sport ;
 * - les records associés à l'ancien sport sont invalidés (`invalidate_sport_records`).
 */
export function updateActivityMetadata(
  record: LifecycleActivityRecord,
  patch: ActivityMetadataPatch,
  options: { actorUserId?: string; nowIso?: string } = {},
): ActivityMetadataEditOutcome {
  const nowIso = options.nowIso ?? new Date().toISOString();

  if (options.actorUserId !== undefined && options.actorUserId !== record.userId) {
    return {
      ok: false,
      code: 'forbidden',
      error: 'Seul le propriétaire peut modifier cette activité.',
    };
  }

  if (record.lifecycleStatus === 'deleted') {
    return {
      ok: false,
      code: 'activity_deleted',
      error: 'Impossible de modifier une activité supprimée.',
    };
  }

  const nextSport = patch.sport !== undefined ? patch.sport : record.sport;
  if (!isValidSport(nextSport)) {
    return {
      ok: false,
      code: 'invalid_sport',
      error: `Sport inconnu : ${String(patch.sport)}`,
    };
  }

  let nextVariantId =
    patch.variantId !== undefined
      ? patch.variantId
      : patch.sport !== undefined && patch.sport !== record.sport
        ? null
        : record.variantId;

  if (nextVariantId !== null) {
    const variant = getSportVariant(nextVariantId);
    if (!variant) {
      return {
        ok: false,
        code: 'invalid_variant',
        error: `Variante inconnue : ${nextVariantId}`,
      };
    }
    if (variant.sport !== nextSport) {
      return {
        ok: false,
        code: 'variant_sport_mismatch',
        error: `La variante ${nextVariantId} n'appartient pas au sport ${nextSport}.`,
      };
    }
  } else {
    nextVariantId = null;
  }

  let nextTags = record.tags;
  if (patch.tags !== undefined) {
    const parsedTags = normalizeActivityTags(patch.tags);
    if (parsedTags.ok === false) {
      return {
        ok: false,
        code: 'invalid_tag',
        error: `Tag d'activité non reconnu : ${parsedTags.invalidTag}`,
      };
    }
    nextTags = parsedTags.tags;
  }

  const nextTitle =
    patch.title !== undefined
      ? patch.title.trim().slice(0, 120) || record.title
      : record.title;
  const nextNotes =
    patch.notes !== undefined ? patch.notes.slice(0, 2000) : record.notes;
  const nextVisibility =
    patch.visibility !== undefined
      ? normalizeVisibility(patch.visibility)
      : record.visibility;
  const nextKitId = patch.kitId !== undefined ? patch.kitId : record.kitId;
  const nextGearIds =
    patch.gearIds !== undefined
      ? Array.from(new Set(patch.gearIds.map((id) => id.trim()).filter(Boolean)))
      : record.gearIds;

  const sportChanged = nextSport !== record.sport;
  const tagsChanged =
    nextTags.length !== record.tags.length ||
    nextTags.some((t, i) => t !== record.tags[i]);

  const nextStats = sportChanged
    ? computeActivityStats(record.points, nextSport, {
        startedAt: record.startedAt,
        endedAt: record.endedAt,
        fallbackDurationS: record.stats.elapsedTimeS,
        overrideDistanceM:
          record.correctionState.distanceMethod === 'manual_override' ||
          record.points.length === 0
            ? record.stats.distanceM
            : null,
        overrideElevationGainM:
          record.correctionState.elevationMethod === 'manual_override' ||
          record.points.length === 0
            ? record.stats.elevationGainM
            : null,
        overrideElevationLossM:
          record.correctionState.elevationMethod === 'manual_override'
            ? record.stats.elevationLossM
            : null,
        fallbackMaxAltitudeM: record.stats.maxAltitudeM,
      })
    : record.stats;

  const nextRevision = record.revision + 1;
  const revisionKind: LifecycleRevision['kind'] =
    sportChanged || tagsChanged ? 'sport_and_tags_edit' : 'metadata_edit';

  const revisionEntry: LifecycleRevision = {
    revision: nextRevision,
    kind: revisionKind,
    operationId: patch.operationId ?? null,
    createdAt: nowIso,
    summary: sportChanged
      ? `Changement de sport ${record.sport} → ${nextSport}`
      : 'Mise à jour des métadonnées / tags',
    snapshotBefore: sportChanged
      ? {
          points: clonePoints(record.points),
          startedAt: record.startedAt,
          endedAt: record.endedAt,
          sport: record.sport,
          variantId: record.variantId,
          stats: record.stats,
        }
      : undefined,
  };

  const reasons = [...record.recordsEligibility.reasons];
  if (sportChanged && !reasons.includes('sport_changed')) {
    reasons.push('sport_changed');
  }

  const projectionEvent: ProjectionRecalculationEvent | null = sportChanged
    ? {
        eventId: `proj_${record.id}_r${nextRevision}_${Date.parse(nowIso) || 0}`,
        activityId: record.id,
        userId: record.userId,
        revision: nextRevision,
        kind: 'invalidate_sport_records',
        previousSport: record.sport,
        currentSport: nextSport,
        invalidatedRecords: true,
        invalidatedReason: 'sport_changed',
        deltaDistanceM:
          Math.round((nextStats.distanceM - record.stats.distanceM) * 10) / 10,
        deltaElevationGainM: nextStats.elevationGainM - record.stats.elevationGainM,
        deltaMovingTimeS: nextStats.movingTimeS - record.stats.movingTimeS,
        createdAt: nowIso,
      }
    : null;

  const updatedRecord: LifecycleActivityRecord = {
    ...record,
    revision: nextRevision,
    title: nextTitle,
    notes: nextNotes,
    sport: nextSport,
    variantId: nextVariantId,
    tags: nextTags,
    visibility: nextVisibility,
    kitId: nextKitId,
    gearIds: nextGearIds,
    stats: nextStats,
    recordsEligibility: {
      eligible: record.recordsEligibility.eligible,
      invalidatedRecords:
        record.recordsEligibility.invalidatedRecords || sportChanged,
      reasons,
    },
    revisions: [...record.revisions, revisionEntry],
    lastProjectionEvent: projectionEvent ?? record.lastProjectionEvent,
  };

  return {
    ok: true,
    record: updatedRecord,
    sportChanged,
    projectionEvent,
  };
}

function isSafeMediaStoragePath(userId: string, storagePath: string): boolean {
  const trimmed = storagePath.trim();
  if (!trimmed || trimmed.includes('..')) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  return trimmed.startsWith(`${userId}/`);
}

/**
 * Gestion homogène des médias (ajout, suppression, réordonnancement, légende, couverture)
 * d'une activité (K5.04).
 */
export function manageActivityMedia(
  record: LifecycleActivityRecord,
  action: LifecycleMediaAction,
  options: { actorUserId?: string; nowIso?: string } = {},
): LifecycleMediaEditOutcome {
  const nowIso = options.nowIso ?? new Date().toISOString();

  if (options.actorUserId !== undefined && options.actorUserId !== record.userId) {
    return {
      ok: false,
      code: 'forbidden',
      error: 'Seul le propriétaire peut modifier les médias.',
    };
  }

  if (record.lifecycleStatus === 'deleted') {
    return {
      ok: false,
      code: 'activity_deleted',
      error: 'Activité supprimée.',
    };
  }

  let nextMedia = record.media.map((m) => ({ ...m }));

  if (action.type === 'add') {
    if (!isSafeMediaStoragePath(record.userId, action.storagePath)) {
      return {
        ok: false,
        code: 'invalid_storage_path',
        error: 'Chemin de stockage média invalide ou hors du périmètre utilisateur.',
      };
    }
    if (nextMedia.some((m) => m.id === action.id)) {
      return {
        ok: false,
        code: 'duplicate_media_id',
        error: `Le média ${action.id} existe déjà.`,
      };
    }
    const cleanPath = action.storagePath.trim();
    nextMedia.push({
      id: action.id,
      kind: action.kind ?? 'photo',
      storagePath: cleanPath,
      url: action.url ?? cleanPath,
      caption: action.caption ? action.caption.slice(0, 200) : null,
      position: nextMedia.length,
    });
  } else if (action.type === 'remove') {
    const idx = nextMedia.findIndex((m) => m.id === action.id);
    if (idx === -1) {
      return {
        ok: false,
        code: 'media_not_found',
        error: `Média ${action.id} introuvable.`,
      };
    }
    nextMedia.splice(idx, 1);
  } else if (action.type === 'update_caption') {
    const target = nextMedia.find((m) => m.id === action.id);
    if (!target) {
      return {
        ok: false,
        code: 'media_not_found',
        error: `Média ${action.id} introuvable.`,
      };
    }
    target.caption = action.caption ? action.caption.slice(0, 200) : null;
  } else if (action.type === 'set_cover') {
    const idx = nextMedia.findIndex((m) => m.id === action.id);
    if (idx === -1) {
      return {
        ok: false,
        code: 'media_not_found',
        error: `Média ${action.id} introuvable.`,
      };
    }
    const [chosen] = nextMedia.splice(idx, 1);
    nextMedia.unshift(chosen);
  } else if (action.type === 'reorder') {
    const byId = new Map(nextMedia.map((m) => [m.id, m]));
    const reordered: LifecycleMediaItem[] = [];
    for (const id of action.orderedIds) {
      const item = byId.get(id);
      if (!item) {
        return {
          ok: false,
          code: 'media_not_found',
          error: `Média ${id} introuvable lors du réordonnancement.`,
        };
      }
      reordered.push(item);
      byId.delete(id);
    }
    for (const remaining of Array.from(byId.values())) {
      reordered.push(remaining);
    }
    nextMedia = reordered;
  }

  // Normalise les positions 0..N-1 et la couverture
  nextMedia = nextMedia.map((item, idx) => ({ ...item, position: idx }));
  const nextCoverUrl = nextMedia[0]?.url ?? nextMedia[0]?.storagePath ?? null;
  const nextRevision = record.revision + 1;

  const revisionEntry: LifecycleRevision = {
    revision: nextRevision,
    kind: 'media_edit',
    operationId: null,
    createdAt: nowIso,
    summary: `Action média : ${action.type}`,
  };

  return {
    ok: true,
    record: {
      ...record,
      revision: nextRevision,
      media: nextMedia,
      coverUrl: nextCoverUrl,
      revisions: [...record.revisions, revisionEntry],
    },
  };
}

/**
 * Dérive l'état temporaire d'édition rapide après synchronisation (S1.18).
 * Visible uniquement pour les imports appareil / GPX / nouvelles séances
 * synchronisées récemment et non encore résolues.
 */
export function deriveQuickEditState(
  record: Pick<
    LifecycleActivityRecord,
    'lifecycleStatus' | 'provenance' | 'quickEditState'
  >,
  nowMs = Date.now(),
  windowMs = QUICK_EDIT_SYNC_WINDOW_MS,
): QuickEditAfterSyncState {
  const editableFields = [
    'title',
    'visibility',
    'sport',
    'tags',
    'kitId',
    'gearIds',
  ] as const;

  if (record.lifecycleStatus === 'deleted') {
    return {
      status: 'not_applicable',
      visible: false,
      syncedAt: record.provenance.syncedAt,
      expiresAt: null,
      editableFields,
    };
  }

  if (
    record.quickEditState.status === 'resolved' ||
    record.quickEditState.status === 'dismissed'
  ) {
    return {
      ...record.quickEditState,
      visible: false,
      editableFields,
    };
  }

  const eligibleOrigins: ReadonlySet<ActivityProvenanceOrigin> = new Set<ActivityProvenanceOrigin>([
    'device_import',
    'gpx_import',
    'activity_session',
  ]);

  if (!eligibleOrigins.has(record.provenance.origin)) {
    return {
      status: 'not_applicable',
      visible: false,
      syncedAt: record.provenance.syncedAt,
      expiresAt: null,
      editableFields,
    };
  }

  const syncedMs = parseTimestampMs(record.provenance.syncedAt);
  if (syncedMs === null) {
    return {
      status: 'not_applicable',
      visible: false,
      syncedAt: null,
      expiresAt: null,
      editableFields,
    };
  }

  const expiresMs = syncedMs + windowMs;
  const expiresAt = new Date(expiresMs).toISOString();

  if (nowMs > expiresMs) {
    return {
      status: 'expired',
      visible: false,
      syncedAt: record.provenance.syncedAt,
      expiresAt,
      editableFields,
    };
  }

  return {
    status: 'pending',
    visible: true,
    syncedAt: record.provenance.syncedAt,
    expiresAt,
    editableFields,
  };
}

/**
 * Valide l'édition rapide après synchronisation (titre, visibilité, sport, tags, matériel)
 * et retire l'état temporaire (S1.18).
 */
export function applyQuickEditAfterSync(
  record: LifecycleActivityRecord,
  patch: ActivityMetadataPatch,
  options: { actorUserId?: string; nowIso?: string } = {},
): ActivityMetadataEditOutcome {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const editOutcome = updateActivityMetadata(record, patch, {
    actorUserId: options.actorUserId,
    nowIso,
  });
  if (!editOutcome.ok) return editOutcome;

  const updated = editOutcome.record;
  const lastRevIndex = updated.revisions.length - 1;
  const updatedRevisions = updated.revisions.map((rev, idx) =>
    idx === lastRevIndex ? { ...rev, kind: 'quick_edit_sync' as const } : rev,
  );

  return {
    ...editOutcome,
    record: {
      ...updated,
      quickEditState: {
        ...updated.quickEditState,
        status: 'resolved',
        visible: false,
      },
      revisions: updatedRevisions,
    },
  };
}

/**
 * Ferme l'invite d'édition rapide après synchronisation sans modifier les données durables (S1.18).
 */
export function dismissQuickEditAfterSync(
  record: LifecycleActivityRecord,
): LifecycleActivityRecord {
  return {
    ...record,
    quickEditState: {
      ...record.quickEditState,
      status: 'dismissed',
      visible: false,
    },
  };
}

/**
 * Supprime logiquement (soft-delete) une activité et ouvre la fenêtre de
 * restauration de 30 jours (S1.24).
 * Émet un événement `exclude_from_projections` exactement une fois.
 */
export function softDeleteActivity(
  record: LifecycleActivityRecord,
  options: { actorUserId?: string; deletedAtIso?: string } = {},
): SoftDeleteOutcome {
  if (options.actorUserId !== undefined && options.actorUserId !== record.userId) {
    return {
      ok: false,
      code: 'forbidden',
      error: 'Seul le propriétaire peut supprimer cette activité.',
    };
  }

  if (record.lifecycleStatus === 'deleted') {
    return {
      ok: true,
      alreadyDeleted: true,
      record,
      projectionEvent: null,
    };
  }

  const deletedAtIso = options.deletedAtIso ?? new Date().toISOString();
  const deletedAtMs = parseTimestampMs(deletedAtIso) ?? Date.now();
  const purgeAfterIso = new Date(deletedAtMs + SOFT_DELETE_RETENTION_MS).toISOString();
  const nextRevision = record.revision + 1;

  const revisionEntry: LifecycleRevision = {
    revision: nextRevision,
    kind: 'soft_delete',
    operationId: null,
    createdAt: deletedAtIso,
    summary: `Suppression logique (restaurable jusqu'au ${purgeAfterIso.slice(0, 10)})`,
  };

  const projectionEvent: ProjectionRecalculationEvent = {
    eventId: `proj_${record.id}_r${nextRevision}_${deletedAtMs}`,
    activityId: record.id,
    userId: record.userId,
    revision: nextRevision,
    kind: 'exclude_from_projections',
    previousSport: record.sport,
    currentSport: record.sport,
    invalidatedRecords: true,
    invalidatedReason: 'soft_deleted',
    deltaDistanceM: -record.stats.distanceM,
    deltaElevationGainM: -record.stats.elevationGainM,
    deltaMovingTimeS: -record.stats.movingTimeS,
    createdAt: deletedAtIso,
  };

  const updatedRecord: LifecycleActivityRecord = {
    ...record,
    revision: nextRevision,
    lifecycleStatus: 'deleted',
    deletedAt: deletedAtIso,
    purgeAfter: purgeAfterIso,
    quickEditState: {
      ...record.quickEditState,
      status: 'not_applicable',
      visible: false,
    },
    revisions: [...record.revisions, revisionEntry],
    lastProjectionEvent: projectionEvent,
  };

  return {
    ok: true,
    alreadyDeleted: false,
    record: updatedRecord,
    projectionEvent,
  };
}

/**
 * Vérifie si une activité supprimée est éligible à la restauration dans la
 * fenêtre de 30 jours (S1.24).
 */
export function canRestoreActivity(
  record: LifecycleActivityRecord,
  options: { actorUserId?: string; nowMs?: number } = {},
): RestoreEligibility {
  const nowMs = options.nowMs ?? Date.now();

  if (options.actorUserId !== undefined && options.actorUserId !== record.userId) {
    return {
      eligible: false,
      reason: 'forbidden',
      remainingMs: 0,
      remainingDays: 0,
      deletedAt: record.deletedAt,
      purgeAfter: record.purgeAfter,
    };
  }

  if (record.lifecycleStatus !== 'deleted' || !record.deletedAt) {
    return {
      eligible: false,
      reason: 'not_deleted',
      remainingMs: 0,
      remainingDays: 0,
      deletedAt: record.deletedAt,
      purgeAfter: record.purgeAfter,
    };
  }

  const deletedMs = parseTimestampMs(record.deletedAt);
  const purgeMs =
    parseTimestampMs(record.purgeAfter) ??
    (deletedMs !== null ? deletedMs + SOFT_DELETE_RETENTION_MS : null);

  if (purgeMs === null || nowMs > purgeMs) {
    return {
      eligible: false,
      reason: 'retention_expired',
      remainingMs: 0,
      remainingDays: 0,
      deletedAt: record.deletedAt,
      purgeAfter: record.purgeAfter,
    };
  }

  const remainingMs = Math.max(0, purgeMs - nowMs);
  const remainingDays = Math.ceil(remainingMs / 86_400_000);

  return {
    eligible: true,
    reason: 'ok',
    remainingMs,
    remainingDays,
    deletedAt: record.deletedAt,
    purgeAfter: record.purgeAfter,
  };
}

/**
 * Restaure une activité supprimée depuis moins de 30 jours et réintègre ses
 * projections une seule fois (S1.24).
 */
export function restoreActivity(
  record: LifecycleActivityRecord,
  options: { actorUserId?: string; restoredAtIso?: string } = {},
): RestoreActivityOutcome {
  const restoredAtIso = options.restoredAtIso ?? new Date().toISOString();
  const nowMs = parseTimestampMs(restoredAtIso) ?? Date.now();

  const eligibility = canRestoreActivity(record, {
    actorUserId: options.actorUserId,
    nowMs,
  });

  if (!eligibility.eligible && eligibility.reason !== 'ok') {
    const errorMessages: Record<Exclude<RestoreEligibility['reason'], 'ok'>, string> = {
      forbidden: 'Seul le propriétaire peut restaurer cette activité.',
      not_deleted: 'Cette activité n’est pas supprimée.',
      retention_expired:
        'Le délai de restauration de 30 jours est expiré.',
    };
    return {
      ok: false,
      code: eligibility.reason,
      error: errorMessages[eligibility.reason],
    };
  }

  const nextRevision = record.revision + 1;
  const revisionEntry: LifecycleRevision = {
    revision: nextRevision,
    kind: 'restore',
    operationId: null,
    createdAt: restoredAtIso,
    summary: 'Restauration de la séance dans le délai de 30 jours',
  };

  const projectionEvent: ProjectionRecalculationEvent = {
    eventId: `proj_${record.id}_r${nextRevision}_${nowMs}`,
    activityId: record.id,
    userId: record.userId,
    revision: nextRevision,
    kind: 'include_in_projections',
    previousSport: record.sport,
    currentSport: record.sport,
    invalidatedRecords: false,
    invalidatedReason: null,
    deltaDistanceM: record.stats.distanceM,
    deltaElevationGainM: record.stats.elevationGainM,
    deltaMovingTimeS: record.stats.movingTimeS,
    createdAt: restoredAtIso,
  };

  const updatedRecord: LifecycleActivityRecord = {
    ...record,
    revision: nextRevision,
    lifecycleStatus: 'active',
    deletedAt: null,
    purgeAfter: null,
    revisions: [...record.revisions, revisionEntry],
    lastProjectionEvent: projectionEvent,
  };

  return {
    ok: true,
    record: updatedRecord,
    projectionEvent,
  };
}

/**
 * Identifie les activités supprimées dont la rétention de 30 jours a expiré
 * et les sépare des activités conservées (S1.24).
 */
export function purgeExpiredActivities(
  records: readonly LifecycleActivityRecord[],
  nowMs = Date.now(),
): { retained: LifecycleActivityRecord[]; purgedIds: string[] } {
  const retained: LifecycleActivityRecord[] = [];
  const purgedIds: string[] = [];

  for (const record of records) {
    if (record.lifecycleStatus === 'deleted') {
      const eligibility = canRestoreActivity(record, { nowMs });
      if (eligibility.reason === 'retention_expired') {
        purgedIds.push(record.id);
        continue;
      }
    }
    retained.push(record);
  }

  return { retained, purgedIds };
}
