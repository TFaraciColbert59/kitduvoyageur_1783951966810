import { getHubAdventureData } from '@/features/hub/server/getHubAdventureData';
import { getTripStats } from '@/lib/queries-trips';
import { getMaterielSummary } from '@/features/materiel/services/getMaterielSummary';
import { getGroupeMenuSummary } from '@/features/hub/server/getGroupeMenu';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';
import { SortieMenu } from '@/features/hub/components/menu/SortieMenu';
import { PossessionMenu } from '@/features/hub/components/menu/PossessionMenu';
import { CollectifMenu } from '@/features/hub/components/menu/CollectifMenu';
import { PhaseLiveView, PhaseRecountView } from '@/features/hub/components/menu/PhaseViews';

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
 */
export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<{ phase?: string }>;
}) {
  const { phase } = await searchParams;
  const data = await getHubAdventureData();

  if (data.input.kind === 'sortie' && data.trip) {
    const stats = await getTripStats(data.trip.id);
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
      <SortieMenu
        trip={data.trip}
        stats={stats}
        crew={data.group}
        pendingInvites={data.pendingInvites}
        daysUntil={daysUntil(data.trip.start_date, Date.now())}
        phase={phaseDetails.phase}
        hiking={data.hiking}
      />
    );
  }

  if (data.input.kind === 'collectif' && data.adventure.nature === 'collectif') {
    const summary = await getGroupeMenuSummary(data.adventure.id, data.adventure.kind);
    return <CollectifMenu summary={summary} linkedTripSlug={data.linkedTripSlug} />;
  }

  const summary = await getMaterielSummary();
  return <PossessionMenu summary={summary} />;
}