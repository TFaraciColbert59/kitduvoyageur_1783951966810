import { Suspense } from 'react';
import { getHubAdventureData, buildHubCounts, getHubTripStats } from '@/features/hub/server/getHubAdventureData';
import { getAdventureIntelligence } from '@/features/hub/server/getAdventureIntelligence';
import { deriveHubProfile, type HubSectionId } from '@/features/hub/engine/hubProfileEngine';
import { HubShell } from '@/features/hub/components/HubShell';
import { AdventureIntelligenceHub } from '@/features/adventure-intelligence/ui';
import { ItineraryAdventureCockpit } from '@/features/hub/components/mobile/itinerary/ItineraryAdventureCockpit';
import { LiquidGlassDefs } from '@/components/ui-layouts/liquid-glass';
import { TripAffiliateProvider } from '@/features/affiliation/components/TripAffiliateProvider';
import { traceStage } from '@/lib/perf/ssrTrace';
import HubLoading from './loading';

// Hub auth/cookie-driven : jamais prerenderee statiquement au build.
export const dynamic = 'force-dynamic';

/**
 * H3.4 — Layout de segment du hub voyageur (miroir voyages/[slug]/layout).
 * P0-3 (Loi 1) — le shell HTML part immédiatement : le squelette BENTO
 * (hub/loading.tsx) est envoyé comme fallback du <Suspense>, puis le hub
 * complet (nav + contenu) streame dès que la cascade serveur est terminée.
 * L'attente n'est plus un écran mort.
 */
export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LiquidGlassDefs />
      <Suspense fallback={<HubLoading />}>
        <HubLayoutAsync>{children}</HubLayoutAsync>
      </Suspense>
    </>
  );
}

async function HubLayoutAsync({ children }: { children: React.ReactNode }) {
  const data = await traceStage('layout.adventure', () => getHubAdventureData());
  // Données décoratives : jamais bloquantes pour le rendu du hub (un incident
  // sur l'intelligence ou les stats ne doit pas blanchir la page).
  const intelligence = await traceStage('layout.intelligence', () =>
    getAdventureIntelligence().catch((error) => {
      console.error('[HubLayout] intelligence indisponible:', error);
      return null;
    }),
  );
  const profile = deriveHubProfile(data.input, new Date());
  const counts = buildHubCounts(data);
  const tripStats = data.trip
    ? await traceStage('layout.stats', () =>
        getHubTripStats(data.trip!.id).catch((error) => {
          console.error('[HubLayout] stats du voyage indisponibles:', error);
          return null;
        }),
      )
    : null;

  const baseEnabled: HubSectionId[] =
    data.input.kind === 'sortie' ? (data.input.enabledSections ?? []) : [];

  return (
    <TripAffiliateProvider
      value={{ links: data.affiliateLinks, bookingByStepId: data.bookingByStepId }}
    >
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
        adventureIntelligence={
          intelligence ? (
            <AdventureIntelligenceHub
              key="adventure-intelligence"
              cockpit={intelligence.cockpit}
              sections={intelligence.sections}
              sectionHrefs={intelligence.sectionHrefs}
              terrainEnabled={intelligence.terrainEnabled}
              terrainReports={intelligence.terrainReports}
            />
          ) : null
        }
        itineraryAdventureCockpit={
          intelligence && data.adventure.nature === 'sortie' ? (
            <ItineraryAdventureCockpit
              key="itinerary-adventure-cockpit"
              cockpit={intelligence.cockpit}
              sections={intelligence.sections}
              sectionHrefs={intelligence.sectionHrefs}
            />
          ) : null
        }
      >
        {children}
      </HubShell>
    </TripAffiliateProvider>
  );
}
