import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { tripSwitchHref } from '@/features/trips/registry/tripSectionRegistry';
import type { ActiveAdventureData } from '../../context/adventureSchema';
import type { HubCrewLite } from '../../server/getHubAdventureData';

export interface HubVoyagesLiesSectionProps {
  adventure: Extract<ActiveAdventureData, { nature: 'collectif' }>;
  crews: HubCrewLite[];
}

/**
 * H4.3 — Section voyages liés du hub (groupe → trips par group_id ;
 * équipage → crew trips via next_trip + liste complète).
 */
export async function HubVoyagesLiesSection({ adventure, crews }: HubVoyagesLiesSectionProps) {
  let trips: Array<{ id: string; slug: string; title: string; start_date: string | null }> = [];

  if (adventure.kind === 'equipage') {
    const crew = crews.find((c) => c.id === adventure.id);
    if (crew) {
      try {
        const supabase = await createClient();
        const { data } = await supabase
          .from('trips')
          .select('id, slug, title, start_date')
          .eq('crew_id', adventure.id)
          .order('start_date', { ascending: true });
        trips = (data ?? []) as typeof trips;
      } catch {
        /* ignoré */
      }
    }
  } else {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from('trips')
        .select('id, slug, title, start_date')
        .eq('group_id', adventure.id)
        .order('start_date', { ascending: false });
      trips = (data ?? []) as typeof trips;
    } catch {
      /* ignoré */
    }
  }

  if (trips.length === 0) {
    return (
      <div className="glass p-4 rounded-[var(--lkv-radius-card)]">
        <p className="text-sm text-[var(--lkv-text-secondary)]">
          Aucun voyage lié pour le moment — il apparaîtra ici dès qu&apos;un voyage sera rattaché.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {trips.map((t) => (
        <li key={t.id}>
          <Link
            href={tripSwitchHref(t.slug)}
            className="glass p-4 rounded-[var(--lkv-radius-card)] flex items-center gap-3 min-h-[44px]"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-[var(--lkv-text-primary)] truncate">{t.title}</span>
              {t.start_date && (
                <span className="block text-[11px] font-mono text-[var(--lkv-text-secondary)]">
                  {new Date(`${t.start_date}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </span>
            <ArrowUpRight size={14} className="text-[var(--lkv-text-muted)] shrink-0" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default HubVoyagesLiesSection;
