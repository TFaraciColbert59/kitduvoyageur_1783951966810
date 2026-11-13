import { NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import {
  filterVisibleClubs,
  searchClubEvents,
  type Club,
  type EventFormat,
  type EventSearchQuery,
} from '@/features/clubs';
import { dbFailure, json, optionalUser } from '../_lib/http';
import { loadViewerContext } from '../_lib/db';
import { asArray, mapClubRow, mapEventRow, type Row } from '../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseQuery(request: NextRequest): EventSearchQuery {
  const params = request.nextUrl.searchParams;
  const rawFormat = params.get('format');
  const formats: EventFormat[] = ['social_ride', 'training', 'race', 'trail_outing', 'indoor'];
  return {
    text: params.get('q')?.trim() || undefined,
    location: params.get('location')?.trim() || undefined,
    sport: params.get('sport')?.trim() || undefined,
    format: formats.includes(rawFormat as EventFormat) ? (rawFormat as EventFormat) : undefined,
    fromIso: params.get('from')?.trim() || undefined,
    toIso: params.get('to')?.trim() || undefined,
    racesOnly: params.get('racesOnly') === '1',
  };
}

/**
 * GET /api/clubs/events — recherche transverse S5.15/S5.16.
 *
 * Les clubs sont d’abord réduits par `filterVisibleClubs` ; la recherche
 * d’événements ne voit donc jamais un club secret. `searchClubEvents`
 * applique ensuite la visibilité de chaque sortie et les blocages S6.19.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    const { context, memberships } = await loadViewerContext(supabase, user?.id ?? null);

    const { data: clubRows, error: clubError } = await supabase
      .from('clubs')
      .select('*')
      .order('members_count', { ascending: false })
      .limit(200);
    if (clubError) return dbFailure('GET /api/clubs/events clubs', clubError);

    const clubs = filterVisibleClubs(asArray<Row>(clubRows).map(mapClubRow), context, [], {
      publicSearchOnly: !user,
    });
    if (clubs.length === 0) return json({ data: [], count: 0 });

    const clubsById = new Map<string, Club>(clubs.map((club) => [club.id, club]));
    const { data: eventRows, error: eventError } = await supabase
      .from('club_events')
      .select('*')
      .in(
        'club_id',
        clubs.map((club) => club.id),
      )
      .order('event_date', { ascending: true })
      .limit(500);
    if (eventError) return dbFailure('GET /api/clubs/events events', eventError);

    const events = searchClubEvents({
      events: asArray<Row>(eventRows).map(mapEventRow),
      clubsById,
      memberships,
      viewerContext: context,
      query: parseQuery(request),
    });

    return json({ data: events, count: events.length });
  } catch (error) {
    return dbFailure('GET /api/clubs/events', error);
  }
}
