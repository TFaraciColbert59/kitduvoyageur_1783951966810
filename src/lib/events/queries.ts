import { createClient } from '@/lib/supabase/client';
import { handleActivityFeedEvent, type ActivityFeedItem } from './handlers/activityFeedHandler';
import type { LkvEvent } from './types';

export interface FetchEventsOptions {
  limit?: number;
  crewId?: string;
  visibility?: 'public' | 'crew' | 'all';
}

/**
 * Récupère les événements récents depuis la table `lkv_events`
 * et les formate en éléments exploitables pour le flux d'activité.
 */
export async function fetchRecentEvents(
  options: FetchEventsOptions = {}
): Promise<ActivityFeedItem[]> {
  const { limit = 20, crewId, visibility = 'public' } = options;
  const supabase = createClient();

  try {
    let query = supabase
      .from('lkv_events')
      .select('id, event_type, actor_id, entity_type, entity_id, metadata, visibility, crew_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (crewId) {
      query = query.eq('crew_id', crewId);
    } else if (visibility === 'public') {
      query = query.eq('visibility', 'public');
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[EventBus] Error fetching recent events:', error.message);
      return [];
    }

    if (!data || !Array.isArray(data)) {
      return [];
    }

    const items: ActivityFeedItem[] = [];
    for (const raw of data) {
      const event: LkvEvent = {
        id: raw.id,
        event_type: raw.event_type,
        actor_id: raw.actor_id,
        entity_type: raw.entity_type,
        entity_id: raw.entity_id,
        metadata: raw.metadata || {},
        visibility: raw.visibility,
        crew_id: raw.crew_id,
        created_at: raw.created_at,
      };

      const feedItem = handleActivityFeedEvent(event);
      if (feedItem) {
        items.push(feedItem);
      }
    }

    return items;
  } catch (err) {
    console.error('[EventBus] Unexpected error fetching events:', err);
    return [];
  }
}
