'use client';

import { useCallback, useState } from 'react';
import type { StorySlide } from '@/components/communaute/StoriesViewer';
import { createClient } from '@/lib/supabase/client';
import { storyMediaUrl } from '@/lib/stories/media';
import type { HighlightCardData } from '../cards/HighlightCard';
import { asRecord, asText } from './memoriesModel';

export interface HighlightViewerState {
  /** Slides prêtes pour la visionneuse existante ; null tant qu'aucun album. */
  slides: StorySlide[] | null;
  /** Album en cours de chargement. */
  openingId: string | null;
  /** Message honnête à afficher (album vide, invisible ou erreur réseau). */
  error: string | null;
  open: (highlight: HighlightCardData) => Promise<void>;
  close: () => void;
}

export interface UseHighlightViewerOptions {
  /** Override hôte/tests : court-circuite le chargement Supabase. */
  onOpenHighlight?: (highlight: HighlightCardData) => void;
}

/**
 * Orchestration de la visionneuse À la une.
 *
 * Les stories chargées sont uniquement celles épinglées dans l'album demandé :
 * `story_highlight_items` fournit les ids, puis `post_stories` est lu pour ces
 * ids exacts (métadonnées média), jamais pour lister le flux général. RLS
 * `can_view_story` filtre ce que la personne ne peut pas voir.
 */
export function useHighlightViewer({
  onOpenHighlight,
}: UseHighlightViewerOptions = {}): HighlightViewerState {
  const [slides, setSlides] = useState<StorySlide[] | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setSlides(null);
  }, []);

  const open = useCallback(
    async (highlight: HighlightCardData) => {
      if (onOpenHighlight) {
        onOpenHighlight(highlight);
        return;
      }

      setError(null);
      setOpeningId(highlight.id);
      try {
        const supabase = createClient();
        const { data: links, error: linksError } = await supabase
          .from('story_highlight_items')
          .select('story_id,position')
          .eq('highlight_id', highlight.id)
          .order('position', { ascending: true });
        if (linksError) throw new Error(linksError.message);

        const storyIds = (links ?? [])
          .map((link) => asText(asRecord(link).story_id))
          .filter((id): id is string => id.length > 0);

        if (storyIds.length === 0) {
          setError('Aucune story dans cet album.');
          return;
        }

        const { data: rows, error: storiesError } = await supabase
          .from('post_stories')
          .select('id,image_url,storage_path,media_type,caption')
          .in('id', storyIds);
        if (storiesError) throw new Error(storiesError.message);

        const rowById = new Map<string, Record<string, unknown>>();
        for (const row of rows ?? []) {
          const record = asRecord(row);
          const id = asText(record.id);
          if (id) rowById.set(id, record);
        }

        const nextSlides: StorySlide[] = [];
        for (const storyId of storyIds) {
          const row = rowById.get(storyId);
          if (!row) continue;
          const media = storyMediaUrl({
            id: storyId,
            image_url: asText(row.image_url) || null,
            storage_path: asText(row.storage_path) || undefined,
          });
          if (!media) continue;
          nextSlides.push({
            image: media,
            caption: asText(row.caption) || undefined,
            storyId,
            mediaType: row.media_type === 'video' ? 'video' : 'image',
          });
        }

        if (nextSlides.length === 0) {
          setError('Aucune story visible dans cet album.');
          return;
        }
        setSlides(nextSlides);
      } catch (cause) {
        // Cause conservée pour le diagnostic local, jamais exposée à l'UI.
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[souvenirs] visionneuse À la une indisponible', cause);
        }
        setError('La visionneuse À la une n’a pas pu s’ouvrir.');
      } finally {
        setOpeningId(null);
      }
    },
    [onOpenHighlight]
  );

  return { slides, openingId, error, open, close };
}

export default useHighlightViewer;
