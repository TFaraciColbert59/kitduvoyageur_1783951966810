import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { Card, EmptyState, ListItem } from '@/components/ui';
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
      <Card>
        <EmptyState compact title="Aucun voyage lié." />
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {trips.map((t) => (
        <li key={t.id}>
          <Link href={tripSwitchHref(t.slug)} className="block">
            <ListItem
              as="div"
              title={t.title}
              subtitle={
                t.start_date
                  ? new Date(`${t.start_date}T00:00:00Z`).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : undefined
              }
              trailing={
                <Icon
                  name="arrow-up-right"
                  size={14}
                  className="text-[var(--lkv-text-muted)]"
                  aria-hidden="true"
                />
              }
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default HubVoyagesLiesSection;
