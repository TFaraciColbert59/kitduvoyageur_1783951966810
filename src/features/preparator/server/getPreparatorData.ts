import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getHubAdventureData } from '@/features/hub/server/getHubAdventureData';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';
import type { PlannerStep } from '@/features/trips/planner/plannerEngine';
import type { TripFull } from '@/features/trips/types/trip.types';
import type { DatabaseTripChecklistItem } from '@/lib/supabase/types';
import {
  resolveBookingByPoiId,
  type ResolvedStepBookingLink,
} from '@/features/affiliation/engine/stepBookingLink';
import {
  buildPreparatorModel,
  routeCoordsFromSteps,
  type PreparatorModel,
} from '../engine/preparatorModel';
import {
  rankActivityCatalog,
  logisticsVoletsFor,
  type ActivityCatalogItem,
  type ActivityLogisticsScope,
  type LogisticsVolets,
} from '../engine/activityCatalog';
import {
  getActivePromotion,
  type PromotionOutcome,
} from '@/features/promotions/server/promotionService';

/**
 * Préparateur de voyage — chargeur serveur UNIQUE de /prepare.
 *
 * Une seule source de vérité : l'aventure active déjà chargée par le hub
 * (getHubAdventureData, elle-même cachée par React `cache`). Le préparateur
 * n'interroge pas Supabase pour le voyage : il dérive le modèle, résout les
 * intentions de réservation (étapes ET POI) et charge uniquement ce que le hub
 * ne charge pas encore — la check-list complète.
 *
 * Aucune donnée n'est inventée : sans voyage actif, on renvoie `null` et la
 * route redirige vers la création.
 */

export interface PreparatorData {
  trip: TripFull;
  model: PreparatorModel;
  /** Géométrie GeoJSON réelle du parcours (jamais synthétisée). */
  routeGeojson: Record<string, unknown> | null;
  /** Trace de repli depuis les étapes géolocalisées. */
  routeCoords: Array<[number, number]>;
  checklist: DatabaseTripChecklistItem[];
  daysUntilStart: number | null;
  plannerSteps: PlannerStep[];
  bookingByStepId: Record<string, ResolvedStepBookingLink>;
  bookingByPoiId: Record<string, ResolvedStepBookingLink>;
  /** Formats d'activité publiés, filtrés pour le voyage actif. */
  activityCatalog: ActivityCatalogItem[];
  /**
   * Volets de logistique du MEILLEUR format propose pour ce voyage. Un
   * catalogue vide ne doit pas ouvrir de volet : tout est alors desactive,
   * jamais « plein » par defaut.
   */
  logisticsVolets: LogisticsVolets;
  /**
   * Version de modèle publiée par l'apprentissage collectif (P5). `null` quand
   * aucune promotion n'est publiée ou quand la table est absente : le
   * préparateur affiche alors le modèle courant sans annoncer de version.
   */
  activeModel: PromotionOutcome | null;
  canEdit: boolean;
  canManageBudget: boolean;
}

function toPlannerSteps(trip: TripFull): PlannerStep[] {
  return (trip.steps ?? []).map((step) => ({
    id: step.id,
    trip_id: step.trip_id,
    day_number: Number(step.day_number) || 1,
    order_index: Number(step.order_index) || 0,
    title: step.title,
    description: step.description,
    location_name: step.location_name,
    latitude: step.latitude != null ? Number(step.latitude) : null,
    longitude: step.longitude != null ? Number(step.longitude) : null,
    accommodation_name: step.accommodation_name,
    transport_mode: step.transport_mode,
    start_time: step.start_time ?? null,
    distance_km: step.distance_km != null ? Number(step.distance_km) : null,
    elevation_gain_m: step.elevation_gain_m != null ? Number(step.elevation_gain_m) : null,
    elevation_loss_m: step.elevation_loss_m != null ? Number(step.elevation_loss_m) : null,
  }));
}

