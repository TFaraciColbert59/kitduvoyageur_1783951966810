'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { useAuth } from '@/contexts/AuthContext';
import CommunityPostCard, { type CommunityPostItem } from '@/components/communaute/CommunityPostCard';
import { CommunityShell } from '@/components/communaute/shell/CommunityShell';
import { HeaderBackButton } from '@/components/ui';

export default function CommunityPostPage() {
  const params = useParams();
  const { user } = useAuth();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [post, setPost] = useState<CommunityPostItem | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setPending(true);
      setPost(null);
      setError('');
      try {
        const supabase = createClient();
        const { data, error: readError } = await supabase.from('community_posts')
          .select('*').eq('id', id).maybeSingle();
        if (readError) throw readError;
        if (!data) { if (active) setError('Publication introuvable ou inaccessible.'); return; }
        const ownerId = data.author_id as string | null;
        const profiles = await fetchPublicProfilesWith(supabase, ownerId ? [ownerId] : []);
        if (!active) return;
        let liked = false;
        let saved = false;
        if (user?.id) {
          const [likes, saves] = await Promise.all([
            supabase.from('post_likes').select('post_id').eq('user_id', user.id).eq('post_id', id).maybeSingle(),
            supabase.from('post_saves').select('post_id').eq('user_id', user.id).eq('post_id', id).maybeSingle(),
          ]);
          liked = Boolean(likes.data);
          saved = Boolean(saves.data);
        }
        if (active) setPost({
          ...data, user_id: ownerId, user_liked: liked, user_saved: saved,
          author: ownerId ? profiles[ownerId] ?? undefined : undefined,
        } as CommunityPostItem);
      } catch {
        if (active) setError('Impossible de charger cette publication.');
      } finally {
        if (active) setPending(false);
      }
    };
    if (id) void load();
    else { setPending(false); setError('Publication introuvable.'); }
    return () => { active = false; };
  }, [id, user?.id]);

  return (
    <CommunityShell
      className="lkdv-community-experience"
      header={
        <header className="lkdv-subheader">
          <HeaderBackButton
            fallbackHref="/communaute/decouvrir"
            label="Retour à la découverte"
            className="lkdv-subheader-back"
          />
          <span className="lkdv-subheader-title">Publication</span>
          <span aria-hidden="true" />
        </header>
      }
    >
      <main className="min-h-screen pb-32">
        <div className="mx-auto max-w-2xl">
          {pending && <p className="p-8 text-center">Chargement de la publication…</p>}
          {error && <p role="alert" className="p-8 text-center">{error}</p>}
          {post && <CommunityPostCard key={post.id} post={post} user={user} />}
        </div>
      </main>
    </CommunityShell>
  );
}
