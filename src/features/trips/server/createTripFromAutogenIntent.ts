'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createTrip } from '@/lib/queries-trips';
import { getCivilDurationDays } from '@/lib/dates/tripDates';
import { emitEvent } from '@/lib/events/eventBus';
import {
  AUTOGEN_TRIP_PIPELINE_VERSION,
  createTripFromAutogenIntentSchema,
  type CreateTripFromAutogenIntentParsed,
} from '../schemas/autogenTripCreate.schema';
import {
  buildAutogenPreparation,
  deriveAutogenTripDraft,
  deriveDifficulty,
  derivePrimaryActivity,
  flattenPreparationKitItems,
  polylineFromRouteGeom,
  regionSearchTerms,
  type AutogenPreparationPlan,
} from '../engine/autogenPreparation';
import { kitItemMatchesOwned } from '../engine/kitCompletenessEngine';
import {
  createSupabaseAdventurePersistence,
  createSupabaseAdventurePredictionPersistence,
  createSupabaseRoutePredictionClient,
  generateAdventure,
  getStoredPerformanceProfile,
} from '@/features/adventure-intelligence/server/generateAdventure';
import { createSupabaseLiveSourcesClient } from '@/features/adventure-intelligence/server/liveSources';
import { createDefaultRegistry } from '@/features/adventure-intelligence/server/adapters';
import { currentAdventureFeatureFlags } from '@/features/adventure-intelligence/server/featureFlags';
import { createSupabaseGenerationRequestStore } from '@/features/adventure-intelligence/server/generationRequests';
import {
  evaluateGenerationRequest,
  GENERATION_QUOTA_WINDOW_S,
} from '@/features/adventure-intelligence/domain/generationLimits';
import {
  resolveUserEntitlements,
  generationQuotaFor,
} from '@/lib/entitlements/server';

/**
 * Phase 3 — Commande canonique de création d'un voyage depuis l'intention
 * AutoGen (brief + 12 couches + verrous).
 *
 * Chaîne complète, idempotente par `correlation_id` :
 *   1. registre de génération A10 (quota, conflit, reprise après interruption) ;
 *   2. recherche BORNÉE (≤ 3) de parcours réels navigables cohérents avec les
 *      coordonnées/région (`phase3_search_navigable_routes`) ;
 *   3. création du voyage réel (brief original persisté dans `trips.metadata`) ;
 *   4. plan Adventure versionné (bundle plan/version/runs) avec l'ETA réelle du
 *      parcours retenu quand une géométrie existe ;
 *   5. attachement du plan au voyage (`attach_adventure_plan_to_trip`) et
 *      sélection du parcours (`select_adventure_plan_route`) UNIQUEMENT si la
 *      géométrie est réelle — jamais le repli `uniform_from_blueprint` ;
 *   6. kit matériel, budget prévisionnel, checklist et documents attendus
 *      (best-effort, avertissements explicites, jamais de donnée inventée).
 *
 * Échec injecté : le voyage et le plan sont compensés (suppression best-effort),
 * la requête de génération est marquée `failed`, et l'appelant reçoit un statut
 * typé 400|401|403|409|429|500|503.
 */

/** Rayon de recherche initial autour des coordonnées du brief (km). */
const AUTOGEN_ROUTE_SEARCH_RADIUS_KM = 50;

export interface AutogenRouteCandidate {
  routeId: number;
  name: string | null;
  ref: string | null;
  region: string | null;
  distanceKm: number | null;
  distanceM: number | null;
  elevationGainM: number | null;
  durationHours: number | null;
  difficulty: string | null;
  startLat: number | null;
  startLng: number | null;
}

export type CreateTripFromAutogenIntentErrorStatus = 400 | 401 | 403 | 409 | 429 | 500 | 503;

export type CreateTripFromAutogenIntentResult =
  | {
      ok: true;
      tripId: string;
      slug: string;
      title: string;
      planId: string | null;
      routeId: number | null;
      routeCandidates: AutogenRouteCandidate[];
      correlationId: string;
      reused: boolean;
      warnings: string[];
    }
  | {
      ok: false;
      status: CreateTripFromAutogenIntentErrorStatus;
      error: string;
      retryAfterS?: number;
    };

