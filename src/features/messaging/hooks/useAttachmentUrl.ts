"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const DIRECT_URL_RE = /^(https?:|blob:|data:)/i;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6;

export function isDirectAttachmentUrl(value: string | null | undefined): boolean {
  return !!value && DIRECT_URL_RE.test(value);
}

/**
 * F-006 — les pièces jointes sont stockées en CLÉ DURABLE d'objet
 * (`{conversationId}/{userId}/{fichier}`) dans le bucket privé
 * `message-attachments`. Ce hook produit l'accès temporaire à la lecture :
 * les anciens messages qui portent encore une URL directe (historique ou
 * démo) sont rendus tels quels.
 */
export function useResolvedAttachmentUrl(content: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    isDirectAttachmentUrl(content) ? (content as string) : null
  );

  useEffect(() => {
    if (!content) {
      setUrl(null);
      return;
    }

    if (isDirectAttachmentUrl(content)) {
      setUrl(content);
      return;
    }

    let cancelled = false;
    setUrl(null);

    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.storage
        .from('message-attachments')
        .createSignedUrl(content, SIGNED_URL_TTL_SECONDS);

      if (!cancelled) {
        setUrl(data?.signedUrl ?? null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [content]);

  return url;
}
