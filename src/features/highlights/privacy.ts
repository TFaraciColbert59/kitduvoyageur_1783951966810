import type {
  Audience,
  Collection,
  CollectionView,
  GeoPoint,
  Highlight,
  HighlightPhoto,
  HighlightView,
  Viewer,
  ViewerRelation,
} from './types';
import { isFiniteNumber } from './engine/result';
import { sharePath } from './engine/sharing';

/**
 * P01 — la seule porte de sortie d'un contenu communautaire.
 *
 * Règle dure : une photo `masked`, une photo sans EXIF nettoyé, ou une
 * coordonnée `hideExactLocation` ne sortent JAMAIS vers un tiers. On ne
 * floute pas : on retire le champ. Une projection ne doit contenir ni URL
 * interdite, ni latitude/longitude masquée.
 */

export function isValidPoint(point: GeoPoint | null | undefined): point is GeoPoint {
  if (!point) return false;
  if (!isFiniteNumber(point.lat) || !isFiniteNumber(point.lng)) return false;
  return point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180;
}

export function viewerRelation(viewer: Viewer, ownerId: string): ViewerRelation {
  if (viewer.id != null && viewer.id === ownerId) return 'owner';
  if (viewer.id == null) return 'anonymous';
  if (viewer.relation === 'follower') return 'follower';
  return 'authenticated';
}

export function canViewAudience(audience: Audience, relation: ViewerRelation): boolean {
  if (relation === 'owner') return true;
  if (audience === 'public') return true;
  if (audience === 'followers') return relation === 'follower';
  return false;
}

/** Vrai si la photo peut sortir vers cette relation. */
export function canPublishPhoto(photo: HighlightPhoto, relation: ViewerRelation): boolean {
  if (relation === 'owner') return true;
  if (photo.masked) return false;
  if (!photo.exifStripped) return false;
  return photo.consentPublic;
}

export function projectHighlight(highlight: Highlight, viewer: Viewer): HighlightView | null {
  const relation = viewerRelation(viewer, highlight.authorId);
  if (highlight.status === 'removed') return null;
  if (highlight.status === 'hidden' && relation !== 'owner') return null;
  if (!canViewAudience(highlight.audience, relation)) return null;

  const isOwner = relation === 'owner';
  const location = highlight.privacy.hideExactLocation && !isOwner ? null : highlight.location;
  const photos =
    highlight.privacy.hidePhotos && !isOwner
      ? []
      : highlight.photos
          .filter((photo) => canPublishPhoto(photo, relation))
          .map((photo) => ({
            id: photo.id,
            url: photo.url,
            caption: photo.caption,
          }));

  const upvotes = highlight.votes.filter((vote) => vote.value === 1).length;
  const downvotes = highlight.votes.filter((vote) => vote.value === -1).length;
  const myVote = viewer.id
    ? (highlight.votes.find((vote) => vote.userId === viewer.id)?.value ?? 0)
    : 0;

  return {
    id: highlight.id,
    authorName: highlight.authorName,
    kind: highlight.kind,
    targetType: highlight.target.type,
    targetId: highlight.target.id,
    title: highlight.title,
    description: highlight.description,
    sport: highlight.sport,
    areaLabel: highlight.areaLabel,
    location,
    locationHidden: highlight.privacy.hideExactLocation && !isOwner,
    photos,
    photosHidden: highlight.privacy.hidePhotos && !isOwner,
    tips: highlight.tips.map((tip) => ({
      id: tip.id,
      authorName: tip.authorName,
      body: tip.body,
      createdAt: tip.createdAt,
    })),
    upvotes,
    downvotes,
    score: upvotes - downvotes,
    myVote,
    audience: highlight.audience,
    canContribute:
      viewer.id != null &&
      highlight.status === 'published' &&
      highlight.privacy.allowContributions &&
      canViewAudience(highlight.audience, relation),
    createdAt: highlight.createdAt,
    updatedAt: highlight.updatedAt,
  };
}

export interface ProjectCollectionOptions {
  /** Vrai si l'appel provient d'un lien de partage valide. */
  shared?: boolean;
  /** Filtre un item ; un item non visible est retiré de la collection. */
  canIncludeItem?: (type: Collection['items'][number]['type'], refId: string) => boolean;
}

export function projectCollection(
  collection: Collection,
  viewer: Viewer,
  options: ProjectCollectionOptions = {}
): CollectionView | null {
  const relation = viewerRelation(viewer, collection.ownerId);
  const isOwner = relation === 'owner';
  const shared = options.shared === true;

  if (
    !shared &&
    !canViewAudience(
      collection.visibility === 'unlisted' ? 'private' : collection.visibility,
      relation
    )
  ) {
    return null;
  }
  if (!shared && collection.visibility === 'unlisted' && !isOwner) return null;

  const items = collection.items
    .filter((item) =>
      options.canIncludeItem ? options.canIncludeItem(item.type, item.refId) : true
    )
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      id: item.id,
      type: item.type,
      refId: item.refId,
      title: item.title,
      sport: item.sport,
      position: item.position,
    }));

  return {
    id: collection.id,
    ownerName: shared ? null : collection.ownerName,
    kind: collection.kind,
    title: collection.title,
    description: collection.description,
    theme: collection.theme,
    region: collection.region,
    partner: collection.partner,
    visibility: collection.visibility,
    items,
    itemCount: items.length,
    updatedAt: collection.updatedAt,
    shared,
    canEdit: isOwner && !shared,
    canShare: isOwner && !shared,
    links:
      isOwner && !shared
        ? collection.shareLinks.map((link) => ({
            id: link.id,
            path: sharePath(link.token),
            expiresAt: link.expiresAt,
            revokedAt: link.revokedAt,
          }))
        : [],
  };
}