export async function getPreparatorData(): Promise<PreparatorData | null> {
  const data = await getHubAdventureData();
  const trip = data.trip;
  if (!trip) return null;

  const model = buildPreparatorModel({
    trip,
    hasRouteGeometry: Boolean(data.hiking?.routeGeojson),
  });

  const destinationName = trip.destination_name ?? '';
  const context = {
    destinationName,
    startDate: trip.start_date ?? null,
    endDate: trip.end_date ?? null,
  };

  const bookingByPoiId = resolveBookingByPoiId(
    (trip.pois ?? []).map((poi) => ({
      id: poi.id,
      name: poi.name,
      category: poi.category,
      latitude: poi.latitude != null ? Number(poi.latitude) : null,
      longitude: poi.longitude != null ? Number(poi.longitude) : null,
      locationName: poi.notes ?? null,
    })),
    data.affiliateLinks,
    context,
  );

  // Catalogue d'activités : lecture tolérante, la migration peut être absente
  // en environnement local. Aucune donnée n'est synthétisée si la table échoue.
  let activityCatalog: ActivityCatalogItem[] = [];
  try {
    const catalogClient = (await createClient()) as unknown as SupabaseClient;
    const { data: rows, error } = await catalogClient
      .from('activity_catalog')
      .select('id, slug, label, family, description, logistics_scope, sport_tags, metrics, is_seed')
      .eq('is_active', true)
      .order('family', { ascending: true })
      .order('label', { ascending: true });
    if (error) throw error;
    const catalog = ((rows ?? []) as Array<Record<string, unknown>>)
      .map((row): ActivityCatalogItem | null => {
        const id = typeof row.id === 'string' ? row.id : null;
        const slug = typeof row.slug === 'string' ? row.slug : null;
        const label = typeof row.label === 'string' ? row.label : null;
        const family = typeof row.family === 'string' ? row.family : null;
        if (!id || !slug || !label || !family) return null;
        const scope = row.logistics_scope;
        const logisticsScope: ActivityLogisticsScope =
          scope === 'access' || scope === 'stages' || scope === 'full' ? scope : 'none';
        return {
          id,
          slug,
          label,
          family,
          description: typeof row.description === 'string' ? row.description : '',
          logisticsScope,
          sportTags: Array.isArray(row.sport_tags)
            ? row.sport_tags.filter((tag): tag is string => typeof tag === 'string')
            : [],
          metrics:
            row.metrics && typeof row.metrics === 'object' && !Array.isArray(row.metrics)
              ? (row.metrics as Record<string, unknown>)
              : {},
          isSeed: row.is_seed !== false,
        };
      })
      .filter((item): item is ActivityCatalogItem => item !== null);
    activityCatalog = rankActivityCatalog(catalog, trip.primary_activity, 12);
  } catch {
    // Le catalogue est un complément : son absence ne doit pas casser /prepare.
    console.warn('[preparer] catalogue d\'activités indisponible');
    activityCatalog = [];
  }

  // Apprentissage collectif (P5) : LECTURE seule de la promotion publiée.
  // `evaluateModelPromotion` n'est volontairement pas appelé ici — il écrit une
  // ligne `model_promotions` et une page rendue en GET ne doit pas muter la
  // base. L'évaluation reste déclenchée par la route d'administration
  // /api/promotions/evaluate ; ici on se contente d'afficher la version en
  // vigueur, donc les prédictions que le voyageur voit sont celles du modèle
  // réellement publié.
  let activeModel: PromotionOutcome | null = null;
  try {
    const promotionClient = (await createClient()) as unknown as SupabaseClient;
    activeModel = await getActivePromotion(promotionClient);
  } catch {
    console.warn("[preparer] promotion active indisponible");
    activeModel = null;
  }

  // Check-list : le hub charge un résumé (HubChecklistItem) pour ses compteurs,
  // le préparateur a besoin des lignes réelles (bascule optimiste + live bus).
  let checklist: DatabaseTripChecklistItem[] = [];
  try {
    const supabase = await createClient();
    const { data: rows } = await supabase
      .from('trip_checklist_items')
      .select(
        'id, trip_id, label, due_offset_days, done, done_at, position, created_at, updated_at',
      )
      .eq('trip_id', trip.id)
      .order('due_offset_days', { ascending: false })
      .order('position', { ascending: true });
    checklist = (rows ?? []) as DatabaseTripChecklistItem[];
  } catch (error) {
    // La check-list est un complément : son absence ne doit pas casser l'écran.
    console.error('[preparer] check-list indisponible:', error);
    checklist = [];
  }

  const phaseDetails = getTripPhaseDetails(trip);

  return {
    trip,
    model,
    routeGeojson: data.hiking?.routeGeojson ?? null,
    routeCoords: routeCoordsFromSteps(model.steps),
    checklist,
    daysUntilStart: phaseDetails.daysUntilStart ?? null,
    plannerSteps: toPlannerSteps(trip),
    bookingByStepId: data.bookingByStepId,
    bookingByPoiId,
    activityCatalog,
    logisticsVolets: logisticsVoletsFor(activityCatalog[0]?.logisticsScope ?? 'none'),
    activeModel,
    canEdit: trip.permissions.canEdit,
    canManageBudget: trip.permissions.canManageBudget,
  };
}
