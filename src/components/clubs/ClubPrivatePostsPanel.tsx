'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import CommunityFeedPost from '@/features/community/feed/CommunityFeedPost';
import type { FeedPost } from '@/features/community/feed/useCommunityFeed';

/** Club member feed. Postgres RLS is authoritative and no service key is used. */
export default function ClubPrivatePostsPanel({
  clubId, isMember, user,
}: {
  clubId: string;
  isMember: boolean;
  user: { id: string } | null;
}) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);

  useEffect(() => {
    if (!clubId || !user?.id || !isMember) {
      setPosts([]);
      return;
    }
    let alive = true;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const supabase = createClient();
        const { data, error: queryError } = await supabase.from('community_posts')
          .select('id, author_id, content, image_url, media_urls, linked_kit_id, linked_carnet_id, snapshot_payload, likes_count, comments_count, created_at')
          .eq('club_id', clubId)
          .eq('audience', 'club')
          .order('created_at', { ascending: false })
          .limit(30);
        if (queryError) throw queryError;
        const rows = (data ?? []) as unknown as FeedPost[];
        const authors = rows.map((post) => post.author_id).filter((id): id is string => Boolean(id));
        const profiles = await fetchPublicProfilesWith(supabase, authors);
        // États j'aime / favori du lecteur, en une passe (comme le fil Communauté).
        const ids = rows.map((post) => post.id);
        const [likesRes, savesRes] = ids.length > 0
          ? await Promise.all([
              supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', ids),
              supabase.from('post_saves').select('post_id').eq('user_id', user.id).in('post_id', ids),
            ])
          : [{ data: [] }, { data: [] }];
        const liked = new Set((likesRes.data ?? []).map((row: { post_id: string }) => row.post_id));
        const saved = new Set((savesRes.data ?? []).map((row: { post_id: string }) => row.post_id));
        if (!alive) return;
        setPosts(rows.map((post) => {
          const profile = post.author_id ? profiles[post.author_id] : undefined;
          return {
            ...post,
            author: profile
              ? { id: post.author_id as string, full_name: profile.full_name ?? 'Voyageur', avatar_url: profile.avatar_url ?? null, handle: profile.handle ?? null }
              : { full_name: 'Voyageur' },
            user_liked: liked.has(post.id),
            user_saved: saved.has(post.id),
          } as FeedPost;
        }));
      } catch {
        if (alive) setError('Impossible de charger les publications réservées au club.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    void run();
    return () => { alive = false; };
  }, [clubId, isMember, user?.id, revision]);

  if (!user?.id || !isMember) return null;

  return (
    <section className="lkdv-club-private-posts space-y-3" aria-label="Publications réservées aux membres">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[color:var(--lkv-text-primary)]">Publications des membres</h2>
        <Link
          href={'/communaute?clubId=' + encodeURIComponent(clubId)}
          className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-[color:var(--lkv-text-primary)]"
        >
          + Publier
        </Link>
      </div>
      {loading && <p role="status" className="text-sm">Chargement des publications…</p>}
      {error && (
        <div role="alert" className="flex items-center gap-2 text-sm">
          {error}
          <button type="button" onClick={refresh} className="min-h-11 px-3 underline">Réessayer</button>
        </div>
      )}
      {!loading && !error && posts.length === 0 && (
        <p className="text-sm text-[color:var(--lkv-text-secondary)]">Aucune publication privée pour le moment.</p>
      )}
      {posts.map((post) => <CommunityFeedPost key={post.id} post={post} user={user} embedded />)}
    </section>
  );
}
