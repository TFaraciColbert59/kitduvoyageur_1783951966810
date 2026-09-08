import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchCrewBySlug } from '@/lib/queries-crews';
import { tripSectionHref } from '@/features/trips/registry/tripSectionRegistry';
import type { ActiveAdventureData } from '../../context/adventureSchema';
import type { HubCrewLite, HubGroupLite } from '../../server/getHubAdventureData';

export interface HubGroupeSectionProps {
  adventure: Extract<ActiveAdventureData, { nature: 'collectif' }>;
  groups: HubGroupLite[];
  crews: HubCrewLite[];
}

interface MemberRow {
  user_id: string;
  role: string;
  profile: { full_name: string | null; username: string | null } | null;
}

/**
 * H4.3 — Section groupe du hub (découpage groupes/page + equipages/[slug]).
 * Membres + rôles, voyages liés, CTA entrer dans le voyage.
 */
export async function HubGroupeSection({ adventure, groups, crews }: HubGroupeSectionProps) {
  if (adventure.kind === 'equipage') {
    const crew = crews.find((c) => c.id === adventure.id);
    const details = crew ? await fetchCrewBySlug(crew.slug).catch(() => null) : null;
    const members = details?.members ?? [];
    const trips = details?.trips ?? [];
    const linked = crew?.next_trip ?? null;
    return (
      <div className="space-y-4">
        <div className="glass p-4 rounded-[var(--lkv-radius-card)]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">Équipage</p>
          <p className="text-lg font-bold text-[var(--lkv-text-primary)] mt-1">{details?.name ?? crew?.name ?? adventure.title}</p>
          <p className="text-sm text-[var(--lkv-text-secondary)] mt-0.5">
            {members.length} membre(s)
            {trips.length > 0 ? ` · ${trips.length} voyage(s)` : ''}
          </p>
        </div>
        {linked && (
          <Link
            href={tripSectionHref(linked.slug, 'overview')}
            className="glass-capsule-btn primary inline-flex items-center gap-2 min-h-[44px] px-5"
          >
            <span>Entrer dans le voyage</span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        )}
        <div className="glass p-4 rounded-[var(--lkv-radius-card)]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)] mb-2">Membres</p>
          {members.length === 0 ? (
            <p className="text-sm text-[var(--lkv-text-secondary)]">Aucun membre visible.</p>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-2.5 min-h-[44px]">
                  <span className="w-8 h-8 rounded-full bg-[var(--lkv-primary)] text-white flex items-center justify-center text-xs font-bold shrink-0" aria-hidden="true">
                    {(m.profile?.full_name ?? m.profile?.username ?? '?').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-[var(--lkv-text-primary)] truncate">
                    {m.profile?.full_name ?? m.profile?.username ?? 'Membre'}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-secondary)]">{m.role}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {trips.length > 0 && (
          <div className="glass p-4 rounded-[var(--lkv-radius-card)]">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)] mb-2">Voyages liés</p>
            <ul className="space-y-1">
              {trips.map((t) => (
                <li key={t.id}>
                  <Link
                    href={tripSectionHref(t.slug, 'overview')}
                    className="flex items-center gap-2 min-h-[44px] text-sm font-semibold text-[var(--lkv-text-primary)]"
                  >
                    <span className="flex-1 truncate">{t.title}</span>
                    <ArrowUpRight size={14} className="text-[var(--lkv-text-muted)]" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // kind === 'groupe' — requêtes serveur (miroir groupes/page, server client).
  const supabase = await createClient();
  const group = groups.find((g) => g.id === adventure.id);
  let members: MemberRow[] = [];
  let linkedTrips: Array<{ id: string; slug: string; title: string }> = [];
  try {
    const { data: rows } = await supabase
      .from('group_members')
      .select('user_id, role, profile:user_profiles!group_members_user_id_fkey(full_name, username)')
      .eq('group_id', adventure.id)
      .eq('status', 'active')
      .order('joined_at', { ascending: true });
    members = ((rows ?? []) as unknown as MemberRow[]).map((r) => ({
      user_id: r.user_id,
      role: r.role,
      profile: Array.isArray(r.profile) ? (r.profile[0] ?? null) : r.profile,
    }));
    const { data: trips } = await supabase
      .from('trips')
      .select('id, slug, title')
      .eq('group_id', adventure.id)
      .order('start_date', { ascending: false })
      .limit(10);
    linkedTrips = (trips ?? []) as Array<{ id: string; slug: string; title: string }>;
  } catch {
    /* RLS ou erreur — listes vides, jamais de crash */
  }
  const firstLinked = linkedTrips[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="glass p-4 rounded-[var(--lkv-radius-card)]">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">Groupe</p>
        <p className="text-lg font-bold text-[var(--lkv-text-primary)] mt-1">{group?.name ?? adventure.title}</p>
        <p className="text-sm text-[var(--lkv-text-secondary)] mt-0.5">
          {members.length} membre(s)
          {group?.my_role ? ` · vous : ${group.my_role}` : ''}
          {linkedTrips.length > 0 ? ` · ${linkedTrips.length} voyage(s)` : ''}
        </p>
      </div>
      {firstLinked && (
        <Link
          href={tripSectionHref(firstLinked.slug, 'overview')}
          className="glass-capsule-btn primary inline-flex items-center gap-2 min-h-[44px] px-5"
        >
          <span>Entrer dans le voyage</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      )}
      <div className="glass p-4 rounded-[var(--lkv-radius-card)]">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)] mb-2">Membres</p>
        {members.length === 0 ? (
          <p className="text-sm text-[var(--lkv-text-secondary)]">Aucun membre visible.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-2.5 min-h-[44px]">
                <span className="w-8 h-8 rounded-full bg-[var(--lkv-primary)] text-white flex items-center justify-center text-xs font-bold shrink-0" aria-hidden="true">
                  {(m.profile?.full_name ?? m.profile?.username ?? '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="flex-1 text-sm font-semibold text-[var(--lkv-text-primary)] truncate">
                  {m.profile?.full_name ?? m.profile?.username ?? 'Membre'}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-secondary)]">{m.role}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {linkedTrips.length > 0 && (
        <div className="glass p-4 rounded-[var(--lkv-radius-card)]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)] mb-2">Voyages liés</p>
          <ul className="space-y-1">
            {linkedTrips.map((t) => (
              <li key={t.id}>
                <Link
                  href={tripSectionHref(t.slug, 'overview')}
                  className="flex items-center gap-2 min-h-[44px] text-sm font-semibold text-[var(--lkv-text-primary)]"
                >
                  <span className="flex-1 truncate">{t.title}</span>
                  <ArrowUpRight size={14} className="text-[var(--lkv-text-muted)]" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default HubGroupeSection;
