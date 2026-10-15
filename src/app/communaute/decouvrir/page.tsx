'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isCommunityVideoUrl, usableCommunityMedia } from '@/lib/community/media';

type Post = {
  id: string; author_id?: string | null; content?: string | null;
  image_url?: string | null; media_urls?: string[] | null;
  snapshot_payload?: { title?: string; destination?: string; tags?: string[] } | null;
  created_at?: string;
};
type Filter = 'all' | 'photos' | 'videos' | 'carnets';
const PAGE_SIZE = 24;

function firstMedia(post: Post): string | null {
  return usableCommunityMedia(post.media_urls, post.image_url)[0] ?? null;
}
function classify(post: Post, filter: Filter): boolean {
  const media = firstMedia(post);
  if (filter === 'photos') return Boolean(media && !isCommunityVideoUrl(media));
  if (filter === 'videos') return Boolean(media && isCommunityVideoUrl(media));
  if (filter === 'carnets') return Boolean(post.snapshot_payload);
  return Boolean(media || post.snapshot_payload);
}

export default function CommunityDiscoveryPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [retryPage, setRetryPage] = useState<number | null>(null);

  const load = useCallback(async (offset: number) => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { data, error: readError } = await supabase.from('community_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset * PAGE_SIZE, (offset + 1) * PAGE_SIZE - 1);
      if (readError) throw readError;
      const list = (data ?? []) as Post[];
      // Trust Supabase RLS for public visibility and block lists; do not
      // expose raw author emails or other private profile fields.
      setPosts((previous) => offset === 0 ? list : [
        ...previous, ...list.filter((post) => !previous.some((item) => item.id === post.id)),
      ]);
      setRetryPage(null);
      setPage(offset);
      setHasMore(list.length === PAGE_SIZE);
    } catch {
      setRetryPage(offset);
      setError('Impossible de charger les publications. Réessayez.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(0); }, [load]);

  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('fr');
    let hidden = new Set<string>();
    try {
      const saved = JSON.parse(localStorage.getItem('lkdv:hidden_posts') || '[]');
      hidden = new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []);
    } catch { /* No persistence required for browsing. */ }
    return posts.filter((post) => {
      if (hidden.has(post.id) || !classify(post, filter)) return false;
      if (!search) return true;
      const text = [post.content, post.snapshot_payload?.title, post.snapshot_payload?.destination,
        ...(Array.isArray(post.snapshot_payload?.tags) ? post.snapshot_payload!.tags! : [])]
        .filter((part) => typeof part === 'string').join(' ').toLocaleLowerCase('fr');
      return text.includes(search);
    });
  }, [posts, filter, query]);

  return (
    <main className="lkdv-community-discovery min-h-screen px-0 pb-32">
      <header className="lkdv-community-discovery-header">
        <Link href="/communaute" aria-label="Retour à la communauté" className="lkdv-discovery-back">‹</Link>
        <h1>Découvrir</h1>
        <Link href="/communaute/publier" aria-label="Publier" className="lkdv-discovery-create">＋</Link>
      </header>
      <div className="mx-auto max-w-5xl px-3 pt-3">
        <label htmlFor="community-discovery-search" className="sr-only">Rechercher un lieu ou une aventure</label>
        <input id="community-discovery-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="Chercher un lieu, un récit…" className="lkdv-community-discovery-search w-full" />
        <div className="flex justify-end">
          <Link href="/communaute/reels" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold">▶ Regarder les Reels</Link>
        </div>
        <nav className="lkdv-community-discovery-filters" aria-label="Filtres de découverte">
          {([['all', 'Tout'], ['photos', 'Photos'], ['videos', 'Vidéos'], ['carnets', 'Carnets']] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id}
              onClick={() => setFilter(id)}>{label}</button>
          ))}
        </nav>
        {error && <div role="alert" className="px-2 py-4 text-sm">{error}
          <button type="button" onClick={() => void load(retryPage ?? (page + 1))} className="ml-3 underline">Réessayer</button>
        </div>}
        <section className="lkdv-community-discovery-grid" aria-label="Publications à découvrir">
          {visible.map((post) => {
            const url = firstMedia(post);
            return (
              <Link href={'/communaute/post/' + post.id} key={post.id} className="lkdv-community-discovery-tile"
                aria-label={'Ouvrir la publication : ' + (post.snapshot_payload?.title || post.content?.slice(0, 70) || 'voyage')}>
                {url && isCommunityVideoUrl(url)
                  ? <><video src={url} muted playsInline preload="metadata" aria-hidden="true" />
                      <span className="lkdv-community-discovery-video-icon" aria-hidden="true">▶</span></>
                  : url
                    ? <img src={url} loading="lazy" decoding="async" alt={post.snapshot_payload?.title || 'Photo de voyage'} />
                    : <span className="lkdv-community-discovery-carnet">{post.snapshot_payload?.title || 'Carnet de voyage'}</span>}
              </Link>
            );
          })}
        </section>
        {!loading && !error && visible.length === 0 && (
          <p className="py-12 text-center text-sm text-[color:var(--lkv-text-secondary)]">
            Aucun contenu pour ce filtre. Essayez une autre recherche.
          </p>
        )}
        {hasMore && <div className="flex justify-center py-7">
          <button type="button" disabled={loading} onClick={() => void load(page + 1)}
            className="rounded-full border border-[color:var(--lkv-border)] px-5 py-3 text-sm font-semibold disabled:opacity-50">
            {loading ? 'Chargement…' : 'Voir plus de publications'}
          </button>
        </div>}
      </div>
    </main>
  );
}
