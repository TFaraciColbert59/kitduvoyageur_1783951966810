'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { isCommunityVideoUrl, usableCommunityMedia } from '@/lib/community/media';
import CommunityVideo from '@/components/communaute/CommunityVideo';

type VideoPost = { id: string; src: string; text: string; authorId: string | null; author: string };

export default function CommunityReelsPage() {
  const [reels, setReels] = useState<VideoPost[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPage = useCallback(async (next: number) => {
    setLoading(true); setError('');
    try {
      const supabase = createClient();
      // Same RLS as Community: no service key and no privileged visibility.
      const { data, error: readError } = await supabase.from('community_posts')
        .select('*').order('created_at', { ascending: false }).range(next * 30, (next + 1) * 30 - 1);
      if (readError) throw readError;
      const rows = (data ?? []) as Array<{ id: string; image_url?: string | null; media_urls?: string[]; content?: string; author_id?: string }>;
      const raw = rows.flatMap((row) => usableCommunityMedia(row.media_urls, row.image_url)
        .filter(isCommunityVideoUrl).map((src) => ({
          id: row.id, src, text: row.content ?? '', authorId: row.author_id ?? null,
        })));
      const profiles = await fetchPublicProfilesWith(supabase, raw.map((item) => item.authorId));
      const mapped = raw.map((item) => ({
        ...item, author: item.authorId ? profiles[item.authorId]?.full_name || 'Voyageur' : 'Voyageur',
      }));
      setReels((previous) => next === 0 ? mapped : [
        ...previous, ...mapped.filter((item) => !previous.some((old) => old.id === item.id && old.src === item.src)),
      ]);
      setPage(next);
      setMore(rows.length === 30);
    } catch {
      setError('Les vidéos sont indisponibles. Réessayez.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPage(0); }, [fetchPage]);

  return (
    <main className="lkdv-community-reels" aria-label="Vidéos de la communauté">
      <header className="lkdv-community-reels-header">
        <Link href="/communaute/decouvrir" aria-label="Retour à la découverte">‹</Link>
        <h1>Reels · LKDV</h1>
        <Link href="/communaute/publier" aria-label="Publier une vidéo">＋</Link>
      </header>
      {reels.length === 0 && !loading && !error && <p className="p-8 text-center">Aucune vidéo disponible pour le moment.</p>}
      <div className="lkdv-community-reels-track">
        {reels.map((reel) => (
          <article className="lkdv-community-reel" key={reel.id + reel.src}>
            <CommunityVideo src={reel.src} className="absolute inset-0" />
            <div className="lkdv-community-reel-info">
              {reel.authorId ? <Link href={'/profil/' + reel.authorId} className="font-bold">
                @{reel.author}
              </Link> : <strong>{reel.author}</strong>}
              <p className="line-clamp-3 text-sm">{reel.text}</p>
              <Link href={'/communaute/post/' + reel.id} className="lkdv-community-reel-post">
                Ouvrir le post · aimer, commenter et partager
              </Link>
            </div>
          </article>
        ))}
        {error && <p role="alert" className="py-5 text-center">{error}
          <button className="ml-2 underline" onClick={() => void fetchPage(page)} type="button">Réessayer</button>
        </p>}
        {more && <div className="flex justify-center py-5">
          <button className="rounded-full border px-5 py-3 text-sm disabled:opacity-50"
            type="button" disabled={loading} onClick={() => void fetchPage(page + 1)}>
            {loading ? 'Chargement…' : 'Charger plus de vidéos'}
          </button>
        </div>}
      </div>
    </main>
  );
}
