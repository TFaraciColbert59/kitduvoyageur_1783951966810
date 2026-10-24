import { createClient } from '@/lib/supabase/client';
import type {
  PostAuthor,
  PostComment,
  PostDetail,
  SavedPost,
  ShareTarget,
} from './types';

type AnyRow = Record<string, any>;

function mediaOf(row: AnyRow): string[] {
  const values = [
    row.image_url,
    ...(Array.isArray(row.media_urls) ? row.media_urls : []),
  ];
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

async function authorOf(
  supabase: ReturnType<typeof createClient>,
  id: string | null | undefined
): Promise<PostAuthor | null> {
  if (!id) return null;
  const { data } = await supabase
    .from('public_profiles')
    .select('id,full_name,handle,avatar_url')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: (data.full_name || data.handle || 'Voyageur').trim(),
    handle: (data.handle || '').replace(/^@/, ''),
    avatarUrl: data.avatar_url || null,
  };
}

function inferPostLocation(content: string): { lat: number; lng: number; label: string } | null {
  const rules: Array<[RegExp, number, number, string]> = [
    [/GR20/i, 42.36, 9.02, 'GR20, Corse'],
    [/Lille/i, 50.63, 3.06, 'Lille, France'],
    [/Fagnes/i, 50.6, 6.08, 'Hautes Fagnes, Belgique'],
    [/TMB|Mont-Blanc|Chamonix/i, 45.9, 6.86, 'Mont-Blanc, France'],
    [/Alta Via/i, 46.5, 12.02, 'Dolomites, Italie'],
    [/Islande/i, 64.9, -19.0, 'Islande'],
    [/Bretagne/i, 48.2, -4.5, 'Bretagne, France'],
    [/ferrata/i, 46.54, 11.96, 'Dolomites, Italie'],
    [/bivouac|tente/i, 45.98, 6.89, 'Aiguilles Rouges, France'],
  ];
  const hit = rules.find(([pattern]) => pattern.test(content));
  return hit ? { lat: hit[1], lng: hit[2], label: hit[3] } : null;
}

export async function fetchPostDetail(postId: string): Promise<PostDetail | null> {
  const supabase = createClient();
  const { data: post, error } = await supabase
    .from('community_posts')
    .select('*')
    .eq('id', postId)
    .maybeSingle();
  if (error || !post) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [author, like, save] = await Promise.all([
    authorOf(supabase, post.author_id),
    user
      ? supabase
          .from('post_likes')
          .select('post_id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from('post_saves')
          .select('post_id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    id: post.id,
    title: post.title || '',
    content: post.content || '',
    imageUrl: post.image_url || null,
    mediaUrls: mediaOf(post),
    createdAt: post.created_at || new Date().toISOString(),
    audience: post.audience || 'public',
    author,
    likesCount: Number(post.likes_count ?? 0),
    commentsCount: Number(post.comments_count ?? 0),
    sharesCount: Number(post.shares_count ?? 0),
    userLiked: Boolean(like.data),
    userSaved: Boolean(save.data),
    repostedFromId: post.reposted_from_id || null,
    location: (() => {
      const payload = post.snapshot_payload;
      const lat = Number(payload?.lat);
      const lng = Number(payload?.lng);
      return Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng, label: typeof payload?.label === 'string' ? payload.label : '' }
        : inferPostLocation(post.content || '');
    })(),
  };
}

export async function fetchPostComments(postId: string): Promise<PostComment[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: rows, error } = await supabase
    .from('post_comments')
    .select('id,post_id,author_id,content,parent_id,created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error || !rows) return [];

  const authorIds = [...new Set(rows.map((row) => row.author_id).filter(Boolean))];
  const commentIds = rows.map((row) => row.id);
  const [{ data: profiles }, { data: likes }] = await Promise.all([
    authorIds.length
      ? supabase
          .from('public_profiles')
          .select('id,full_name,handle,avatar_url')
          .in('id', authorIds)
      : Promise.resolve({ data: [] as AnyRow[] }),
    commentIds.length
      ? supabase
          .from('post_comment_likes')
          .select('comment_id,user_id')
          .in('comment_id', commentIds)
      : Promise.resolve({ data: [] as AnyRow[] }),
  ]);

  const profileById = new Map((profiles ?? []).map((profile: AnyRow) => [profile.id, profile]));
  const likeByComment = new Map<string, { count: number; liked: boolean }>();
  for (const like of likes ?? []) {
    const entry = likeByComment.get(like.comment_id) ?? { count: 0, liked: false };
    entry.count += 1;
    if (user && like.user_id === user.id) entry.liked = true;
    likeByComment.set(like.comment_id, entry);
  }

  return rows.map((row) => {
    const profile = profileById.get(row.author_id) as AnyRow | undefined;
    const like = likeByComment.get(row.id);
    return {
      id: row.id,
      parentId: row.parent_id || null,
      content: row.content || '',
      createdAt: row.created_at || '',
      author: profile
        ? {
            id: profile.id,
            name: profile.full_name || profile.handle || 'Voyageur',
            handle: (profile.handle || '').replace(/^@/, ''),
            avatarUrl: profile.avatar_url || null,
          }
        : null,
      likesCount: like?.count ?? 0,
      userLiked: Boolean(like?.liked),
      isOwner: Boolean(user && row.author_id === user.id),
    };
  });
}

export async function fetchShareTargets(): Promise<ShareTarget[]> {
  const response = await fetch('/api/compte/share-post', { cache: 'no-store' });
  if (!response.ok) return [];
  const payload = await response.json().catch(() => null);
  const rows = Array.isArray(payload?.conversations) ? payload.conversations : [];
  return rows.map((row: AnyRow) => ({
    id: row.id,
    title: row.title || row.name || 'Conversation',
    type: row.type === 'group' ? 'group' : 'direct',
    avatarUrl: row.avatar_url || null,
    lastMessageAt: row.last_message_at || null,
  }));
}

export async function fetchSavedPosts(): Promise<SavedPost[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: saves, error } = await supabase
    .from('post_saves')
    .select('post_id,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error || !saves?.length) return [];
  const ids = saves.map((row) => row.post_id);
  const { data: posts } = await supabase
    .from('community_posts')
    .select('*')
    .in('id', ids);
  const byId = new Map((posts ?? []).map((post) => [post.id, post]));
  const authorIds = [...new Set((posts ?? []).map((post) => post.author_id).filter(Boolean))];
  const { data: profiles } = authorIds.length
    ? await supabase
        .from('public_profiles')
        .select('id,full_name,handle,avatar_url')
        .in('id', authorIds)
    : { data: [] as AnyRow[] };
  const authors = new Map<string, PostAuthor | null>(
    (profiles ?? []).map((profile: AnyRow) => [
      profile.id,
      {
        id: profile.id,
        name: (profile.full_name || profile.handle || 'Voyageur').trim(),
        handle: (profile.handle || '').replace(/^@/, ''),
        avatarUrl: profile.avatar_url || null,
      },
    ])
  );
  const result: SavedPost[] = [];
  for (const save of saves) {
    const post = byId.get(save.post_id);
    if (!post) continue;
    const media = mediaOf(post);
    result.push({
      id: post.id,
      title: post.title || (post.content || '').slice(0, 70) || 'Publication',
      excerpt: post.content || '',
      imageUrl: media[0] ?? null,
      createdAt: post.created_at || '',
      author: authors.get(post.author_id) ?? null,
      likesCount: Number(post.likes_count ?? 0),
      commentsCount: Number(post.comments_count ?? 0),
    });
  }
  return result;
}
