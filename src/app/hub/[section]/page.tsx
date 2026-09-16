import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getHubAdventureData, getHubTripStats } from '@/features/hub/server/getHubAdventureData';
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
import { loadTripSection } from '@/lib/tripSection';
import type { DatabaseTripChecklistItem } from '@/lib/supabase/types';
import { getTripKitDetails } from '@/lib/queries-trip-kit';
import { getTripItemImages } from '@/features/hub/server/getTripItemImages';
import { GearSection } from '@/features/hub/components/menu/GearSection';
import { calculateBudgetSummary } from '@/features/trips/engine/budgetEngine';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';
import type { PlannerStep } from '@/features/trips/planner/plannerEngine';
import { SectionLoading } from './sectionViews.client';
import { ItineraryPlannerClient } from './sectionViews.client';
import { ItineraryMobileExperience } from './sectionViews.client';
import { TripTeamView } from './sectionViews.client';
import { ParticipantsManager } from './sectionViews.client';
import { TeamMobileExperience } from './sectionViews.client';
import { ChecklistMobileExperience } from './sectionViews.client';
import { DocsMobileExperience } from './sectionViews.client';
import { SafetyMobileExperience } from './sectionViews.client';
import { JournalMobileExperience } from './sectionViews.client';
import { TripBudgetView } from './sectionViews.client';
import { TripDocumentsView } from './sectionViews.client';
import { TripChecklistView } from './sectionViews.client';
import { TripSafetyView } from './sectionViews.client';
import { TripNotesView } from './sectionViews.client';
import { TripExportView } from './sectionViews.client';
import { ExportMobileExperience } from './sectionViews.client';
import { HubGroupeCockpit } from './sectionViews.client';

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
  searchParams: Promise<{ id?: string; route?: string; onglet?: string; jour?: string }>;
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
        <SortieSection sectionId={def.id} slug={data.trip.slug} jour={sp.jour} />
      )}
    </div>
  );
}

/**
 * Étape 2 — Rendu des sections d'une sortie (voyage/randonnée) directement
 * dans le hub. Les vues clientes sont les mêmes que celles des anciennes
 * pages /voyages/[slug]/* (supprimées — shims de redirection).
 */
async function SortieSection({ sectionId, slug, jour }: { sectionId: string; slug: string; jour?: string }) {
  const trip = await loadTripSection(slug);
  const supabase = await createClient();

  switch (sectionId) {
    case 'itinerary': {
      // P2 (C-20) — un seul client, steps déjà chargés par loadTripSection
      // (getTripBySlug inclut trip_steps) : plus de refetch ni de shadowing.
      const initialSteps: PlannerStep[] = (trip.steps || []).map((s: any) => ({
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
        start_time: s.start_time ?? null,
        distance_km: s.distance_km ? Number(s.distance_km) : null,
        elevation_gain_m: s.elevation_gain_m ? Number(s.elevation_gain_m) : null,
        elevation_loss_m: s.elevation_loss_m ? Number(s.elevation_loss_m) : null,
      }));

      return (
        <>
          <div className="hidden lg:block">
            <ItineraryPlannerClient trip={trip} initialSteps={initialSteps} />
          </div>
          <div className="lg:hidden">
            <ItineraryMobileExperience trip={trip} initialSteps={initialSteps} />
          </div>
        </>
      );
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
      return (
        <TripBudgetView
          trip={trip}
          initialDay={jour && Number.isFinite(Number(jour)) ? Number(jour) : undefined}
        />
      );
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
      // P0-2 (C-06) — wrapper cache React partagé avec le layout : les 5
      // requêtes stats ne tournent qu'une fois par requête, jamais 2×.
      const stats = await getHubTripStats(trip.id);
      const budgetSummary = calculateBudgetSummary(
        { estimated_budget: trip.estimated_budget, budget_currency: trip.budget_currency },
        trip.expenses || [],
        trip.collaborators || []
      );
      return (
        <>
          <div className="hidden lg:block">
            <TripExportView trip={trip} stats={stats} budgetSummary={budgetSummary} />
          </div>
          <div className="lg:hidden">
            <ExportMobileExperience trip={trip} stats={stats} budgetSummary={budgetSummary} />
          </div>
        </>
      );
    }
    default:
      return null;
  }
}