function errorResult(
  status: CreateTripFromAutogenIntentErrorStatus,
  error: string,
  retryAfterS?: number
): CreateTripFromAutogenIntentResult {
  return retryAfterS === undefined
    ? { ok: false, status, error }
    : { ok: false, status, error, retryAfterS };
}

function normalizedCoordinates(
  coordinates: CreateTripFromAutogenIntentParsed['coordinates']
): { lat: number; lng: number } | { lat: number; lng: number }[] | undefined {
  if (!coordinates) return undefined;
  if (Array.isArray(coordinates)) {
    return coordinates.length >= 2 ? coordinates : coordinates[0];
  }
  return coordinates;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

/** Recherche bornée de parcours RÉELS (jamais d'estimation). */
async function searchRouteCandidates(
  supabase: SupabaseClient,
  input: CreateTripFromAutogenIntentParsed,
  coordinates: ReturnType<typeof normalizedCoordinates>,
  warnings: string[]
): Promise<AutogenRouteCandidate[]> {
  const terms = regionSearchTerms(input.brief ?? null);
  const point = Array.isArray(coordinates) ? coordinates[0] : coordinates ?? null;
  if (terms.length === 0 && !point) return [];

  try {
    const { data, error } = await supabase.rpc('phase3_search_navigable_routes', {
      p_lat: point?.lat ?? null,
      p_lng: point?.lng ?? null,
      p_radius_km: AUTOGEN_ROUTE_SEARCH_RADIUS_KM,
      p_terms: terms.length > 0 ? terms : null,
      p_limit: 3,
    });
    if (error) {
      warnings.push(
        'Recherche de parcours réels indisponible — voyage créé sans sélection de tracé.'
      );
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[]).slice(0, 3).map((row) => ({
      routeId: Number(row.route_id),
      name: toStringOrNull(row.name),
      ref: toStringOrNull(row.ref),
      region: toStringOrNull(row.region),
      distanceKm: toFiniteNumber(row.distance_km),
      distanceM: toFiniteNumber(row.distance_m),
      elevationGainM: toFiniteNumber(row.elevation_gain_m),
      durationHours: toFiniteNumber(row.duration_hours),
      difficulty: toStringOrNull(row.difficulty),
      startLat: toFiniteNumber(row.start_lat),
      startLng: toFiniteNumber(row.start_lng),
    }));
  } catch (error) {
    console.error(
      '[LKDV autogen] recherche de parcours en échec:',
      error instanceof Error ? error.message : error
    );
    warnings.push('Recherche de parcours en échec — voyage créé sans sélection de tracé.');
    return [];
  }
}

/** Suppression compensatoire best-effort (jamais masquer l'échec d'origine). */
async function compensate(
  session: SupabaseClient,
  service: SupabaseClient | null,
  tripId: string | null,
  planId: string | null
): Promise<void> {
  if (tripId) {
    try {
      await session.from('trips').delete().eq('id', tripId);
    } catch (error) {
      console.error('[LKDV autogen] compensation voyage en échec:', error);
    }
  }
  if (planId && service) {
    try {
      await service.from('adventure_plans').delete().eq('id', planId);
    } catch (error) {
      console.error('[LKDV autogen] compensation plan en échec:', error);
    }
  }
}

interface OwnedItemRow {
  id: string;
  name: string;
  weightGrams: number | null;
  condition: string | null;
}

/**
 * Inventaire personnel de l'utilisateur, lecture bornée (400 lignes max).
 * Aucune écriture, aucune donnée croisée : sert uniquement à marquer
 * « possédé » / « manquant » et à reprendre les poids RÉELS connus.
 */
async function loadOwnedItems(
  supabase: SupabaseClient,
  userId: string
): Promise<OwnedItemRow[]> {
  try {
    const { data, error } = await supabase
      .from('product_ownership')
      .select('id, name, weight_g, condition')
      .eq('user_id', userId)
      .limit(400);
    if (error || !Array.isArray(data)) return [];
    return data
      .map((row) => {
        const record = row as Record<string, unknown>;
        const weight = Number(record.weight_g);
        return {
          id: String(record.id),
          name: typeof record.name === 'string' ? record.name : '',
          weightGrams: Number.isFinite(weight) && weight > 0 ? weight : null,
          condition:
            typeof record.condition === 'string' && record.condition !== ''
              ? record.condition
              : null,
        };
      })
      .filter((row) => row.name !== '');
  } catch (error) {
    console.error('[LKDV autogen] lecture inventaire en échec:', error);
    return [];
  }
}

function findOwnedMatch(
  itemName: string,
  recommendationKey: string | null,
  ownedItems: OwnedItemRow[]
): OwnedItemRow | null {
  return (
    ownedItems.find((owned) =>
      kitItemMatchesOwned(itemName, owned.name, recommendationKey)
    ) ?? null
  );
}

/** Persiste kit, budget, checklist et documents attendus (best-effort). */
async function persistPreparation(
  supabase: SupabaseClient,
  userId: string,
  tripId: string,
  preparation: AutogenPreparationPlan,
  warnings: string[]
): Promise<{ kitId: string | null; estimatedBudgetEur: number | null; ownedItemsCount: number }> {
  let kitId: string | null = null;
  let ownedItemsCount = 0;

  // Inventaire réel de l'utilisateur : détermine possédé/manquant + poids réels.
  const ownedItems = await loadOwnedItems(supabase, userId);

  if (preparation.kit) {
    try {
      const preparedItems = flattenPreparationKitItems(preparation.kit);
      const { data: kit, error } = await supabase
        .from('materiel_kits')
        .insert({
          user_id: userId,
          name: preparation.kit.name,
          description: preparation.kit.description,
          total_weight_g: preparation.kit.totalWeightGrams,
          is_public: false,
          is_trashed: false,
        })
        .select('id')
        .single();
      if (error || !kit) {
        warnings.push('Kit matériel non créé (erreur d’enregistrement).');
      } else {
        kitId = String((kit as { id: string }).id);
        if (preparedItems.length > 0) {
          const { error: itemsError } = await supabase.from('materiel_kit_items').insert(
            preparedItems.map((item) => {
              const owned = findOwnedMatch(item.name, item.recommendationKey, ownedItems);
              if (owned) ownedItemsCount++;
              return {
                kit_id: kitId,
                user_id: userId,
                name: item.name,
                category: item.category,
                weight_g: owned?.weightGrams ?? 0,
                quantity: item.quantity,
                is_checked: false,
                ownership: item.ownership,
                owner_id: item.ownership === 'personal' ? userId : null,
                condition: owned?.condition ?? null,
                reason: item.reason,
                priority: item.priority,
                is_vital: item.isVital,
              };
            })
          );
          if (itemsError) {
            warnings.push('Kit créé mais ses articles n’ont pas tous été enregistrés.');
          }

          // Le sac du voyage (section Équipement / checklist) reflète le MÊME
          // kit : poids repris de l'inventaire réel, sinon null (jamais un
          // poids inventé) ; `missing` = matériel non possédé à se procurer.
          const { error: tripItemsError } = await supabase.from('trip_items').insert(
            preparedItems.map((item) => {
              const owned = findOwnedMatch(item.name, item.recommendationKey, ownedItems);
              return {
                trip_id: tripId,
                item_name: item.name,
                category: item.category,
                quantity: item.quantity,
                weight_grams: owned?.weightGrams ?? null,
                is_packed: false,
                status: owned ? 'needed' : 'missing',
                source: owned ? 'inventory' : item.source,
                priority: item.priority,
                is_vital: item.isVital,
                is_worn: false,
                is_consumable: false,
                purchase_state: owned ? 'added' : 'needed',
                inventory_item_id: owned?.id ?? null,
                ownership: item.ownership,
                owner_id: item.ownership === 'personal' ? userId : null,
                condition: owned?.condition ?? null,
                reason: item.reason,
              };
            })
          );
          if (tripItemsError) {
            warnings.push('Kit créé mais le sac du voyage n’a pas été garni.');
          }
        }
      }
    } catch (error) {
      console.error('[LKDV autogen] création kit en échec:', error);
      warnings.push('Kit matériel non créé (erreur inattendue).');
    }
  }

  if (preparation.budgetLines.length > 0) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from('trip_expenses').insert(
        preparation.budgetLines.map((line) => ({
          trip_id: tripId,
          payer_id: userId,
          title: line.title,
          amount: line.amountEur,
          currency: 'EUR',
          category: line.category,
          expense_date: today,
          split_type: 'equal',
          is_planned: true,
          metadata: {
            source: 'autogen',
            estimated: true,
            rule: line.provenance.rule,
            party_size: line.provenance.partySize,
            days: line.provenance.days,
            reason: line.reason,
          },
        }))
      );
      if (error) warnings.push('Ligne budgétaire prévisionnelle non créée.');
    } catch (error) {
      console.error('[LKDV autogen] budget prévisionnel en échec:', error);
      warnings.push('Ligne budgétaire prévisionnelle non créée (erreur inattendue).');
    }
  }

  const checklistRows = [
    ...preparation.checklist,
    ...preparation.documents.map((document) => ({
      label: document.label,
      dueOffsetDays: document.dueOffsetDays,
    })),
  ];
  if (checklistRows.length > 0) {
    try {
      const { error } = await supabase.from('trip_checklist_items').insert(
        checklistRows.map((item, index) => ({
          trip_id: tripId,
          label: item.label,
          due_offset_days: item.dueOffsetDays,
          done: false,
          position: index,
        }))
      );
      if (error) warnings.push('Checklist de préparation non créée.');
    } catch (error) {
      console.error('[LKDV autogen] checklist en échec:', error);
      warnings.push('Checklist de préparation non créée (erreur inattendue).');
    }
  }

  return {
    kitId,
    estimatedBudgetEur:
      preparation.budgetLines.length > 0 ? preparation.budgetLines[0].amountEur : null,
    ownedItemsCount,
  };
}

