'use client';

// src/features/messaging/components/PostPreviewCard.tsx
//
// Post partagé en conversation : carte COMPACTE (pas le bloc géant du fil).
// Le message ne transporte souvent que l'id : on complète titre, auteur et
// vignette par une lecture unique de la publication.

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';

export interface PostPreviewCardProps {
  postId: string;
  fallbackTitle?: string | null;
  fallbackAuthor?: string | null;
  fallbackImage?: string | null;
  onOpen: () => void;
}

export function PostPreviewCard({ postId, fallbackTitle, fallbackAuthor, fallbackImage, onOpen }: PostPreviewCardProps) {
  const [preview, setPreview] = useState<{
    title: string | null;
    author: string | null;
    image: string | null;
  }>({ title: fallbackTitle ?? null, author: fallbackAuthor ?? null, image: fallbackImage ?? null });

  useEffect(() => {
    if (fallbackTitle && fallbackImage) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('community_posts')
          .select('id, content, image_url, media_urls, author_id')
          .eq('id', postId)
          .maybeSingle();
        if (!data || cancelled) return;
        const row = data as {
          content?: string | null;
          image_url?: string | null;
          media_urls?: string[] | null;
          author_id?: string | null;
        };
        let author: string | null = null;
        if (row.author_id) {
          const { data: profile } = await supabase
            .from('public_profiles')
            .select('full_name')
            .eq('id', row.author_id)
            .maybeSingle();
          author = (profile as { full_name?: string } | null)?.full_name ?? null;
        }
        if (cancelled) return;
        setPreview({
          title: row.content?.slice(0, 70) ?? fallbackTitle ?? null,
          author: author ?? fallbackAuthor ?? null,
          image: row.image_url ?? row.media_urls?.[0] ?? fallbackImage ?? null,
        });
      } catch {
        /* aperçu indisponible : la carte garde les valeurs du message */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, fallbackTitle, fallbackAuthor, fallbackImage]);

  return (
    <button
      type="button"
      className="mcard mpost-compact"
      onClick={onOpen}
      aria-label={`Publication partagée : ${preview.title || 'voir la publication'}`}
    >
      {preview.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- vignette distante
        <img className="mcard-img" src={preview.image} alt="" loading="lazy" decoding="async" width={44} height={44} />
      ) : (
        <span className="mcard-ico" aria-hidden="true">
          <Icon name="newspaper" className="size-4" />
        </span>
      )}
      <span className="mcard-txt">
        <b>{preview.title || 'Publication partagée'}</b>
        <small>{preview.author || 'Communauté LKDV'} · Voir la publication</small>
      </span>
      <Icon name="chevron-right" className="size-3.5 mpost-compact-chevron" aria-hidden="true" />
    </button>
  );
}
