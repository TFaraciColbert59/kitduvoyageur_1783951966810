import {
  buildHubCounts,
  getHubAdventureData,
  getHubTripStats,
} from '@/features/hub/server/getHubAdventureData';
import { getMaterielSummary } from '@/features/materiel/services/getMaterielSummary';
import { getGroupeMenuSummary } from '@/features/hub/server/getGroupeMenu';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';
import { SortieMenu } from '@/features/hub/components/menu/SortieMenu';
import { PossessionMenu } from '@/features/hub/components/menu/PossessionMenu';
import { CollectifMenu } from '@/features/hub/components/menu/CollectifMenu';
import { PhaseLiveView, PhaseRecountView } from '@/features/hub/components/menu/PhaseViews';
import { HubResumeBanner } from '@/features/hub/components/HubResumeBanner';

import { currentFeatureFlags } from '@/features/hub/server/featureFlags';
import { HubCampShell } from '@/features/hub/components/HubCampShell';

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

/**
 * Hub V4 — RACINE = MENU de cartes-onglets (remplace l'aperçu hero).
 * ?phase=live|recount → surfaces de phase (cockpit terrain / raconter).
 * Gated by hub_camp_v1: renders HubCampShell when flag is true.
 */
export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [flags, data, sp] = await Promise.all([
    currentFeatureFlags(),
    getHubAdventureData(),
    searchParams,
  ]);

  if (flags.hub_camp_v1) {
    return (
      <HubCampShell
        adventure={data.adventure}
        trip={data.trip}
        hiking={data.hiking}
        counts={buildHubCounts(data)}
        searchParams={sp}
      />
    );
  }

  const phase = typeof sp.phase === 'string' ? sp.phase : undefined;

  if (data.input.kind === 'sortie' && data.trip) {
    const stats = await getHubTripStats(data.trip.id);
    const phaseDetails = getTripPhaseDetails(data.trip);
    if (phase === 'live') {
      return (
        <PhaseLiveView
          trip={data.trip}
          stats={stats}
          dayIndex={phaseDetails.dayIndex}
          totalDays={phaseDetails.totalDays}
        />
      );
    }
    if (phase === 'recount') {
      return <PhaseRecountView trip={data.trip} />;
    }
    return (
      <div className="space-y-4">
        <HubResumeBanner adventure={data.adventure} />
        <SortieMenu
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
        <HubResumeBanner adventure={data.adventure} />
        <CollectifMenu summary={summary} linkedTripSlug={data.linkedTripSlug} />
      </div>
    );
  }

  const summary = await getMaterielSummary();
  return (
    <div className="space-y-4">
      <HubResumeBanner adventure={data.adventure} />
      <PossessionMenu summary={summary} />
    </div>
  );
}