export async function createTripFromAutogenIntent(
  rawInput: unknown
): Promise<CreateTripFromAutogenIntentResult> {
  const parsed = createTripFromAutogenIntentSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    return errorResult(400, `Paramètres invalides : ${fields}`);
  }
  const input = parsed.data;
  const layers = input.layers ?? {};

  try {
    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (!user) return errorResult(401, 'Authentification requise.');

    const service = getServiceSupabase();
    if (!service) {
      return errorResult(503, 'Service de génération momentanément indisponible.');
    }

    const correlationId = input.correlationId ?? randomUUID();
    const idempotencyKey = input.idempotencyKey ?? correlationId;
    const warnings: string[] = [];
    const store = createSupabaseGenerationRequestStore(service);

    // ── 1. Registre de génération : idempotence, conflit, quota, reprise ─────
    const existing = await store.findByKey(user.id, idempotencyKey);
    const entitlements = await resolveUserEntitlements(service, user.id);
    const quotaPerHour = generationQuotaFor(entitlements);
    const sinceIso = new Date(
      Date.now() - GENERATION_QUOTA_WINDOW_S * 1000
    ).toISOString();
    const [activePending, recentCount] = await Promise.all([
      store.hasActivePending(user.id),
      store.countRecent(user.id, sinceIso),
    ]);
    const evaluation = evaluateGenerationRequest({
      existing,
      activePending,
      recentCount,
      quotaPerHour,
    });

    if (evaluation.decision === 'conflict') {
      return errorResult(409, 'Une génération est déjà en cours — réessayez dans un instant.');
    }
    if (evaluation.decision === 'rate_limited') {
      const retryAfterS = evaluation.retryAfterS ?? GENERATION_QUOTA_WINDOW_S;
      return errorResult(
        429,
        `Quota de génération atteint (${quotaPerHour}/heure) — réessayez plus tard.`,
        retryAfterS
      );
    }

    // Reprise : un plan `done` existe déjà. S'il porte un voyage, la réponse
    // est rejouée à l'identique ; sinon la chaîne reprend sur ce plan.
    let existingPlanId: string | null = null;
    let existingTripId: string | null = null;
    if (evaluation.decision === 'reuse' && evaluation.planId) {
      existingPlanId = evaluation.planId;
      const { data: planRow } = await session
        .from('adventure_plans')
        .select('trip_id, selected_route_id')
        .eq('id', existingPlanId)
        .eq('owner_id', user.id)
        .maybeSingle();
      existingTripId = (planRow as { trip_id?: string | null } | null)?.trip_id ?? null;
      if (existingTripId) {
        const { data: tripRow } = await session
          .from('trips')
          .select('id, slug, title')
          .eq('id', existingTripId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (tripRow) {
          const selectedRouteId = toFiniteNumber(
            (planRow as { selected_route_id?: unknown } | null)?.selected_route_id
          );
          return {
            ok: true,
            tripId: String((tripRow as { id: string }).id),
            slug: String((tripRow as { slug: string }).slug),
            title: String((tripRow as { title: string }).title),
            planId: existingPlanId,
            routeId: selectedRouteId,
            routeCandidates: [],
            correlationId,
            reused: true,
            warnings,
          };
        }
      }
    }

    let pendingRequestId: string | null = null;
    if (!existingPlanId) {
      if (existing?.status === 'failed') {
        await store.requeue(existing.id);
        pendingRequestId = existing.id;
      } else {
        const created = await store.createPending(user.id, idempotencyKey);
        if (!created) {
          return errorResult(
            409,
            'Une génération est déjà en cours — réessayez dans un instant.'
          );
        }
        pendingRequestId = created.id;
      }
    }

    // ── 2. Recherche des parcours réels + polyline du meilleur candidat ──────
    const inputCoordinates = normalizedCoordinates(input.coordinates);
    const routeCandidates = await searchRouteCandidates(
      session,
      input,
      inputCoordinates,
      warnings
    );
    const bestRoute = routeCandidates[0] ?? null;

    let routePolyline: { lat: number; lng: number }[] | null = null;
    if (bestRoute) {
      try {
        const { data: geometryRow } = await session
          .from('hiking_routes')
          .select('id, geom')
          .eq('id', bestRoute.routeId)
          .maybeSingle();
        routePolyline = polylineFromRouteGeom(
          (geometryRow as { geom?: unknown } | null)?.geom
        );
      } catch (error) {
        console.error('[LKDV autogen] lecture géométrie en échec:', error);
      }
      if (!routePolyline) {
        warnings.push(
          'Géométrie du parcours candidat illisible — navigation non activée pour ce tracé.'
        );
      }
    } else if (routeCandidates.length === 0) {
      warnings.push(
        'Aucun parcours réel navigable trouvé pour ce brief — voyage créé sur estimation uniquement.'
      );
    }

    // ── 3. Création du voyage réel (brief persisté dans metadata) ────────────
    const draft = deriveAutogenTripDraft({
      rawInput: input.rawInput,
      brief: input.brief ?? null,
      title: input.title,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    });
    const tripActivity = derivePrimaryActivity(input.brief ?? null);
    const routeContext = bestRoute
      ? {
          name: bestRoute.name,
          distanceKm: bestRoute.distanceKm,
          elevationGainM: bestRoute.elevationGainM,
          difficulty: bestRoute.difficulty,
        }
      : null;
    const seasonMonth = draft.startDate ? Number(draft.startDate.slice(5, 7)) || null : null;
    const durationDays =
      draft.startDate && draft.endDate
        ? getCivilDurationDays(draft.startDate, draft.endDate)
        : input.brief?.duration?.value?.days ?? null;

    const preparationPreview = buildAutogenPreparation({
      brief: input.brief ?? null,
      layers,
      partySize: draft.partySize,
      routeName: bestRoute?.name ?? null,
      activity: tripActivity,
      countryCode: draft.destinationCountryCode,
      durationDays,
      seasonMonth,
      route: routeContext,
    });

    const baseMetadata: Record<string, unknown> = {
      countries: draft.destinationCountryCode ? [draft.destinationCountryCode] : undefined,
      autogen: {
        pipeline_version: AUTOGEN_TRIP_PIPELINE_VERSION,
        correlation_id: correlationId,
        raw_input: input.rawInput,
        brief: input.brief ?? null,
        layers,
        locks: input.locks,
        route_candidates: routeCandidates,
      },
    };

    let tripRecord: { id: string; slug: string; title: string } | null = null;
    if (existingTripId) {
      const { data: tripRow } = await session
        .from('trips')
        .select('id, slug, title')
        .eq('id', existingTripId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (tripRow) {
        tripRecord = {
          id: String((tripRow as { id: string }).id),
          slug: String((tripRow as { slug: string }).slug),
          title: String((tripRow as { title: string }).title),
        };
      }
    }

    if (!tripRecord) {
      try {
        const trip = await createTrip(
          {
            title: draft.title,
            description: draft.description,
            destination_name: draft.destinationName,
            destination_country_code: draft.destinationCountryCode,
            start_date: draft.startDate,
            end_date: draft.endDate,
            status: 'draft',
            visibility: 'private',
            primary_activity: derivePrimaryActivity(input.brief ?? null),
            difficulty: deriveDifficulty(layers),
            estimated_budget:
              preparationPreview.budgetLines.length > 0
                ? preparationPreview.budgetLines[0].amountEur
                : null,
            metadata: baseMetadata,
          },
          user.id
        );
        tripRecord = {
          id: String((trip as { id: string }).id),
          slug: String((trip as { slug: string }).slug),
          title: String((trip as { title: string }).title),
        };
      } catch (error) {
        console.error('[LKDV autogen] création du voyage en échec:', error);
        if (pendingRequestId) {
          await store.markFailed(pendingRequestId).catch(() => undefined);
        }
        return errorResult(500, 'La création du voyage a échoué — réessayez.');
      }
    }

    const tripId = tripRecord.id;

    // ── 4. Plan Adventure versionné (bundle plan/version/runs) ───────────────
    let planId = existingPlanId;
    if (!planId) {
      const flags = await currentAdventureFeatureFlags();
      try {
        const result = await generateAdventure(
          {
            ownerId: user.id,
            text: input.rawInput,
            locks: input.locks,
            coordinates: routePolyline ?? inputCoordinates,
            correlationId,
            featureFlags: {
              performance_profile_v2: flags.performance_profile_v2,
              route_prediction_v2: flags.route_prediction_v2,
              collective_intelligence: flags.collective_intelligence === true,
              terrain_live: flags.terrain_live === true,
            },
          },
          {
            registry: createDefaultRegistry(),
            persistence: createSupabaseAdventurePersistence(service),
            hasActiveConsent: async (userId, purpose) => {
              const { data, error } = await service.rpc('has_active_consent', {
                p_user_id: userId,
                p_purpose: purpose,
              });
              if (error) return false;
              return data === true;
            },
            getCurrentProfile: (userId) => getStoredPerformanceProfile(service, userId),
            persistAdventurePredictions:
              createSupabaseAdventurePredictionPersistence(service),
            routePredictionClient: createSupabaseRoutePredictionClient(service),
            liveSourcesClient: createSupabaseLiveSourcesClient(service),
          }
        );
        planId = result.plan.id;
      } catch (error) {
        console.error('[LKDV autogen] génération du plan en échec:', error);
        if (pendingRequestId) {
          await store.markFailed(pendingRequestId).catch(() => undefined);
        }
        await compensate(session, service, tripId, null);
        return errorResult(500, 'La génération du plan a échoué — réessayez.');
      }
    }

    // ── 5. Attachement du plan au voyage (Phase 2) ───────────────────────────
    try {
      const { error: attachError } = await session.rpc('attach_adventure_plan_to_trip', {
        p_plan_id: planId,
        p_trip_id: tripId,
        p_correlation_id: correlationId,
      });
      if (attachError) {
        if (/déjà attaché/.test(attachError.message)) {
          if (pendingRequestId) {
            await store.markFailed(pendingRequestId).catch(() => undefined);
          }
          return errorResult(409, 'Ce plan est déjà attaché à un autre voyage.');
        }
        if (/non détenu|propriétaire/.test(attachError.message)) {
          if (pendingRequestId) {
            await store.markFailed(pendingRequestId).catch(() => undefined);
          }
          await compensate(session, service, tripId, planId);
          return errorResult(403, 'Vous n’êtes pas propriétaire de ce plan.');
        }
        throw new Error(attachError.message);
      }
    } catch (error) {
      console.error('[LKDV autogen] attachement plan → voyage en échec:', error);
      if (pendingRequestId) {
        await store.markFailed(pendingRequestId).catch(() => undefined);
      }
      await compensate(session, service, tripId, planId);
      return errorResult(500, 'L’attachement du plan au voyage a échoué — réessayez.');
    }

    // ── 6. Sélection du parcours retenu (géométrie réelle uniquement) ────────
    let selectedRouteId: number | null = null;
    if (bestRoute && routePolyline && input.autoSelectRoute) {
      const { error: selectError } = await session.rpc('select_adventure_plan_route', {
        p_plan_id: planId,
        p_route_id: bestRoute.routeId,
        p_correlation_id: correlationId,
      });
      if (selectError) {
        console.error('[LKDV autogen] sélection du parcours en échec:', selectError.message);
        warnings.push(
          'Parcours réel trouvé mais sélection refusée — navigation non activée.'
        );
      } else {
        selectedRouteId = bestRoute.routeId;
      }
    } else if (bestRoute && !routePolyline) {
      warnings.push('Parcours réel non sélectionné : géométrie non exploitable.');
    }

    // ── 7. Kit, budget, checklist, documents attendus (best-effort) ──────────
    // Cohérence avec le VOYAGE/PLAN/ROUTE réellement retenus : les recommandations
    // citent les données réelles du parcours sélectionné (distance, D+, difficulté).
    const preparation = buildAutogenPreparation({
      brief: input.brief ?? null,
      layers,
      partySize: draft.partySize,
      routeName: selectedRouteId ? bestRoute?.name ?? null : null,
      activity: tripActivity,
      countryCode: draft.destinationCountryCode,
      durationDays,
      seasonMonth,
      route: selectedRouteId ? routeContext : null,
    });
    warnings.push(...preparation.warnings);
    const { kitId, estimatedBudgetEur, ownedItemsCount } = await persistPreparation(
      session,
      user.id,
      tripId,
      preparation,
      warnings
    );

    // ── 8. Métadonnées finales : plan, parcours, préparation, avertissements ─
    try {
      await session
        .from('trips')
        .update({
          metadata: {
            ...baseMetadata,
            ...(selectedRouteId != null ? { route_id: selectedRouteId } : {}),
            autogen: {
              ...(baseMetadata.autogen as Record<string, unknown>),
              plan_id: planId,
              selected_route_id: selectedRouteId,
              kit_id: kitId,
              kit_owned_items_count: ownedItemsCount,
              kit_recommendations_count: preparation.kit?.recommendations.length ?? 0,
              safety_controls_count: preparation.safetyControls.length,
              warnings,
            },
          },
          ...(kitId ? { kit_id: kitId } : {}),
          ...(estimatedBudgetEur != null ? { estimated_budget: estimatedBudgetEur } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', tripId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('[LKDV autogen] métadonnées finales en échec:', error);
      warnings.push('Métadonnées de traçabilité partielles.');
    }

    if (pendingRequestId) {
      await store.markDone(pendingRequestId, planId).catch((error) => {
        console.error('[LKDV autogen] markDone en échec:', error);
      });
    }

    await emitEvent({
      event_type: 'trip.created',
      actor_id: user.id,
      entity_type: 'trip',
      entity_id: tripId,
      visibility: 'private',
      crew_id: null,
      metadata: {
        title: tripRecord.title,
        destination: draft.destinationName ?? draft.destinationCountryCode ?? '',
        source: AUTOGEN_TRIP_PIPELINE_VERSION,
        correlation_id: correlationId,
        plan_id: planId,
        selected_route_id: selectedRouteId,
      },
    }).catch((error) => {
      console.error('[LKDV autogen] événement trip.created en échec:', error);
    });

    revalidatePath('/voyages');
    revalidatePath('/hub', 'layout');

    return {
      ok: true,
      tripId,
      slug: tripRecord.slug,
      title: tripRecord.title,
      planId,
      routeId: selectedRouteId,
      routeCandidates,
      correlationId,
      reused: false,
      warnings,
    };
  } catch (error) {
    console.error(
      '[LKDV autogen] erreur inattendue:',
      error instanceof Error ? error.message : error
    );
    return errorResult(500, 'Erreur serveur — réessayez.');
  }
}
