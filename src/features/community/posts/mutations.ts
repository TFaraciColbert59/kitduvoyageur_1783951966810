import { createClient } from '@/lib/supabase/client';
import { postPermalink, type PostComment } from './types';

function client() {
  return createClient();
}

async function currentUserId(): Promise<string> {
  const { data } = await client().auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error('Connexion requise');
  return id;
}

export async function togglePostLike(postId: string): Promise<void> {
  await currentUserId();
  const { error } = await client().rpc('toggle_community_post_like', {
    p_post_id: postId,
  });
  if (error) throw new Error(error.message);
}

export async function togglePostSave(postId: string): Promise<boolean> {
  const supabase = client();
  const userId = await currentUserId();
  const { data: existing, error: readError } = await supabase
    .from('post_saves')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing) {
    const { error } = await supabase
      .from('post_saves')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await supabase
    .from('post_saves')
    .insert({ post_id: postId, user_id: userId });
  if (error) throw new Error(error.message);
  return true;
}

export async function createPostComment(
  postId: string,
  content: string,
  parentId: string | null = null
): Promise<void> {
  const supabase = client();
  const userId = await currentUserId();
  const text = content.trim();
  if (!text) throw new Error('Commentaire vide');
  if (text.length > 5000) throw new Error('Commentaire trop long');
  const { error } = await supabase.from('post_comments').insert({
    post_id: postId,
    author_id: userId,
    content: text,
    parent_id: parentId,
  });
  if (error) throw new Error(error.message);
}

export async function updatePostComment(commentId: string, content: string): Promise<void> {
  const supabase = client();
  const userId = await currentUserId();
  const text = content.trim();
  if (!text) throw new Error('Commentaire vide');
  const { error } = await supabase
    .from('post_comments')
    .update({ content: text })
    .eq('id', commentId)
    .eq('author_id', userId);
  if (error) throw new Error(error.message);
}

export async function deletePostComment(commentId: string): Promise<void> {
  const supabase = client();
  const userId = await currentUserId();
  const { error } = await supabase
    .from('post_comments')
    .delete()
    .eq('id', commentId)
    .eq('author_id', userId);
  if (error) throw new Error(error.message);
}

export async function toggleCommentLike(
  commentId: string,
  nextLiked: boolean
): Promise<void> {
  const supabase = client();
  const userId = await currentUserId();
  const { error } = nextLiked
    ? await supabase
        .from('post_comment_likes')
        .upsert(
          { comment_id: commentId, user_id: userId },
          { onConflict: 'user_id,comment_id', ignoreDuplicates: true }
        )
    : await supabase
        .from('post_comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function reportPost(
  postId: string,
  reason: string,
  details = ''
): Promise<void> {
  const supabase = client();
  const userId = await currentUserId();
  const payload = {
    post_id: postId,
    reporter_id: userId,
    reason: details ? `${reason} — ${details}` : reason,
    details: details || null,
    status: 'pending',
  };
  const { error } = await supabase.from('post_reports').insert(payload);
  if (!error) return;
  // Migration `post_reports` pas encore appliquée sur tous les environnements :
  // on conserve le signalement dans la table historique, avec le bon type.
  if (error.code === '42P01' || error.code === 'PGRST205') {
    const { error: fallbackError } = await supabase.from('comment_reports').insert({
      comment_id: postId,
      reporter_id: userId,
      reason: payload.reason,
      table_name: 'community_posts',
    });
    if (fallbackError) throw new Error(fallbackError.message);
    return;
  }
  throw new Error(error.message);
}

export async function reportComment(
  commentId: string,
  reason: string,
  details = ''
): Promise<void> {
  const supabase = client();
  const userId = await currentUserId();
  const { error } = await supabase.from('comment_reports').insert({
    comment_id: commentId,
    reporter_id: userId,
    reason: details ? `${reason} — ${details}` : reason,
    table_name: 'post_comments',
  });
  if (error) throw new Error(error.message);
}

export async function repostPost(postId: string, audience = 'public'): Promise<void> {
  const response = await fetch('/api/compte/repost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sourceId: postId,
      audience,
      client_request_id: crypto.randomUUID(),
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || 'Republication impossible');
  }
}

export async function deletePost(postId: string): Promise<void> {
  const supabase = client();
  const userId = await currentUserId();
  const { error } = await supabase
    .from('community_posts')
    .delete()
    .eq('id', postId)
    .eq('author_id', userId);
  if (error) throw new Error(error.message);
}

export async function sharePostToConversation(
  postId: string,
  conversationId: string
): Promise<void> {
  const response = await fetch('/api/compte/share-post', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ postId, conversationId }),
  });
  if (!response.ok) throw new Error('Envoi impossible');
}

export async function copyPostLink(postId: string): Promise<string> {
  const url = postPermalink(postId);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return url;
  }
  const input = document.createElement('textarea');
  input.value = url;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
  return url;
}

export async function sharePostExternally(
  title: string,
  text: string,
  postId: string
): Promise<'shared' | 'copied'> {
  const url = postPermalink(postId);
  if (navigator.share) {
    await navigator.share({ title, text, url });
    return 'shared';
  }
  await copyPostLink(postId);
  return 'copied';
}

export function optimisticComment(
  content: string,
  author: { id: string; name: string; handle: string; avatarUrl: string | null } | null,
  parentId: string | null
): PostComment {
  return {
    id: `temp_${crypto.randomUUID()}`,
    parentId,
    content: content.trim(),
    createdAt: new Date().toISOString(),
    author,
    likesCount: 0,
    userLiked: false,
    isOwner: true,
  };
}
