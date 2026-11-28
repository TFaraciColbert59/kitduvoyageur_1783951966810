import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui';
import { TripAffiliateProvider } from '@/features/affiliation/components/TripAffiliateProvider';
import { currentFeatureFlags } from '@/features/hub/server/featureFlags';
import { HubCampShell } from '@/features/hub/components/HubCampShell';
import {
  buildHubCounts,
  getHubAdventureData,
  getHubTripStats,
} from '@/features/hub/server/getHubAdventureData';
import { MenuBack } from '@/features/hub/components/menu/MenuBack';
import { hubSectionRegistry, isHubSectionServable } from '@/features/hub/registry/hubSectionRegistry';
import { HubInventaireSection } from '@/features/hub/components/possession/HubInventaireSection';
import { HubKitSection } from '@/features/hub/components/possession/HubKitSection';
import { HubDepartSection } from '@/features/hub/components/possession/HubDepartSection';
import { HubDisponibiliteSection } from '@/features/hub/components/possession/HubDisponibiliteSection';
import { HubAlertesSection } from '@/features/hub/components/possession/HubAlertesSection';
import { HubOublisSection } from '@/features/hub/components/possession/HubOublisSection';
import { HubInvitationsSection } from '@/features/hub/components/collectif/HubInvitationsSection';
import { HubVoyagesLiesSection } from '@/features/hub/components/collectif/HubVoyagesLiesSection';
import { loadTripSection } from '@/lib/tripSection';
import type { DatabaseTripChecklistItem } from '@/lib/supabase/types';
import { calculateBudgetSummary } from '@/features/trips/engine/budgetEngine';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';
import type { PlannerStep } from '@/features/trips/planner/plannerEngine';
import {
  ChecklistMobileExperience,
  ExportMobileExperience,
  HubGroupeCockpit,
  ItineraryMobileExperience,
  ItineraryPlannerClient,
  JournalMobileExperience,
  ParticipantsManager,
  SafetyMobileExperience,
  TeamMobileExperience,
  TripChecklistView,
  TripExportView,
  TripNotesView,
  TripSafetyView,
  TripTeamView,
} from './sectionViews.client';

/**
 * Étape 2 — Section active du hub (URL-driven, registre). LE rendu canonique :
 * les sections sortie sont composées ici (plus de délégation /voyages/*), la
 * section groupe est gérée in-hub (plus de renvoi vers /groupes). Nature
 * incompatible → 404 (hors hub_camp_v1 qui ouvre le tiroir correspondant).
 */
export default async function HubSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{
    product_id?: string;
    id?: string;
    groupId?: string;
    route?: string;
    onglet?: string;
    jour?: string;
    sub?: string;
  }>;
}) {
  const [{ section }, sp, flags] = await Promise.all([
    params,
    searchParams,
    process.env.LKDV_HUB_LAYOUT === 'legacy' ? currentFeatureFlags() : null,
  ]);

  const def = hubSectionRegistry.find((d) => d.segment === section);
  if (!def || def.id === 'gear' || def.id === 'budget' || def.id === 'docs') notFound();
  // Le Compas est le seul préparateur : l'ancien cockpit « Préparation »
  // (matériel, poids, essai du sac) vit désormais dans son étape Kit.
  if (def.id === 'preparation') redirect('/compas?etape=kit');

  const data = await getHubAdventureData();
  const explicitGroupId = sp.groupId?.trim() || undefined;
  const resolvedGroupId =
    def.id === 'groupe'
      ? explicitGroupId ?? (data.adventure.nature === 'collectif' ? data.adventure.id : undefined)
      : undefined;
  const canServeSection =
    isHubSectionServable(def, data.adventure.nature) || Boolean(resolvedGroupId);

  if (flags?.hub_camp_v1) {
    const serverSectionNode = canServeSection ? (
      <>
        {def.id === 'inventaire' && <HubInventaireSection productId={sp.product_id} />}
        {def.id === 'kit' && <HubKitSection />}
        {def.id === 'depart' && <HubDepartSection departId={sp.id} route={sp.route} />}
        {def.id === 'disponibilite' && <HubDisponibiliteSection />}
        {def.id === 'alertes' && <HubAlertesSection />}
        {def.id === 'oublis' && <HubOublisSection />}
        {def.id === 'invitations' && <HubInvitationsSection />}
        {def.id === 'voyages-lies' && data.adventure.nature === 'collectif' && (
          <HubVoyagesLiesSection adventure={data.adventure} />
        )}
        {resolvedGroupId && (
          <HubGroupeCockpit groupId={resolvedGroupId} initialTab={sp.onglet} />
        )}
        {data.adventure.nature === 'sortie' && data.trip && !resolvedGroupId && (
          <SortieSection sectionId={def.id} slug={data.trip.slug} jour={sp.jour} />
        )}
      </>
    ) : undefined;

    return (
      <HubCampShell
        initialDrawer={section}
        adventure={data.adventure}
        trip={data.trip}
        hiking={data.hiking}
        counts={buildHubCounts(data)}
        searchParams={sp}
        drawerContent={serverSectionNode}
      />
    );
  }

  if (!canServeSection) notFound();

  const content = (
    <div className="space-y-2.5">
      <PageHeader title={<span className="sr-only">{def.label}</span>} back={<MenuBack />} />
      {def.id === 'inventaire' && <HubInventaireSection productId={sp.product_id} />}
      {def.id === 'kit' && <HubKitSection />}
      {def.id === 'depart' && <HubDepartSection departId={sp.id} route={sp.route} />}
      {def.id === 'disponibilite' && <HubDisponibiliteSection />}
      {def.id === 'alertes' && <HubAlertesSection />}
      {def.id === 'oublis' && <HubOublisSection />}
      {def.id === 'invitations' && <HubInvitationsSection />}
      {def.id === 'voyages-lies' && data.adventure.nature === 'collectif' && (
        <HubVoyagesLiesSection adventure={data.adventure} />
      )}
      {resolvedGroupId && (
        <HubGroupeCockpit groupId={resolvedGroupId} initialTab={sp.onglet} />
      )}
      {data.adventure.nature === 'sortie' && data.trip && !resolvedGroupId && (
        <SortieSection sectionId={def.id} slug={data.trip.slug} jour={sp.jour} />
      )}
    </div>
  );
  if (flags) return content;
  return (
    <TripAffiliateProvider value={{ links: data.affiliateLinks, bookingByStepId: data.bookingByStepId }}>
      {content}
    </TripAffiliateProvider>
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
    case 'groupe':
      return (
        <>
          <div className="hidden lg:block space-y-4">
            <TripTeamView trip={trip} />
            <div aria-label="Carnet des participants">
              <ParticipantsManager />
            </div>
          </div>
          <div className="lg:hidden">
            <TeamMobileExperience trip={trip} />
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
