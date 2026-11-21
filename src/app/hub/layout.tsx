import '@/styles/communaute-v2.css';
import '@/styles/communaute-v2-shell.css';
import { Suspense } from 'react';
import { getHubAdventureData, buildHubCounts, getHubTripStats } from '@/features/hub/server/getHubAdventureData';
import { getAdventureIntelligence } from '@/features/hub/server/getAdventureIntelligence';
import { deriveHubProfile, type HubSectionId } from '@/features/hub/engine/hubProfileEngine';
import { currentFeatureFlags } from '@/features/hub/server/featureFlags';
import { TripAffiliateProvider } from '@/features/affiliation/components/TripAffiliateProvider';
import {
  DynamicAdventureIntelligenceHub,
  DynamicHubShell,
  DynamicItineraryAdventureCockpit,
} from '@/features/hub/components/LegacyHubClient';
import { traceStage } from '@/lib/perf/ssrTrace';
import RouteLoading from '@/components/shell/RouteLoading';

// Hub auth/cookie-driven : jamais prerenderee statiquement au build.
export const dynamic = 'force-dynamic';

/**
 * H3.4 — Layout de segment du hub voyageur (miroir voyages/[slug]/layout).
 * P0-3 (Loi 1) — le shell HTML part immédiatement : RouteLoading
 * est envoyé comme fallback du <Suspense>, puis le hub
 * complet (nav + contenu) streame dès que la cascade serveur est terminée.
 * L'attente n'est plus un écran mort.
 */
export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<RouteLoading label="Chargement de l’aventure…" />}>
      {process.env.LKDV_HUB_LAYOUT === 'legacy' ? <HubLayoutAsync>{children}</HubLayoutAsync> : children}
    </Suspense>
  );
}

async function HubLayoutAsync({ children }: { children: React.ReactNode }) {
  const [flags, data] = await Promise.all([
    currentFeatureFlags(),
    traceStage('layout.adventure', () => getHubAdventureData()),
  ]);

  if (flags.hub_camp_v1) {
    return (
      <TripAffiliateProvider
        value={{ links: data.affiliateLinks, bookingByStepId: data.bookingByStepId }}
      >
        {children}
      </TripAffiliateProvider>
    );
  }

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
      <DynamicHubShell
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
            <DynamicAdventureIntelligenceHub
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
            <DynamicItineraryAdventureCockpit
              key="itinerary-adventure-cockpit"
              cockpit={intelligence.cockpit}
              sections={intelligence.sections}
              sectionHrefs={intelligence.sectionHrefs}
            />
          ) : null
        }
      >
        {children}
      </DynamicHubShell>
    </TripAffiliateProvider>
  );
}
