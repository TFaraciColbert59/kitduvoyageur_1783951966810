/**
 * G01 — partage versionné d'une séance sportive dans `community_posts`.
 *
 * Le lien séance → publication vit dans `community_posts.creation_meta`, jamais
 * dans `snapshot_payload` (que le trigger carnet remet à NULL et que le trigger
 * média interdit sur une audience restreinte). Le snapshots ne contient que des
 * agrégats : aucune trace, aucun point GPS, aucune coordonnée.
 *
 * Un partage retiré n'efface pas la ligne : il incrémente `version`, passe
 * `status` à `revoked` et remplace le contenu par un texte neutre. La projection
 * du fil refuse alors la carte, ce qui propage la révocation aux aperçus et aux
 * liens sans laisser de statistiques derrière eux.
 */

import {
  G01_ACTIVITY_SHARE_SCHEMA,
  G01_CONTRACT_VERSION,
  formatDuration,
  isUuid,
  nonEmptyString,
  normalizeShareAudience,
  normalizeShareStatus,
  normalizeSport,
  normalizeActivityVisibility,
  isKnownActivityVisibility,
  positiveInteger,
  strictBoolean,
  type ActivityVisibility,
  type ShareAudience,
  type ShareStatus,
  type SportKey,
} from './contracts';
import {
  activityTitle,
  selectSportRecords,
  selectSportStats,
  type SportRecordCandidate,
  type SportRecordChip,
  type SportSessionMetrics,
} from './sportStats';

export interface ActivityShareMetrics {
  distanceKm: number | null;
  durationSeconds: number | null;
  elevationGainM: number | null;
  maxAltitudeM: number | null;
}

export interface ActivityShareOptions {
  audience: unknown;
  /** Requis pour `audience = 'club'`. */
  clubId?: string | null;
  allowLikes?: boolean;
  allowComments?: boolean;
  /** UUID d'idempotence de la publication (`community_posts.client_request_id`). */
  requestId: string;
  caption?: string | null;
  /** Records personnels déjà calculés par le propriétaire, jamais la trace. */
  records?: readonly SportRecordCandidate[] | null;
  now?: string;
}

export interface ActivityShareMeta {
  schema: typeof G01_ACTIVITY_SHARE_SCHEMA;
  contract_version: typeof G01_CONTRACT_VERSION;
  session_id: string;
  owner_id: string;
  sport: SportKey;
  audience: ShareAudience;
  club_id: string | null;
  status: ShareStatus;
  version: number;
  created_at: string;
  revoked_at: string | null;
  metrics: ActivityShareMetrics;
  session_title: string | null;
  session_started_at: string | null;
  activity_visibility: ActivityVisibility;
  records: SportRecordChip[];
  options: {
    allow_likes: boolean;
    allow_comments: boolean;
  };
}

export interface ActivitySharePostInsert {
  author_id: string;
  content: string;
  post_type: 'share';
  audience: ShareAudience;
  club_id: string | null;
  client_request_id: string;
  creation_meta: ActivityShareMeta;
}

export type ActivityShareFailure =
  | 'invalid_session'
  | 'invalid_owner'
  | 'invalid_audience'
  | 'invalid_request'
  | 'private_activity'
  | 'club_required'
  | 'invalid_club'
  | 'invalid_meta';

export type ActivityShareDraftResult =
  | { ok: true; post: ActivitySharePostInsert; meta: ActivityShareMeta; content: string }
  | { ok: false; reason: ActivityShareFailure };

