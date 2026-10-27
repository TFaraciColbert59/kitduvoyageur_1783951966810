"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const DIRECT_URL_RE = /^(https?:|blob:|data:)/i;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6;

/**
 * Cache mémoire des URLs signées : re-signer à chaque rendu coûtait un appel
 * réseau par bulle. La clé est la clé d'objet, la valeur expire un peu avant
 * la signature réelle.
 */
const signedCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_MARGIN_MS = 5 * 60 * 1000;

function readCached(key: string): string | null {
  const hit = signedCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    signedCache.delete(key);
    return null;
  }
  return hit.url;
}

function writeCached(key: string, url: string) {
  signedCache.set(key, { url, expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 - CACHE_MARGIN_MS });
}

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

    const cached = readCached(content);
    if (cached) {
      setUrl(cached);
      return;
    }

    let cancelled = false;
    setUrl(null);

    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.storage
        .from('message-attachments')
        .createSignedUrl(content, SIGNED_URL_TTL_SECONDS);

      if (!cancelled && data?.signedUrl) {
        writeCached(content, data.signedUrl);
        setUrl(data.signedUrl);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [content]);

  return url;
}
