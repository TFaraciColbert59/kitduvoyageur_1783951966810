import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getHubAdventureData, buildHubCounts } from '@/features/hub/server/getHubAdventureData';
import { hubSectionRegistry } from '@/features/hub/registry/hubSectionRegistry';
import { HubInventaireSection } from '@/features/hub/components/possession/HubInventaireSection';
import { HubKitSection } from '@/features/hub/components/possession/HubKitSection';
import { HubPreparationSection } from '@/features/hub/components/possession/HubPreparationSection';
import { HubDepartSection } from '@/features/hub/components/possession/HubDepartSection';
import { HubDisponibiliteSection } from '@/features/hub/components/possession/HubDisponibiliteSection';
import { HubAlertesSection } from '@/features/hub/components/possession/HubAlertesSection';
import { HubOublisSection } from '@/features/hub/components/possession/HubOublisSection';
import { HubInvitationsSection } from '@/features/hub/components/collectif/HubInvitationsSection';
import { HubVoyagesLiesSection } from '@/features/hub/components/collectif/HubVoyagesLiesSection';
import { HubGroupeSection } from '@/features/hub/components/collectif/HubGroupeSection';
import { loadTripSection } from '@/lib/tripSection';
import { getTripStats } from '@/lib/queries-trips';
import { getTripKitDetails } from '@/lib/queries-trip-kit';
import { calculateBudgetSummary } from '@/features/trips/engine/budgetEngine';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';
import { getTripDurationDays } from '@/features/trips/engine/contextualKitEngine';
import ItineraryPlannerClient from '@/features/trips/planner/ItineraryPlannerClient';
import type { PlannerStep } from '@/features/trips/planner/plannerEngine';
import { TripTeamView } from '@/features/trips/components/TripTeamView';
import { TripBudgetView } from '@/features/trips/components/TripBudgetView';
import { TripDocumentsView } from '@/features/trips/components/TripDocumentsView';
import { TripChecklistView } from '@/features/trips/components/TripChecklistView';
import { TripSafetyView } from '@/features/trips/components/TripSafetyView';
import { TripNotesView } from '@/features/trips/components/TripNotesView';
import { TripKitView } from '@/features/trips/components/TripKitView';
import TripExportView from '@/features/trips/components/TripExportView';

/**
 * Étape 2 — Section active du hub (URL-driven, registre). LE rendu canonique :
 * les sections sortie sont composées ici (plus de délégation /voyages/*), la
 * section groupe est gérée in-hub (plus de renvoi vers /groupes). Nature
 * incompatible → 404.
 */
export default async function HubSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ id?: string; route?: string }>;
}) {
  const [{ section }, sp] = await Promise.all([params, searchParams]);
  const def = hubSectionRegistry.find((d) => d.segment === section);
  if (!def) notFound();

  const data = await getHubAdventureData();
  if (!def.natures.includes(data.adventure.nature)) notFound();

  const counts = buildHubCounts(data);
  const count = def.counter(counts);
  const Icon = def.icon;

  return (
    <div className="space-y-4">
      <Link
        href="/hub"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] min-h-[44px]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Aperçu
      </Link>
      <header className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-[var(--lkv-primary)] text-white flex items-center justify-center shrink-0">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--lkv-text-primary)]">
            {def.label}
          </h1>
          {count !== null && (
            <p className="text-sm text-[var(--lkv-text-secondary)]">
              {count} élément(s)
            </p>
          )}
        </div>
      </header>
      {def.id === 'inventaire' && <HubInventaireSection />}
      {def.id === 'kit' && <HubKitSection />}
      {def.id === 'preparation' && <HubPreparationSection />}
      {def.id === 'depart' && <HubDepartSection departId={sp.id} route={sp.route} />}
      {def.id === 'disponibilite' && <HubDisponibiliteSection />}
      {def.id === 'alertes' && <HubAlertesSection />}
      {def.id === 'oublis' && <HubOublisSection />}
      {def.id === 'invitations' && <HubInvitationsSection />}
      {def.id === 'voyages-lies' && data.adventure.nature === 'collectif' && (
        <HubVoyagesLiesSection adventure={data.adventure} crews={data.crews} />
      )}
      {(def.id === 'groupe' || (def.id === 'team' && data.adventure.nature === 'collectif')) &&
        data.adventure.nature === 'collectif' && <HubGroupeSection adventure={data.adventure} />}
      {data.adventure.nature === 'sortie' && data.trip && (
        <SortieSection sectionId={def.id} slug={data.trip.slug} />
      )}
    </div>
  );
}

