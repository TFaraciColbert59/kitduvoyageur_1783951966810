'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { mapSearchRows, normalizeQuery, SEARCH_MIN_CHARS, type SearchResult } from './search';

const DEBOUNCE_MS = 280;
const PER_KIND = 8;

/**
 * Cinq recherches `ilike` en parallèle (publications, carnets, clubs, sorties,
 * membres), après 280 ms de pause de frappe. Les index trigramme de la
 * migration 20261028160000 les rendent rapides. Le texte est nettoyé avant
 * d'entrer dans un filtre PostgREST.
 */
export function useCommunitySearch(rawQuery: string, enabled: boolean) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const text = normalizeQuery(rawQuery);

  useEffect(() => {
    if (!enabled || text.length < SEARCH_MIN_CHARS) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const supabase = createClient();
        const like = `%${text}%`;
        const [posts, carnets, clubs, events, members] = await Promise.all([
          supabase.from('community_posts').select('id,content,image_url,media_urls').ilike('content', like).order('created_at', { ascending: false }).limit(PER_KIND),
          supabase.from('carnets').select('id,title,cover_image').ilike('title', like).limit(PER_KIND),
          supabase.from('clubs').select('id,slug,name,cover_image,members_count,category').ilike('name', like).limit(PER_KIND),
          supabase.from('events').select('id,title,location,event_date').ilike('title', like).limit(PER_KIND),
          supabase.from('public_profiles').select('id,full_name,handle,avatar_url,location').or(`full_name.ilike.${like},handle.ilike.${like}`).limit(PER_KIND),
        ]);
        if (cancelled) return;
        setResults(
          mapSearchRows({ posts: posts.data, carnets: carnets.data, clubs: clubs.data, events: events.data, members: members.data }),
        );
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, text]);

  return { results, searching, text };
}
