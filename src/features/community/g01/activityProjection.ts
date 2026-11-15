/**
 * G01 — projection pure « publication + séance → carte de fil ».
 *
 * Une seule fonction décide de l'existence de la carte. Elle refuse (retourne
 * `null`) dès qu'un maillon manque : méta absente/invalide, séance illisible,
 * propriétaire incohérent, partage retiré, audience non prouvée. Les données
 * brutes de la séance ne sortent jamais : la carte ne reçoit que les
 * statistiques sélectionnées et, éventuellement, une couverture déjà autorisée.
 */

import {
  formatNumber,
  nonEmptyString,
  normalizeSport,
  sportLabel,
  visibilityLabel,
  type ShareAudience,
  type SportKey,
} from './contracts';
import {
  activitySessionFromShareMeta,
  isActivityShareActive,
  parseActivityShareMeta,
  type ActivityShareMeta,
} from './activityShare';
import {
  selectSportRecords,
  selectSportStats,
  type SportRecordCandidate,
  type SportRecordChip,
  type SportSessionMetrics,
  type SportStat,
} from './sportStats';
import {
  resolveSharedActivityAccess,
  type ViewerFacts,
} from './visibilityPolicy';

export interface ActivityPostRow {
  id: string;
  author_id?: string | null;
  content?: string | null;
  audience?: unknown;
  club_id?: string | null;
  created_at?: string | null;
  likes_count?: unknown;
  comments_count?: unknown;
  creation_meta?: unknown;
}

export interface ActivityAuthorProfile {
  id: string;
  full_name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
}

export interface ActivityFeedViewer extends ViewerFacts {
  likedPostIds?: ReadonlySet<string> | null;
}

export interface SportActivityCardVM {
  id: string;
  postId: string;
  sessionId: string;
  author: {
    id: string;
    name: string;
    handle: string | null;
    avatarUrl: string | null;
  };
  sport: SportKey;
  sportLabel: string;
  title: string;
  createdAt: string;
  sessionDate: string | null;
  coverUrl: string | null;
  stats: SportStat[];
  records: SportRecordChip[];
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  canLike: boolean;
  canComment: boolean;
  canShare: boolean;
  audience: ShareAudience;
  audienceLabel: string;
  visibilityLabel: string;
  shareStatus: ActivityShareMeta['status'];
  isOwner: boolean;
}

export interface ActivityProjectionInput {
  post?: ActivityPostRow | null;
  session?: SportSessionMetrics | null;
  author?: ActivityAuthorProfile | null;
  viewer?: ActivityFeedViewer | null;
  records?: readonly SportRecordCandidate[] | null;
}

function count(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function authorName(author: ActivityAuthorProfile | null | undefined, ownerId: string): string {
  const name = nonEmptyString(author?.full_name);
  if (name) return name;
  const handle = nonEmptyString(author?.handle);
  if (handle) return handle;
  return `Voyageur ${ownerId.slice(0, 4)}`;
}

/**
 * Construit la carte d'une publication sportive. `null` = la carte ne doit pas
 * être rendue (et aucune statistique ne doit être exposée).
 */
export function projectActivityShare(
  input: ActivityProjectionInput = {}
): SportActivityCardVM | null {
  const post = input.post ?? null;
  const meta = parseActivityShareMeta(post?.creation_meta);
  if (!post || !post.id || !meta) return null;
  // Le tiers lit la projection figée de la méta ; le propriétaire peut fournir
  // la séance live, qui doit alors rester strictement la même.
  const session = input.session ?? activitySessionFromShareMeta(meta, post.content);
  if (!session || session.id !== meta.session_id) return null;
  if (session.ownerId !== meta.owner_id) return null;
  if (post.author_id !== meta.owner_id) return null;
  if (!isActivityShareActive(meta)) return null;

  const viewer = input.viewer ?? null;
  const access = resolveSharedActivityAccess({
    activity: {
      id: session.id,
      ownerId: session.ownerId,
      visibility: session.visibility,
    },
    share: {
      status: meta.status,
      version: meta.version,
      revokedAt: meta.revoked_at,
    },
    audience: post.audience ?? meta.audience,
    clubId: post.club_id ?? meta.club_id,
    viewer,
  });
  if (!access.allowed) return null;

  const sport = normalizeSport(meta.sport);
  if (!sport) return null;
  const stats = selectSportStats(session, { maxStats: 4 });
  // Sans aucun chiffre éligible, il n'y a pas de « statistiques sportives dans
  // le fil » : on préfère ne pas rendre la carte plutôt qu'un cadre vide.
  if (stats.length === 0) return null;

  // Priorité au calcul live du propriétaire ; sinon la projection figée de la
  // méta, qui ne contient que des libellés déjà formatés.
  const records = input.records
    ? selectSportRecords(session, input.records, { maxRecords: 2 })
    : meta.records;
  const viewerId = nonEmptyString(viewer?.viewerId);
  const canInteract = access.allowed && Boolean(viewerId);
  const likedByMe = Boolean(input.viewer?.likedPostIds?.has(post.id));

  return {
    id: `g01:${post.id}`,
    postId: post.id,
    sessionId: session.id,
    author: {
      id: meta.owner_id,
      name: authorName(input.author, meta.owner_id),
      handle: nonEmptyString(input.author?.handle),
      avatarUrl: nonEmptyString(input.author?.avatar_url, 2048),
    },
    sport,
    sportLabel: sportLabel(sport),
    title: session.title?.trim() || `Sortie ${sportLabel(sport).toLowerCase()}`,
    createdAt: nonEmptyString(post.created_at) ?? meta.created_at,
    sessionDate: nonEmptyString(session.startedAt)?.slice(0, 10) ?? null,
    coverUrl: nonEmptyString(session.coverUrl, 2048),
    stats,
    records,
    likesCount: count(post.likes_count),
    commentsCount: count(post.comments_count),
    likedByMe,
    canLike: canInteract && meta.options.allow_likes,
    canComment: canInteract && meta.options.allow_comments,
    canShare: access.allowed,
    audience: meta.audience,
    audienceLabel:
      meta.audience === 'public' ? 'Public' : meta.audience === 'abonnies' ? 'Abonnés' : 'Club',
    visibilityLabel: visibilityLabel(session.visibility),
    shareStatus: meta.status,
    isOwner: access.isOwner,
  };
}

/** Projette une liste en conservant l'ordre serveur et en retirant les refus. */
export function projectActivityFeed(
  inputs: readonly ActivityProjectionInput[] | null | undefined
): SportActivityCardVM[] {
  if (!Array.isArray(inputs)) return [];
  const cards: SportActivityCardVM[] = [];
  for (const input of inputs) {
    const card = projectActivityShare(input);
    if (card) cards.push(card);
  }
  return cards;
}

/** Compteur d'aperçu (partages visibles) sans exposer les lignes refusées. */
export function visibleActivityCount(
  inputs: readonly ActivityProjectionInput[] | null | undefined
): number {
  return projectActivityFeed(inputs).length;
}

/** Format compact pour un aperçu de lien (aucune donnée sensible). */
export function activityPreviewLabel(card: SportActivityCardVM): string {
  const distance = card.stats.find((stat) => stat.key === 'distance');
  const elevation = card.stats.find((stat) => stat.key === 'elevation');
  const bits = [
    card.sportLabel,
    distance ? `${distance.formatted} ${distance.unit}` : null,
    elevation ? `${formatNumber(elevation.value, 0)} m D+` : null,
  ].filter(Boolean);
  return bits.join(' · ');
}
