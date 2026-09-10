import { getHubAdventureData, buildHubCounts, getHubTripStats } from '@/features/hub/server/getHubAdventureData';
import { deriveHubProfile, type HubSectionId } from '@/features/hub/engine/hubProfileEngine';
import { HubShell } from '@/features/hub/components/HubShell';
import { LiquidGlassDefs } from '@/components/ui-layouts/liquid-glass';

// Hub auth/cookie-driven : jamais prerenderee statiquement au build.
export const dynamic = 'force-dynamic';

/**
 * H3.4 — Layout de segment du hub voyageur (miroir voyages/[slug]/layout).
 * Charge l'aventure active UNE fois (helper caché partagé), dérive le profil
 * et monte la coquille unique. Les pages du segment ne rendent que leur vue.
 */
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const data = await getHubAdventureData();
  const profile = deriveHubProfile(data.input, new Date());
  const counts = buildHubCounts(data);
  const tripStats = data.trip ? await getHubTripStats(data.trip.id) : null;

  const baseEnabled: HubSectionId[] =
    data.input.kind === 'sortie' ? (data.input.enabledSections ?? []) : [];

  return (
    <>
      <LiquidGlassDefs />
      <HubShell
        adventure={data.adventure}
        profile={profile}
        baseEnabled={baseEnabled}
        counts={counts}
        trip={data.trip}
        groupLabel={data.groupLabel}
        linkedTripSlug={data.linkedTripSlug}
        pendingInvites={data.pendingInvites}
        trips={data.trips}
        tripStats={tripStats}
      >
        {children}
      </HubShell>
    </>
  );
}
