'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { PaysCarnetPost, type PaysCarnetFeedItem } from './PaysCarnetPost';

interface PaysCarnetFeedProps {
  countryCode: string;
  countryName: string;
  userId?: string | null;
}

function Skeleton() {
  return (
    <div className="lkdv-feed-list" aria-label="Chargement des carnets les plus aimés">
      {[0, 1].map((index) => (
        <div key={index} className="lkdv-feed-skeleton" aria-hidden="true" />
      ))}
    </div>
  );
}

export function PaysCarnetFeed({ countryCode, countryName, userId }: PaysCarnetFeedProps) {
  const [items, setItems] = useState<PaysCarnetFeedItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const current = auth?.user ? { id: auth.user.id } : null;
        const { data, error } = await supabase
          .from('carnets')
          .select('id,author_id,title,destination,description,cover_image,likes_count,comments_count,created_at,country_iso,visibility')
          .eq('visibility', 'public')
          .ilike('country_iso', countryCode.toLowerCase())
          .order('likes_count', { ascending: false })
          .limit(30);
        if (!alive) return;
        if (error || !data) {
          setItems([]);
          setFailed(true);
          return;
        }
        const rows = data as Array<Record<string, unknown>>;
        const profiles = await fetchPublicProfilesWith(
          supabase,
          rows.map((row) => row.author_id as string | null)
        );
        let liked = new Set<string>();
        let favorited = new Set<string>();
        if (current && rows.length > 0) {
          const ids = rows.map((row) => row.id as string);
          const [likesRes, favsRes] = await Promise.all([
            supabase.from('carnet_likes').select('carnet_id').eq('user_id', current.id).in('carnet_id', ids),
            supabase.from('carnet_favorites').select('carnet_id').eq('user_id', current.id).in('carnet_id', ids),
          ]);
          liked = new Set(((likesRes.data ?? []) as Array<{ carnet_id: string }>).map((row) => row.carnet_id));
          favorited = new Set(((favsRes.data ?? []) as Array<{ carnet_id: string }>).map((row) => row.carnet_id));
        }
        if (!alive) return;
        setUser(current);
        setItems(
          rows.map((row) => {
            const profile = row.author_id ? profiles[row.author_id as string] : undefined;
            return {
              id: row.id as string,
              title: (row.title as string) || 'Carnet sans titre',
              destination: (row.destination as string | null) ?? countryName,
              description: (row.description as string | null) ?? null,
              cover: (row.cover_image as string | null) ?? null,
              likes: Number(row.likes_count ?? 0),
              comments: Number(row.comments_count ?? 0),
              createdAt: (row.created_at as string) ?? '',
              author: profile
                ? { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url, location: profile.location }
                : undefined,
              userLiked: liked.has(row.id as string),
              userFavorited: favorited.has(row.id as string),
            };
          })
        );
      } catch {
        if (alive) {
          setItems([]);
          setFailed(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [countryCode, countryName, userId]);

  if (!items) return <Skeleton />;
  if (failed) {
    return (
      <div className="lkdv-feed-error" role="alert">
        <h2>Les carnets n’ont pas pu être chargés</h2>
        <p>Aucune donnée n’a été inventée.</p>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="lkdv-feed-empty">
        <h2>Aucun carnet publié</h2>
        <p>Sois le premier à raconter ce pays.</p>
      </div>
    );
  }

  return (
    <div className="lkdv-feed-list">
      {items.map((item) => (
        <PaysCarnetPost key={item.id} item={item} user={user} />
      ))}
    </div>
  );
}

export default PaysCarnetFeed;
