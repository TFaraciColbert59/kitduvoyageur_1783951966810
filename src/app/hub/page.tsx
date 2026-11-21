import {
  buildHubCounts,
  getHubAdventureData,
  getHubCockpitAdventureData,
  getHubTripStats,
} from '@/features/hub/server/getHubAdventureData';
import { getMaterielSummary } from '@/features/materiel/services/getMaterielSummary';
import { getGroupeMenuSummary } from '@/features/hub/server/getGroupeMenu';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';
import { currentFeatureFlags } from '@/features/hub/server/featureFlags';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStudioData } from '@/features/kit-studio/server/getStudioData';
import { resolveStudioPageState } from '@/features/kit-studio/server/studioMode';
import { loadCockpit } from '@/features/hub/cockpit/loadCockpit';
import { HubCockpit } from '@/features/hub/cockpit/HubCockpit';
import { AdventureSwitcher } from '@/features/hub/components/AdventureSwitcher';
import { TripAffiliateProvider } from '@/features/affiliation/components/TripAffiliateProvider';
import {
  DynamicCollectifMenu,
  DynamicHubCampShell,
  DynamicHubResumeBanner,
  DynamicPhaseLiveView,
  DynamicPhaseRecountView,
  DynamicPossessionMenu,
  DynamicSortieMenu,
} from '@/features/hub/components/LegacyHubClient';

export const metadata = {
  title: 'Hub — Le Kit du Voyageur',
  description: 'Votre aventure active : matériel, voyage et groupe au même endroit.',
};

function daysUntil(dateStr: string | null | undefined, now: number): number | null {
  if (!dateStr) return null;
  const t = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - now) / 86400000);
}

/** Cockpit du voyage actif. Les anciens liens directs vers les phases restent disponibles. */
export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const phase = typeof sp.phase === 'string' ? sp.phase : undefined;

  if (process.env.LKDV_HUB_LAYOUT !== 'legacy') {
    if (sp.studio === '1' || sp.studio === 'true') {
      redirect(sp.debug === '1' ? '/kit-studio?debug=1' : '/kit-studio');
    }
    const isDetail = phase === 'live' || phase === 'recount';
    const data = await (isDetail ? getHubAdventureData() : getHubCockpitAdventureData());
    if (data.trip && phase === 'live') {
      const stats = await getHubTripStats(data.trip.id);
      const details = getTripPhaseDetails(data.trip);
      return (
        <TripAffiliateProvider value={{ links: data.affiliateLinks, bookingByStepId: data.bookingByStepId }}>
          <DynamicPhaseLiveView trip={data.trip} stats={stats} dayIndex={details.dayIndex} totalDays={details.totalDays} />
        </TripAffiliateProvider>
      );
    }
    if (data.trip && phase === 'recount') {
      return <DynamicPhaseRecountView trip={data.trip} />;
    }

    const cockpit = await loadCockpit(data);
    return (
      <HubCockpit
        key={cockpit.key}
        data={cockpit}
        adventureControl={<AdventureSwitcher variant="dock" />}
      />
    );
  }

  const [flags, data] = await Promise.all([currentFeatureFlags(), getHubAdventureData()]);

  if (flags.hub_camp_v1) {
    // P3 : le studio du hub est le studio survivant. Sa donnée réelle est lue ici, côté
    // serveur (jamais de requête de données dans un Client Component), avec la même règle
    // de production que /kit-studio : ?debug=1 explicite, sinon session + données réelles.
    const studioState = await resolveStudioPageState({
      debug: sp.debug,
      next: '/hub?studio=1',
      getUser: async () => {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        return user ? { id: user.id } : null;
      },
      getData: async (userId) => {
        const supabase = await createClient();
        return getStudioData(userId, undefined, supabase);
      },
    });
    const studioFlag = Array.isArray(sp.studio) ? sp.studio[0] : sp.studio;
    const wantsStudio = studioFlag === '1' || studioFlag === 'true';
    // Entrée directe par /hub?studio=1 sans session : même décision que P1 (redirection
    // vers la connexion avec retour), jamais de démonstration implicite.
    if (wantsStudio && studioState.kind === 'login') {
      redirect(`/connexion?next=${encodeURIComponent(studioState.next)}`);
    }

    return (
      <DynamicHubCampShell
        adventure={data.adventure}
        trip={data.trip}
        hiking={data.hiking}
        counts={buildHubCounts(data)}
        searchParams={sp}
        studioState={studioState}
      />
    );
  }

  if (data.input.kind === 'sortie' && data.trip) {
    const stats = await getHubTripStats(data.trip.id);
    const phaseDetails = getTripPhaseDetails(data.trip);
    if (phase === 'live') {
      return (
        <DynamicPhaseLiveView
          trip={data.trip}
          stats={stats}
          dayIndex={phaseDetails.dayIndex}
          totalDays={phaseDetails.totalDays}
        />
      );
    }
    if (phase === 'recount') {
      return <DynamicPhaseRecountView trip={data.trip} />;
    }
    return (
      <div className="space-y-4">
        <DynamicHubResumeBanner adventure={data.adventure} />
        <DynamicSortieMenu
          trip={data.trip}
          stats={stats}
          pendingInvites={data.pendingInvites}
          daysUntil={daysUntil(data.trip.start_date, Date.now())}
          phase={phaseDetails.phase}
          hiking={data.hiking}
          checklist={data.checklist}
          itemImages={data.itemImages}
          dayIndex={phaseDetails.dayIndex}
          preparation={data.preparation}
        />
      </div>
    );
  }

  if (data.input.kind === 'collectif' && data.adventure.nature === 'collectif') {
    const summary = await getGroupeMenuSummary(data.adventure.id);
    return (
      <div className="space-y-4">
        <DynamicHubResumeBanner adventure={data.adventure} />
        <DynamicCollectifMenu summary={summary} linkedTripSlug={data.linkedTripSlug} />
      </div>
    );
  }

  const summary = await getMaterielSummary();
  return (
    <div className="space-y-4">
      <DynamicHubResumeBanner adventure={data.adventure} />
      <DynamicPossessionMenu summary={summary} />
    </div>
  );
}
