import type {
  KitMessageMeta,
  ProductMessageMeta,
  TrailMessageMeta,
} from '@/features/messaging/types/messaging.types';

export type FreedomAttachmentType = 'kit' | 'gpx' | 'product' | 'trail' | 'photo' | 'audio';

export interface FreedomGpxAttachmentMeta {
  name: string;
  url?: string;
  fileContent?: string;
  distanceKm?: number | null;
  elevationGainM?: number | null;
  pointsCount?: number | null;
}

export interface FreedomCommentAttachment {
  type: FreedomAttachmentType;
  kit?: KitMessageMeta | null;
  gpx?: FreedomGpxAttachmentMeta | null;
  product?: ProductMessageMeta | null;
  trail?: TrailMessageMeta | null;
  photoUrl?: string | null;
  audioUrl?: string | null;
}

export interface FreedomAuthor {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string | null;
  isVerified?: boolean;
  isFollowing?: boolean;
  loyaltyLevel?: string | null;
}

export interface FreedomReelItem {
  id: string;
  videoUrl: string;
  posterUrl?: string | null;
  caption: string;
  tags: string[];
  createdAt: string;
  author: FreedomAuthor;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  isLiked: boolean;
  isSaved: boolean;
  linkedKitId?: string | null;
  linkedKit?: {
    id: string;
    name: string;
    itemsCount?: number;
    weightG?: number;
  } | null;
  linkedTrail?: {
    id: string;
    name: string;
    distanceKm?: number;
    elevationGainM?: number;
    region?: string;
  } | null;
  soundTitle: string;
  location: string;
}

export interface FreedomComment {
  id: string;
  reelId: string;
  author: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  content: string;
  createdAt: string;
  likesCount: number;
  isLiked: boolean;
  isOwner: boolean;
  attachment?: FreedomCommentAttachment | null;
  parentId?: string | null;
  replies?: FreedomComment[];
}
