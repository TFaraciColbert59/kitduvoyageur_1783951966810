import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchUserCrews } from '@/lib/queries-crews';

export const dynamic = 'force-dynamic';

/**
 * H2.2 — Aventures de l'utilisateur pour le sélecteur (`AdventureSwitcher`).
 * Léger : groupes (id, nom, membres, rôle), invitations en attente, équipages
 * (via fetchUserCrews, batch sans N+1), compteurs possession (items, prêts
 * actifs, alertes non résolues). Les VOYAGES viennent du contexte Y existant
 * (jamais re-fetchés ici). Ne renvoie AUCUNE donnée privée détaillée.
 * Non connecté → zéros/vides (jamais 401, miroir /api/voyages/mine).
 */
export async function GET() {
  const empty = {
    groups: [],
    pendingInvites: 0,
    crews: [],
    possession: { items: 0, loans: 0, alerts: 0 },
  };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(empty);
    }

    // ── Groupes (miroir src/app/groupes/page.tsx:92-113) ──
    let groups: Array<{ id: string; name: string; member_count: number; my_role: string | null }> = [];
    let pendingInvites = 0;
    try {
      const { data: memberData } = await supabase
        .from('group_members')
        .select('group_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active');
      if (memberData?.length) {
        const groupIds = memberData.map((m) => (m as { group_id: string }).group_id);
        const { data: rows } = await supabase
          .from('travel_groups')
          .select('id, name')
          .in('id', groupIds)
          .order('created_at', { ascending: false });
        groups = await Promise.all(
          ((rows ?? []) as Array<{ id: string; name: string }>).map(async (g) => {
            const { count } = await supabase
              .from('group_members')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', g.id)
              .eq('status', 'active');
            return {
              ...g,
              member_count: count ?? 0,
              my_role: (memberData.find((m) => (m as { group_id: string }).group_id === g.id) as { role: string } | undefined)?.role ?? null,
            };
          }),
        );
      }
      const { count: invites } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending');
      pendingInvites = invites ?? 0;
    } catch (err) {
      console.error('[LKDV hub/adventures] groups error:', err);
    }

    // ── Équipages (composition fetchUserCrews, batch sans N+1) ──
    let crews: Array<{
      id: string;
      name: string;
      slug: string;
      member_count: number;
      active_trips_count: number;
      next_trip: { slug: string; title: string } | null;
    }> = [];
    try {
      crews = (await fetchUserCrews(user.id)).map((c) => ({
        id: c.id,
        name: (c as { name: string }).name,
        slug: (c as { slug: string }).slug,
        member_count: c.member_count,
        active_trips_count: c.active_trips_count ?? 0,
        next_trip: c.next_trip ? { slug: c.next_trip.slug, title: c.next_trip.title } : null,
      }));
    } catch (err) {
      console.error('[LKDV hub/adventures] crews error:', err);
    }

    // ── Possession (miroir getMaterielSummary.ts:115-118, compteurs seuls) ──
    let possession = { items: 0, loans: 0, alerts: 0 };
    try {
      const [{ count: items }, { count: alerts }, { count: loans }] = await Promise.all([
        supabase.from('product_ownership').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_resolved', false),
        supabase.from('materiel_loans').select('*', { count: 'exact', head: true }).eq('lender_id', user.id).neq('status', 'rendu'),
      ]);
      possession = { items: items ?? 0, loans: loans ?? 0, alerts: alerts ?? 0 };
    } catch (err) {
      console.error('[LKDV hub/adventures] possession error:', err);
    }

    return NextResponse.json({ groups, pendingInvites, crews, possession });
  } catch (err: unknown) {
    return NextResponse.json({ ...empty, error: err instanceof Error ? err.message : 'unknown' });
  }
}
