export interface PostAuthor {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
}

export interface PostDetail {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  mediaUrls: string[];
  soundtrackUrl?: string | null;
  soundtrackTitle?: string | null;
  soundtrackCreator?: string | null;
  soundtrackSourceUrl?: string | null;
  createdAt: string;
  audience: string;
  author: PostAuthor | null;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  userLiked: boolean;
  userSaved: boolean;
  repostedFromId: string | null;
  location: { lat: number; lng: number; label: string } | null;
}

export interface PostComment {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  author: PostAuthor | null;
  likesCount: number;
  userLiked: boolean;
  isOwner: boolean;
}

export interface ShareTarget {
  id: string;
  title: string;
  type: string;
  avatarUrl: string | null;
  lastMessageAt: string | null;
}

export interface SavedPost {
  id: string;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  createdAt: string;
  author: PostAuthor | null;
  likesCount: number;
  commentsCount: number;
}

export interface PostReportReason {
  id: string;
  label: string;
}

export const POST_REPORT_REASONS: PostReportReason[] = [
  { id: 'spam', label: 'Spam ou contenu indésirable' },
  { id: 'harassment', label: 'Harcèlement ou intimidation' },
  { id: 'inappropriate', label: 'Contenu inapproprié ou offensant' },
  { id: 'misinformation', label: 'Fausse information sur un itinéraire' },
  { id: 'other', label: 'Autre motif' },
];

export function postPermalink(postId: string): string {
  if (typeof window === 'undefined') return `/communaute/post/${postId}`;
  return `${window.location.origin}/communaute/post/${postId}`;
}
