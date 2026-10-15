'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isCommunityVideoUrl, usableCommunityMedia } from '@/lib/community/media';

type PublicPost = {
  id: string;
  image_url?: string | null;
  media_urls?: string[] | null;
  content?: string | null;
  snapshot_payload?: { title?: string | null } | null;
};

const PAGE_SIZE = 24;

/**
 * Public profile photo/video grid; reads only through Supabase RLS, never
 * by service key. No fabricated posts; text-only posts remain discoverable.
 */
export default function PublicProfilePostsGrid({ profileId }: { profileId: string }) {
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryPage, setRetryPage] = useState<number | null>(null);

  const load = useCallback(async (offset: number) => {
    if (!profileId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const { data, error: readError } = await createClient()
        .from('community_posts')
        .select('*')
        .eq('author_id', profileId)
        .order('created_at', { ascending: false })
        .range(offset * PAGE_SIZE, (offset + 1) * PAGE_SIZE - 1);
      if (readError) throw readError;
      const rows = (data ?? []) as PublicPost[];
      setPosts((previous) => offset === 0 ? rows : [
        ...previous, ...rows.filter((p) => !previous.some((old) => old.id === p.id)),
      ]);
      setMore(rows.length === PAGE_SIZE);
      setPage(offset);
      setRetryPage(null);
    } catch {
      setRetryPage(offset);
      setError('Impossible de charger les publications de ce voyageur.');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    setPosts([]);
    setMore(false);
    void load(0);
  }, [load]);

  return (
    <section className="lkdv-social-profile-posts" aria-label="Publications du voyageur">
      <h2 className="lkdv-social-profile-posts-heading">Publications</h2>
      {loading && posts.length === 0 && <p role="status" className="px-4 py-8 text-center text-sm">Chargement des publications…</p>}
      {error && (
        <div role="alert" className="px-4 py-5 text-sm">
          {error}
          <button type="button" className="ml-3 font-semibold underline" onClick={() => void load(retryPage ?? 0)}>
            Réessayer
          </button>
        </div>
      )}
      {!loading && !error && posts.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-[color:var(--lkv-text-secondary)]">
          Aucune publication publique pour le moment.
        </p>
      )}
      <div className="lkdv-social-profile-posts-grid">
        {posts.map((post) => {
          const url = usableCommunityMedia(post.media_urls, post.image_url)[0] ?? null;
          const video = Boolean(url && isCommunityVideoUrl(url));
          return (
            <Link href={'/communaute/post/' + post.id} key={post.id}
              aria-label={'Voir la publication : ' + (post.snapshot_payload?.title || post.content?.slice(0, 60) || 'Aventure')}
              className="lkdv-social-profile-posts-tile">
              {url && video
                ? <><video src={url} muted playsInline preload="metadata" aria-hidden="true" />
                    <span className="lkdv-social-profile-posts-video" aria-hidden="true">▶</span></>
                : url
                  ? <img src={url} loading="lazy" decoding="async" alt={post.snapshot_payload?.title || 'Photo de voyage'} />
                  : <span className="lkdv-social-profile-posts-text">{post.snapshot_payload?.title || post.content || 'Récit de voyage'}</span>}
            </Link>
          );
        })}
      </div>
      {more && (
        <div className="flex justify-center py-5">
          <button type="button" disabled={loading} onClick={() => void load(page + 1)}
            className="min-h-11 rounded-full border border-[color:var(--lkv-border)] px-5 py-2 text-sm font-semibold disabled:opacity-50">
            {loading ? 'Chargement…' : 'Voir plus de publications'}
          </button>
        </div>
      )}
    </section>
  );
}
