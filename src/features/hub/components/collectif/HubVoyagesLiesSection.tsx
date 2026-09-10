import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/server';
import { tripSwitchHref } from '@/features/trips/registry/tripSectionRegistry';
import type { ActiveAdventureData } from '../../context/adventureSchema';

export interface HubVoyagesLiesSectionProps {
  adventure: Extract<ActiveAdventureData, { nature: 'collectif' }>;
}

/**
 * H4.3 — Section voyages liés du hub (trips rattachés au groupe par group_id).
 */
export async function HubVoyagesLiesSection({ adventure }: HubVoyagesLiesSectionProps) {
  let trips: Array<{ id: string; slug: string; title: string; start_date: string | null }> = [];

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

  if (trips.length === 0) {
    return (
      <div className="glass p-4 rounded-[var(--lkv-radius-card)]">
        <p className="text-sm text-[var(--lkv-text-secondary)]">Aucun voyage lié.</p>
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
              <span className="block text-sm font-bold text-[var(--lkv-text-primary)] truncate">
                {t.title}
              </span>
              {t.start_date && (
                <span className="block text-[11px] font-medium tabular-nums text-[var(--lkv-text-secondary)]">
                  {new Date(`${t.start_date}T00:00:00Z`).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              )}
            </span>
            <Icon
              name="arrow-up-right"
              size={14}
              className="text-[var(--lkv-text-muted)] shrink-0"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default HubVoyagesLiesSection;