/**
 * Étape 2 — Rendu des sections d'une sortie (voyage/randonnée) directement
 * dans le hub. Les vues clientes sont les mêmes que celles des anciennes
 * pages /voyages/[slug]/* (supprimées — shims de redirection).
 */
async function SortieSection({ sectionId, slug }: { sectionId: string; slug: string }) {
  const trip = await loadTripSection(slug);

  switch (sectionId) {
    case 'itinerary': {
      const supabase = await createClient();
      const { data: rawSteps } = await supabase
        .from('trip_steps')
        .select('*')
        .eq('trip_id', trip.id)
        .order('day_number', { ascending: true })
        .order('order_index', { ascending: true });

      const initialSteps: PlannerStep[] = (rawSteps || []).map((s: any) => ({
        id: s.id,
        trip_id: s.trip_id,
        day_number: s.day_number,
        order_index: s.order_index,
        title: s.title,
        description: s.description,
        location_name: s.location_name,
        latitude: s.latitude ? Number(s.latitude) : null,
        longitude: s.longitude ? Number(s.longitude) : null,
        accommodation_name: s.accommodation_name,
        transport_mode: s.transport_mode,
        distance_km: s.distance_km ? Number(s.distance_km) : null,
        elevation_gain_m: s.elevation_gain_m ? Number(s.elevation_gain_m) : null,
        elevation_loss_m: s.elevation_loss_m ? Number(s.elevation_loss_m) : null,
      }));

      return <ItineraryPlannerClient trip={trip} initialSteps={initialSteps} />;
    }
    case 'gear': {
      const result = await getTripKitDetails(slug);
      if (!result) notFound();
      const { analysis } = result;
      return (
        <div className="space-y-4">
          <div className="mb-2">
            <div className="flex items-center gap-2 text-[var(--lkv-text-secondary)] text-xs font-bold uppercase tracking-wider mb-1">
              Kit &amp; Sac à dos
            </div>
            <p className="text-xs sm:text-sm text-[var(--lkv-text-secondary)]">
              Recommandations contextuelles basées sur le climat, l’altitude ({analysis.maxAltitudeM}m) et la durée ({getTripDurationDays(trip)}j).
            </p>
          </div>
          <TripKitView trip={trip} analysis={analysis} showBackLink={false} />
        </div>
      );
    }
    case 'team':
      return <TripTeamView trip={trip} />;
    case 'budget':
      if (!trip.permissions.canManageBudget) notFound();
      return <TripBudgetView trip={trip} />;
    case 'docs':
      if (!trip.permissions.canViewDocuments) notFound();
      return <TripDocumentsView trip={trip} />;
    case 'checklist': {
      const phaseDetails = getTripPhaseDetails(trip);
      return <TripChecklistView tripId={trip.id} daysUntilStart={phaseDetails.daysUntilStart} />;
    }
    case 'safety':
      return <TripSafetyView trip={trip} />;
    case 'journal':
      return <TripNotesView trip={trip} />;
    case 'export': {
      const stats = await getTripStats(trip.id);
      const budgetSummary = calculateBudgetSummary(
        { estimated_budget: trip.estimated_budget, budget_currency: trip.budget_currency },
        trip.expenses || [],
        trip.collaborators || []
      );
      return <TripExportView trip={trip} stats={stats} budgetSummary={budgetSummary} />;
    }
    default:
      return null;
  }
}
