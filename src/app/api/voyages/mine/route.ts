import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Y3.3 — Liste des voyages de l'utilisateur connecté pour le sélecteur
 * (`ActiveTripSwitcher`). Léger : id, slug, titre, statut, activité, dates.
 * Inclut les voyages dont il est owner OU collaborateur (peut/read).
 * Ne renvoie AUCUNE donnée privée (documents, dépenses, identités).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ trips: [] });
    }

    // Voyages dont l'utilisateur est owner ou collaborateur (can_read_trip).
    const { data: collabRows } = await supabase
      .from('trip_collaborators')
      .select('trip_id')
      .eq('user_id', user.id);

    let ownedOrCollabIn: string[] = [];
    if (collabRows && collabRows.length > 0) {
      ownedOrCollabIn = collabRows.map((r) => (r as { trip_id: string }).trip_id);
    }

    let query = supabase
      .from('trips')
      .select('id, slug, title, status, primary_activity, start_date, end_date, "group_id"')
      .order('start_date', { ascending: false, nullsFirst: true })
      .limit(100);

    if (ownedOrCollabIn.length > 0) {
      query = query.or(`user_id.eq.${user.id},id.in.(${ownedOrCollabIn.join(',')})`);
    } else {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[LKDV trips/mine] error:', error);
      return NextResponse.json({ trips: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trips: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
