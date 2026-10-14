'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { isCommunityVideoUrl, usableCommunityMedia } from '@/lib/community/media';
import CommunityVideo from '@/components/communaute/CommunityVideo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

type VideoPost = { id: string; src: string; text: string; authorId: string | null; author: string; likes: number; comments: number; liked: boolean; saved: boolean };

export default function CommunityReelsPage() {
  const { user } = useAuth();
  const [actionError, setActionError] = useState('');
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
      const rows = (data ?? []) as Array<{ id: string; image_url?: string | null; media_urls?: string[]; content?: string; author_id?: string; likes_count?: number; comments_count?: number }>;
      const raw = rows.flatMap((row) => usableCommunityMedia(row.media_urls, row.image_url)
        .filter(isCommunityVideoUrl).map((src) => ({
          id: row.id, src, text: row.content ?? '', authorId: row.author_id ?? null,
          likes: row.likes_count ?? 0, comments: row.comments_count ?? 0, liked: false, saved: false,
        })));
      const profiles = await fetchPublicProfilesWith(supabase, raw.map((item) => item.authorId));
      const ids = [...new Set(raw.map((item) => item.id))];
      let likedIds = new Set<string>();
      let savedIds = new Set<string>();
      if (user?.id && ids.length > 0) {
        const [likes, saves] = await Promise.all([
          supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', ids),
          supabase.from('post_saves').select('post_id').eq('user_id', user.id).in('post_id', ids),
        ]);
        likedIds = new Set((likes.data ?? []).map((item) => item.post_id));
        savedIds = new Set((saves.data ?? []).map((item) => item.post_id));
      }
      const mapped = raw.map((item) => ({
        ...item, author: item.authorId ? profiles[item.authorId]?.full_name || 'Voyageur' : 'Voyageur',
        liked: likedIds.has(item.id), saved: savedIds.has(item.id),
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
  }, [user?.id]);

  const toggleLike = async (id: string) => {
    if (!user?.id) { setActionError('Connectez-vous pour aimer une vidéo.'); return; }
    const previous = reels;
    setReels((list) => list.map((reel) => reel.id === id
      ? { ...reel, liked: !reel.liked, likes: reel.likes + (reel.liked ? -1 : 1) } : reel));
    const { error } = await createClient().rpc('toggle_community_post_like', { p_post_id: id });
    if (error) { setReels(previous); setActionError('Like non enregistré.'); }
  };
  const toggleSave = async (id: string) => {
    if (!user?.id) { setActionError('Connectez-vous pour enregistrer.'); return; }
    const previous = reels;
    const current = reels.find((reel) => reel.id === id);
    if (!current) return;
    setReels((list) => list.map((reel) => reel.id === id ? { ...reel, saved: !reel.saved } : reel));
    const supabase = createClient();
    const { error } = current.saved
      ? await supabase.from('post_saves').delete().eq('user_id', user.id).eq('post_id', id)
      : await supabase.from('post_saves').upsert({ user_id: user.id, post_id: id },
          { onConflict: 'user_id,post_id', ignoreDuplicates: true });
    if (error) { setReels(previous); setActionError('Enregistrement impossible.'); }
  };
  const share = async (id: string) => {
    const url = window.location.origin + '/communaute/post/' + id;
    try {
      if (navigator.share) await navigator.share({ url, title: 'LKDV · Une aventure à découvrir' });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); setActionError('Lien copié.'); }
      else setActionError(url);
    } catch { /* Share sheets can be dismissed without side effects. */ }
  };

  useEffect(() => { void fetchPage(0); }, [fetchPage]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: true } }));
    return () => window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: false } }));
  }, []);

  return (
    <main className="lkdv-community-reels" aria-label="Vidéos de la communauté">
      <header className="lkdv-community-reels-header">
        <Link href="/communaute/decouvrir" aria-label="Retour à la découverte">‹</Link>
        <h1>Reels · LKDV</h1>
        <Link href="/communaute/publier" aria-label="Publier une vidéo">＋</Link>
      </header>
      {reels.length === 0 && !loading && !error && <p className="p-8 text-center">Aucune vidéo disponible pour le moment.</p>}
      {actionError && <p role="status" className="px-4 py-2 text-center text-sm">{actionError}</p>}
      <div className="lkdv-community-reels-track">
        {reels.map((reel) => (
          <article className="lkdv-community-reel" key={reel.id + reel.src}>
            <CommunityVideo src={reel.src} className="absolute inset-0" />
            <div className="lkdv-community-reel-actions">
              <button type="button" onClick={() => void toggleLike(reel.id)} aria-label={reel.liked ? 'Retirer mon like' : 'Aimer'}
                aria-pressed={reel.liked}>
                <Icon name="heart" size={27} aria-hidden="true" /> <span>{reel.likes}</span>
              </button>
              <Link href={'/communaute/post/' + reel.id} aria-label="Ouvrir les commentaires">
                <Icon name="message-square" size={27} aria-hidden="true" /> <span>{reel.comments}</span>
              </Link>
              <button type="button" onClick={() => void share(reel.id)} aria-label="Partager">
                <Icon name="send" size={27} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => void toggleSave(reel.id)} aria-label={reel.saved ? 'Retirer des favoris' : 'Enregistrer'}
                aria-pressed={reel.saved}>
                <Icon name="bookmark" size={27} aria-hidden="true" />
              </button>
            </div>
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