function isoOrNull(value: unknown): string | null {
  const text = nonEmptyString(value);
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function toMetrics(session: SportSessionMetrics): ActivityShareMetrics {
  return {
    distanceKm: session.distanceKm,
    durationSeconds: session.durationSeconds,
    elevationGainM: session.elevationGainM,
    maxAltitudeM: session.maxAltitudeM,
  };
}

function sanitizeMetrics(value: unknown): ActivityShareMetrics {
  const row = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const metric = (key: string, integer = false): number | null => {
    const raw = row[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return null;
    return integer ? Math.round(raw) : raw;
  };
  return {
    distanceKm: metric('distanceKm'),
    durationSeconds: metric('durationSeconds', true),
    elevationGainM: metric('elevationGainM'),
    maxAltitudeM: metric('maxAltitudeM'),
  };
}

/**
 * Valide et normalise le JSON stocké dans `creation_meta`. Toute forme
 * inconnue renvoie `null` : la carte ne sera pas rendue.
 */
export function parseActivityShareMeta(raw: unknown): ActivityShareMeta | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (row.schema !== G01_ACTIVITY_SHARE_SCHEMA) return null;
  if (row.contract_version !== G01_CONTRACT_VERSION) return null;
  const sessionId = nonEmptyString(row.session_id);
  const ownerId = nonEmptyString(row.owner_id);
  const sport = normalizeSport(row.sport);
  const audience = normalizeShareAudience(row.audience);
  const status = normalizeShareStatus(row.status);
  const version = positiveInteger(row.version);
  const createdAt = isoOrNull(row.created_at);
  const revokedAt = isoOrNull(row.revoked_at);
  const clubId = nonEmptyString(row.club_id);
  if (!sessionId || !isUuid(sessionId)) return null;
  if (!ownerId || !isUuid(ownerId)) return null;
  if (!sport || !audience || !status || version === null || !createdAt) return null;
  if (audience === 'club' && (!clubId || !isUuid(clubId))) return null;

  const optionsRow =
    row.options && typeof row.options === 'object' && !Array.isArray(row.options)
      ? (row.options as Record<string, unknown>)
      : {};
  return {
    schema: G01_ACTIVITY_SHARE_SCHEMA,
    contract_version: G01_CONTRACT_VERSION,
    session_id: sessionId,
    owner_id: ownerId,
    sport,
    audience,
    club_id: audience === 'club' ? clubId : null,
    status,
    version,
    created_at: createdAt,
    revoked_at: revokedAt,
    metrics: sanitizeMetrics(row.metrics),
    session_title: nonEmptyString(row.session_title, 120),
    session_started_at: isoOrNull(row.session_started_at),
    // Absente = privée : une ancienne méta ou un JSON altéré ne rend jamais
    // une carte publique.
    activity_visibility: normalizeActivityVisibility(row.activity_visibility),
    records: sanitizeRecords(row.records),
    options: {
      // Fail-closed sur les interactions : seules les valeurs explicitement
      // `true` ouvrent les likes/commentaires de la carte.
      allow_likes: strictBoolean(optionsRow.allow_likes) === true,
      allow_comments: strictBoolean(optionsRow.allow_comments) === true,
    },
  };
}

function sanitizeRecords(value: unknown): SportRecordChip[] {
  if (!Array.isArray(value)) return [];
  const records: SportRecordChip[] = [];
  for (const entry of value) {
    if (records.length >= 2) break;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const id = nonEmptyString(row.id, 120);
    const label = nonEmptyString(row.label, 80);
    const formatted = nonEmptyString(row.formatted, 80);
    if (!id || !label || !formatted) continue;
    records.push({ id, label, formatted });
  }
  return records;
}

function buildMeta(
  session: SportSessionMetrics,
  options: ActivityShareOptions
): { ok: true; meta: ActivityShareMeta } | { ok: false; reason: ActivityShareFailure } {
  if (!session || !isUuid(session.id) || !normalizeSport(session.sport)) {
    return { ok: false, reason: 'invalid_session' };
  }
  if (!isUuid(session.ownerId)) {
    return { ok: false, reason: 'invalid_owner' };
  }
  const audience = normalizeShareAudience(options.audience);
  if (!audience) {
    return { ok: false, reason: 'invalid_audience' };
  }
  if (!isUuid(options.requestId)) {
    return { ok: false, reason: 'invalid_request' };
  }
  // Une séance privée ne peut pas être publiée : l'auteur doit d'abord choisir
  // une visibilité partageable. Cela évite une carte publique aux stats d'une
  // séance que la base considère encore privée.
  if (
    !isKnownActivityVisibility(session.visibility) ||
    normalizeActivityVisibility(session.visibility) === 'private'
  ) {
    return { ok: false, reason: 'private_activity' };
  }
  let clubId: string | null = null;
  if (audience === 'club') {
    clubId = nonEmptyString(options.clubId);
    if (!clubId) return { ok: false, reason: 'club_required' };
    if (!isUuid(clubId)) return { ok: false, reason: 'invalid_club' };
  }
  const createdAt = isoOrNull(options.now ?? new Date().toISOString());
  if (!createdAt) return { ok: false, reason: 'invalid_meta' };

  return {
    ok: true,
    meta: {
      schema: G01_ACTIVITY_SHARE_SCHEMA,
      contract_version: G01_CONTRACT_VERSION,
      session_id: session.id,
      owner_id: session.ownerId,
      sport: normalizeSport(session.sport) as SportKey,
      audience,
      club_id: clubId,
      status: 'shared',
      version: 1,
      created_at: createdAt,
      revoked_at: null,
      metrics: toMetrics(session),
      session_title: nonEmptyString(session.title, 120),
      session_started_at: isoOrNull(session.startedAt),
      activity_visibility: normalizeActivityVisibility(session.visibility),
      records: selectSportRecords(session, options.records, { maxRecords: 2 }),
      options: {
        allow_likes: options.allowLikes !== false,
        allow_comments: options.allowComments !== false,
      },
    },
  };
}

function cleanCaption(value: unknown): string | null {
  const caption = nonEmptyString(value, 500);
  return caption ? caption.replace(/\s+/g, ' ').trim() : null;
}

/**
 * Texte de la publication. Il ne contient que le titre, le sport, la date et
 * les agrégats sélectionnés : jamais de lieu précis, de trace ou de coordonnée.
 */
export function buildActivityShareContent(
  session: SportSessionMetrics,
  meta: Pick<ActivityShareMeta, 'sport' | 'metrics' | 'created_at'>,
  caption?: unknown
): string {
  const title = activityTitle(session);
  const stats = selectSportStats(session, { maxStats: 3 }).map((stat) =>
    stat.unit ? `${stat.label} ${stat.formatted} ${stat.unit}` : `${stat.label} ${stat.formatted}`
  );
  const date = (session.startedAt ?? meta.created_at).slice(0, 10);
  const lines = [`**${title}**`, [date, stats.join(' · ')].filter(Boolean).join(' · ')];
  const safeCaption = cleanCaption(caption);
  if (safeCaption) lines.push(safeCaption);
  return lines.filter(Boolean).join('\n\n').slice(0, 1500);
}

/** Construit la ligne `community_posts` prête à insérer (aucun média). */
export function buildActivityShareDraft(
  session: SportSessionMetrics,
  options: ActivityShareOptions
): ActivityShareDraftResult {
  const built = buildMeta(session, options);
  if (!built.ok) return built;
  const content = buildActivityShareContent(session, built.meta, options.caption);
  return {
    ok: true,
    meta: built.meta,
    content,
    post: {
      author_id: built.meta.owner_id,
      content,
      post_type: 'share',
      audience: built.meta.audience,
      club_id: built.meta.club_id,
      client_request_id: options.requestId,
      creation_meta: built.meta,
    },
  };
}

export function isActivityShareActive(meta: ActivityShareMeta | null | undefined): boolean {
  return Boolean(
    meta &&
      meta.status === 'shared' &&
      meta.version > 0 &&
      meta.revoked_at === null
  );
}

/**
 * Retire le partage : version + 1, statut `revoked`, date de retrait. Le texte
 * neutre est fourni séparément par `buildRevokedActivityContent`.
 */
export function revokeActivityShareMeta(
  meta: ActivityShareMeta,
  now = new Date().toISOString()
): ActivityShareMeta {
  const revokedAt = isoOrNull(now) ?? new Date().toISOString();
  return {
    ...meta,
    status: 'revoked',
    version: meta.version + 1,
    revoked_at: revokedAt,
  };
}

/** Contenu de remplacement : plus aucun chiffre, plus aucun titre de sortie. */
export function buildRevokedActivityContent(): string {
  return 'Ce partage de sortie a été retiré.';
}

/** Extrait le titre mis en gras par `buildActivityShareContent`. */
export function activityShareTitleFromContent(content: unknown): string | null {
  if (typeof content !== 'string') return null;
  const match = /^\*\*(.+?)\*\*/m.exec(content);
  return match ? nonEmptyString(match[1], 120) : null;
}

/**
 * Reconstruit une séance projetable à partir de la seule méta publiée. C'est
 * cette projection figée que lit un tiers : elle ne dépend d'aucune lecture
 * live de `hike_sessions` (RLS propriétaire) et ne contient que des agrégats.
 */
export function activitySessionFromShareMeta(
  meta: ActivityShareMeta,
  postContent?: unknown
): SportSessionMetrics {
  return {
    id: meta.session_id,
    ownerId: meta.owner_id,
    sport: meta.sport,
    title: meta.session_title ?? activityShareTitleFromContent(postContent),
    startedAt: meta.session_started_at,
    distanceKm: meta.metrics.distanceKm,
    durationSeconds: meta.metrics.durationSeconds,
    elevationGainM: meta.metrics.elevationGainM,
    maxAltitudeM: meta.metrics.maxAltitudeM,
    visibility: meta.activity_visibility,
    coverUrl: null,
  };
}

/** Lecture d'une durée pour les aperçus (évite d'importer le formateur UI). */
export function shareDurationLabel(meta: ActivityShareMeta): string | null {
  return meta.metrics.durationSeconds === null
    ? null
    : formatDuration(meta.metrics.durationSeconds);
}
