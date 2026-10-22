'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { isCommunityVideoUrl, usableCommunityMedia } from '@/lib/community/media';
import CommunityVideo from '@/components/communaute/CommunityVideo';
import Icon from '@/components/ui/AppIcon';
import { HeaderBackButton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

type VideoPost = { id: string; src: string; text: string; authorId: string | null; author: string; likes: number; comments: number; liked: boolean; saved: boolean };

export default function CommunityReelsPage() {
  const { user } = useAuth();
  const [actionError, setActionError] = useState('');
  const pendingRef = useRef(new Set<string>());
  const [pending, setPending] = useState<string[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const lastReelRef = useRef<HTMLElement | null>(null);
  const autoLoadsRef = useRef(0);
  const loadingNextRef = useRef(false);
  const startAction = (key: string) => {
    if (pendingRef.current.has(key)) return false;
    pendingRef.current.add(key);
    setPending(Array.from(pendingRef.current));
    return true;
  };
  const finishAction = (key: string) => {
    pendingRef.current.delete(key);
    setPending(Array.from(pendingRef.current));
  };
  const [reels, setReels] = useState<VideoPost[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryPage, setRetryPage] = useState<number | null>(null);

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
      setRetryPage(null);
      setPage(next);
      setMore(rows.length === 30);
    } catch {
      setRetryPage(next);
      setError('Les vidéos sont indisponibles. Réessayez.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const toggleLike = async (id: string) => {
    if (!user?.id) { setActionError('Connectez-vous pour aimer une vidéo.'); return; }
    const key = 'like:' + id;
    if (!startAction(key)) return;
    const previous = reels.find((reel) => reel.id === id);
    if (!previous) { finishAction(key); return; }
    setActionError('');
    setReels((list) => list.map((reel) => reel.id === id
      ? { ...reel, liked: !previous.liked, likes: previous.likes + (previous.liked ? -1 : 1) } : reel));
    try {
      const { error } = await createClient().rpc('toggle_community_post_like', { p_post_id: id });
      if (error) throw error;
    } catch {
      setReels((list) => list.map((reel) => reel.id === id
        ? { ...reel, liked: previous.liked, likes: previous.likes } : reel));
      setActionError('Like non enregistré.');
    } finally {
      finishAction(key);
    }
  };

  const toggleSave = async (id: string) => {
    if (!user?.id) { setActionError('Connectez-vous pour enregistrer.'); return; }
    const key = 'save:' + id;
    if (!startAction(key)) return;
    const previous = reels.find((reel) => reel.id === id);
    if (!previous) { finishAction(key); return; }
    setActionError('');
    setReels((list) => list.map((reel) => reel.id === id ? { ...reel, saved: !previous.saved } : reel));
    try {
      const supabase = createClient();
      const { error } = previous.saved
        ? await supabase.from('post_saves').delete().eq('user_id', user.id).eq('post_id', id)
        : await supabase.from('post_saves').upsert({ user_id: user.id, post_id: id },
          { onConflict: 'user_id,post_id', ignoreDuplicates: true });
      if (error) throw error;
    } catch {
      setReels((list) => list.map((reel) => reel.id === id ? { ...reel, saved: previous.saved } : reel));
      setActionError('Enregistrement impossible.');
    } finally {
      finishAction(key);
    }
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
    return () => { window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: false } })); };
  }, []);

  // Preload only the next two pages as the final Reel comes into view;
  // a visible manual button remains for metered connections and failures.
  useEffect(() => {
    if (loading || !more || reels.length === 0 || autoLoadsRef.current >= 2) return;
    const element = lastReelRef.current;
    const root = trackRef.current;
    if (!element || !root || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || loadingNextRef.current) return;
      loadingNextRef.current = true;
      autoLoadsRef.current += 1;
      void fetchPage(page + 1).finally(() => { loadingNextRef.current = false; });
    }, { root, threshold: 0.4 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [fetchPage, loading, more, page, reels.length]);

  return (
    <main className="lkdv-community-reels relative" aria-label="Vidéos de la communauté">
      <header className="lkdv-subheader lkdv-subheader-overlay">
        <HeaderBackButton
          fallbackHref="/communaute/decouvrir"
          label="Retour à la découverte"
          className="lkdv-subheader-back"
        />
        <h1 className="lkdv-subheader-title">Reels</h1>
        <Link href="/communaute/publier" aria-label="Publier une vidéo" className="lkdv-subheader-action">
          <Icon name="plus" size={20} aria-hidden="true" />
        </Link>
      </header>
      {reels.length === 0 && !loading && !error && <p className="px-8 pb-8 pt-28 text-center">Aucune vidéo disponible pour le moment.</p>}
      {actionError && <p role="status" className="px-4 pb-2 pt-28 text-center text-sm">{actionError}</p>}
      <div className="lkdv-community-reels-track" ref={trackRef}>
        {reels.map((reel, index) => (
          <article className="lkdv-community-reel" key={reel.id + reel.src} ref={index === reels.length - 1 ? lastReelRef : undefined}>
            <CommunityVideo src={reel.src} className="absolute inset-0" />
            <div className="lkdv-community-reel-actions">
              <button type="button" onClick={() => void toggleLike(reel.id)} disabled={pending.includes(`like:${reel.id}`)} aria-label={reel.liked ? 'Retirer mon like' : 'Aimer'}
                aria-pressed={reel.liked}>
                <Icon name="heart" size={27} aria-hidden="true" /> <span>{reel.likes}</span>
              </button>
              <Link href={'/communaute/post/' + reel.id} aria-label="Ouvrir les commentaires">
                <Icon name="message-square" size={27} aria-hidden="true" /> <span>{reel.comments}</span>
              </Link>
              <button type="button" onClick={() => void share(reel.id)} aria-label="Partager">
                <Icon name="send" size={27} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => void toggleSave(reel.id)} disabled={pending.includes(`save:${reel.id}`)} aria-label={reel.saved ? 'Retirer des favoris' : 'Enregistrer'}
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
          <button className="ml-2 underline" onClick={() => void fetchPage(retryPage ?? (page + 1))} type="button">Réessayer</button>
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
