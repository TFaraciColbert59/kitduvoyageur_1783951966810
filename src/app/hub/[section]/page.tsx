import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getHubAdventureData } from '@/features/hub/server/getHubAdventureData';
import { MenuBack } from '@/features/hub/components/menu/MenuBack';
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
import { HubGroupeCockpit } from '@/features/hub/components/collectif/HubGroupeCockpit';
import { loadTripSection } from '@/lib/tripSection';
import { getTripStats } from '@/lib/queries-trips';
import type { DatabaseTripChecklistItem } from '@/lib/supabase/types';
import { getTripKitDetails } from '@/lib/queries-trip-kit';
import { getTripItemImages } from '@/features/hub/server/getTripItemImages';
import { GearSection } from '@/features/hub/components/menu/GearSection';
import { calculateBudgetSummary } from '@/features/trips/engine/budgetEngine';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';
import ItineraryPlannerClient from '@/features/trips/planner/ItineraryPlannerClient';
import type { PlannerStep } from '@/features/trips/planner/plannerEngine';
import { TripTeamView } from '@/features/trips/components/TripTeamView';
import { ParticipantsManager } from '@/features/participants/components/ParticipantsManager';
import { TeamMobileExperience } from '@/features/hub/components/mobile/team/TeamMobileExperience';
import { ChecklistMobileExperience } from '@/features/hub/components/mobile/checklist/ChecklistMobileExperience';
import { DocsMobileExperience } from '@/features/hub/components/mobile/docs/DocsMobileExperience';
import { SafetyMobileExperience } from '@/features/hub/components/mobile/safety/SafetyMobileExperience';
import { JournalMobileExperience } from '@/features/hub/components/mobile/journal/JournalMobileExperience';
import { TripBudgetView } from '@/features/trips/components/TripBudgetView';
import { TripDocumentsView } from '@/features/trips/components/TripDocumentsView';
import { TripChecklistView } from '@/features/trips/components/TripChecklistView';
import { TripSafetyView } from '@/features/trips/components/TripSafetyView';
import { TripNotesView } from '@/features/trips/components/TripNotesView';
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
  searchParams: Promise<{ id?: string; route?: string; onglet?: string }>;
}) {
  const [{ section }, sp] = await Promise.all([params, searchParams]);
  const def = hubSectionRegistry.find((d) => d.segment === section);
  if (!def) notFound();

  const data = await getHubAdventureData();
  if (!def.natures.includes(data.adventure.nature)) notFound();

  return (
    <div className="space-y-2.5">
      <MenuBack />
      <h1 className="sr-only">{def.label}</h1>
      {def.id === 'inventaire' && <HubInventaireSection />}
      {def.id === 'kit' && <HubKitSection />}
      {def.id === 'preparation' && <HubPreparationSection />}
      {def.id === 'depart' && <HubDepartSection departId={sp.id} route={sp.route} />}
      {def.id === 'disponibilite' && <HubDisponibiliteSection />}
      {def.id === 'alertes' && <HubAlertesSection />}
      {def.id === 'oublis' && <HubOublisSection />}
      {def.id === 'invitations' && <HubInvitationsSection />}
      {def.id === 'voyages-lies' && data.adventure.nature === 'collectif' && (
        <HubVoyagesLiesSection adventure={data.adventure} />
      )}
      {data.adventure.nature === 'collectif' && def.id === 'groupe' && (
        <HubGroupeCockpit groupId={data.adventure.id} initialTab={sp.onglet} />
      )}
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
  const supabase = await createClient();

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
      const itemImages = await getTripItemImages(result.trip.id);
      return (
        <GearSection
          trip={result.trip}
          analysis={result.analysis}
          itemImages={itemImages}
          availableProducts={result.availableProducts}
        />
      );
    }
    case 'groupe':
      return (
        <>
          {/* Desktop : équipiers (comptes) + carnet local — inchangé */}
          <div className="hidden lg:block space-y-4">
            <TripTeamView trip={trip} />
            <div aria-label="Carnet des participants">
              <ParticipantsManager />
            </div>
          </div>
          {/* Mobile / tablette : expérience rails + tiroirs */}
          <div className="lg:hidden">
            <TeamMobileExperience trip={trip} />
          </div>
        </>
      );    case 'budget':
      if (!trip.permissions.canManageBudget) notFound();
      return <TripBudgetView trip={trip} />;
    case 'docs':
      if (!trip.permissions.canViewDocuments) notFound();
      return (
        <>
          <div className="hidden lg:block">
            <TripDocumentsView trip={trip} />
          </div>
          <div className="lg:hidden">
            <DocsMobileExperience trip={trip} />
          </div>
        </>
      );
    case 'checklist': {
      const phaseDetails = getTripPhaseDetails(trip);
      const { data: checklistRows } = await supabase
        .from('trip_checklist_items')
        .select('id, trip_id, label, due_offset_days, done, done_at, position, created_at, updated_at')
        .eq('trip_id', trip.id)
        .order('due_offset_days', { ascending: false })
        .order('position', { ascending: true });
      const checklistItems = (checklistRows ?? []) as DatabaseTripChecklistItem[];
      return (
        <>
          <div className="hidden lg:block">
            <TripChecklistView
              tripId={trip.id}
              daysUntilStart={phaseDetails.daysUntilStart}
              items={checklistItems}
            />
          </div>
          <div className="lg:hidden">
            <ChecklistMobileExperience
              tripId={trip.id}
              daysUntilStart={phaseDetails.daysUntilStart}
              items={checklistItems}
            />
          </div>
        </>
      );
    }
    case 'safety':
      return (
        <>
          <div className="hidden lg:block">
            <TripSafetyView trip={trip} />
          </div>
          <div className="lg:hidden">
            <SafetyMobileExperience trip={trip} />
          </div>
        </>
      );
    case 'journal':
      return (
        <>
          <div className="hidden lg:block">
            <TripNotesView trip={trip} />
          </div>
          <div className="lg:hidden">
            <JournalMobileExperience trip={trip} />
          </div>
        </>
      );
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
