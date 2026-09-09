import { getHubAdventureData } from '@/features/hub/server/getHubAdventureData';
import { deriveHubProfile } from '@/features/hub/engine/hubProfileEngine';
import { HubOverviewPossession } from '@/features/hub/components/HubOverviewPossession';
import { HubOverviewSortie } from '@/features/hub/components/HubOverviewSortie';
import { HubOverviewCollectif } from '@/features/hub/components/HubOverviewCollectif';

export const metadata = {
  title: 'Hub — Le Kit du Voyageur',
  description: 'Votre aventure active : matériel, voyage et groupe au même endroit.',
};

/**
 * H3.4 — Aperçu de l'aventure active (jamais une liste d'abord).
 * Une seule vue par nature (1 h1 par fichier, H-D85 R9).
 */

function daysUntil(dateStr: string | null | undefined, now: number): number | null {
  if (!dateStr) return null;
  const t = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - now) / 86400000);
}

export default async function HubPage() {
  const data = await getHubAdventureData();
  const profile = deriveHubProfile(data.input, new Date());

  if (data.input.kind === 'sortie' && data.trip) {
    return (
      <HubOverviewSortie
        profile={profile}
        trip={data.trip}
        countdown={daysUntil(data.trip.start_date, Date.now())}
        group={data.group}
        hiking={data.hiking}
      />
    );
  }

  if (data.input.kind === 'collectif') {
    return (
      <HubOverviewCollectif
        groupLabel={data.groupLabel ?? 'Mon groupe'}
        members={data.input.membersCount}
        pendingInvites={data.pendingInvites}
        linkedTripSlug={data.linkedTripSlug}
      />
    );
  }

  return (
    <HubOverviewPossession
      items={data.possession.items}
      loans={data.possession.loans}
      alerts={data.possession.alerts}
    />
  );
}
