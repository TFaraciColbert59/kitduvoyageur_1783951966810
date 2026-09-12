import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { createDefaultRegistry } from '@/features/adventure-intelligence/server/adapters';
import {
  createSupabaseAdventurePersistence,
  createSupabaseAdventurePredictionPersistence,
  createSupabaseRoutePredictionClient,
  generateAdventure,
  getAdventurePlan,
  getStoredPerformanceProfile,
} from '@/features/adventure-intelligence/server/generateAdventure';
import { createSupabaseLiveSourcesClient } from '@/features/adventure-intelligence/server/liveSources';
import { MAX_ROUTE_POLYLINE_POINTS } from '@/features/adventure-intelligence/server/routePrediction';
import { currentAdventureFeatureFlags } from '@/features/adventure-intelligence/server/featureFlags';
import {
  evaluateGenerationRequest,
  GENERATION_QUOTA_WINDOW_S,
} from '@/features/adventure-intelligence/domain/generationLimits';
import { requiredPlanFor } from '@/features/adventure-intelligence/domain/entitlements';
import { resolveUserEntitlements, generationQuotaFor } from '@/lib/entitlements/server';
import { createSupabaseGenerationRequestStore } from '@/features/adventure-intelligence/server/generationRequests';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Longueur maximale tolérée d'une clé d'idempotence cliente. */
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;
/** Limite anti-rafale distribuée par utilisateur (Phase 6, §9.11). */
const GENERATE_BURST_LIMIT = 30;
/** Fenêtre de la limite anti-rafale (5 min). */
const GENERATE_BURST_WINDOW_MS = 5 * 60_000;

const adventureConstraintSchema = z.object({
  id: z.string().min(1, 'locks[].id est requis'),
  kind: z.enum(['hard', 'soft']),
  label: z.string().min(1, 'locks[].label est requis'),
  value: z.unknown(),
  locked: z.boolean(),
  source: z.enum(['user', 'system', 'safety']),
});

const coordinatesSchema = z
  .object({
    lat: z
      .number()
      .min(-90, 'coordinates.lat doit être compris entre -90 et 90')
      .max(90, 'coordinates.lat doit être compris entre -90 et 90'),
    lng: z
      .number()
      .min(-180, 'coordinates.lng doit être compris entre -180 et 180')
      .max(180, 'coordinates.lng doit être compris entre -180 et 180'),
  })
  .strict();

const generateSchema = z.object({
  text: z
    .string()
    .min(10, 'Le texte doit contenir au moins 10 caractères')
    .max(2000, 'Le texte ne peut pas dépasser 2000 caractères'),
  locks: z
    .array(adventureConstraintSchema)
    .max(50, 'Maximum 50 verrous par génération')
    .optional(),
  // A11 #15 / A13 (S1) — un point unique alimente la météo officielle ; une
  // polyline (≥ 2 points) active en plus l'ETA réelle map-matchée.
  coordinates: z
    .union([
      coordinatesSchema,
      z
        .array(coordinatesSchema)
        .min(2, 'coordinates (polyline) doit contenir au moins 2 points')
        .max(
          MAX_ROUTE_POLYLINE_POINTS,
          `coordinates (polyline) ne peut pas dépasser ${MAX_ROUTE_POLYLINE_POINTS} points`
        ),
    ])
    .optional(),
  weatherDays: z
    .number()
    .int('weatherDays doit être un entier')
    .min(1, 'weatherDays doit être compris entre 1 et 7')
    .max(7, 'weatherDays doit être compris entre 1 et 7')
    .optional(),
  // Phase 2 — corrélation de chaîne optionnelle : propagée aux runs de la
  // génération et retournée au client pour enchaîner (attach voyage, sélection
  // de route, session, publication). La colonne `adventure_plans.correlation_id`
  // est écrite par `attach_adventure_plan_to_trip` / `select_adventure_plan_route`
  // (la RPC `create_adventure_plan_bundle` n'expose pas de p_correlation_id et
  // n'est pas modifiée ici — évolution additive réservée à une migration).
  correlationId: z.string().uuid('correlationId doit être un UUID').optional(),
});

function zodDetails(error: z.ZodError): string {
  return error.issues.map((issue) => issue.path.join('.')).join(', ');
}

/**
 * Rejoue la réponse d'une clé `done` : plan + version + variantes relus depuis
 * la persistance, sans régénérer ni consommer de quota (audit #10).
 */
async function reuseResponse(supabase: SupabaseClient, planId: string): Promise<NextResponse> {
  try {
    const stored = await getAdventurePlan(supabase, planId);
    if (stored) {
      const alternatives = stored.plan.sections.alternatives?.value;
      return NextResponse.json(
        {
          planId,
          version: stored.plan.currentVersion,
          candidates: Array.isArray(alternatives) ? alternatives : [],
          candidatePlans: stored.candidates ?? [],
          ...(stored.candidateComparison
            ? { candidateComparison: stored.candidateComparison }
            : {}),
          explanation: 'Génération réutilisée (Idempotency-Key déjà traitée).',
          aiUsed: false,
          reused: true,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error(
      '[adventure/generate] relecture du plan réutilisé en échec:',
      error instanceof Error ? error.message : error
    );
  }
  return NextResponse.json({ planId, reused: true }, { status: 200 });
}

/**
 * POST /api/adventure/generate — une phrase → AdventurePlan complet.
 * Auth obligatoire (401), `Idempotency-Key` requis (400), validation zod
 * française (400), service requis (503). Idempotence : clé `done` rejouée,
 * clé `pending` → 409 ; une seule génération active et 5/heure/utilisateur
 * (429 + Retry-After). La persistance et le registre sont injectés côté
 * serveur uniquement.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Session requise' },
        { status: 401 }
      );
    }

    // Phase 6 (§9.11) — limite anti-rafale distribuée AVANT tout travail coûteux.
    // Route payante : failMode `closed` — si Upstash est configuré mais
    // injoignable, la génération est refusée (503), jamais laissée passer.
    const burst = await rateLimit({
      key: `adventure-generate:${user.id}`,
      limit: GENERATE_BURST_LIMIT,
      windowMs: GENERATE_BURST_WINDOW_MS,
      failMode: 'closed',
    });
    if (burst.outcome === 'limited') {
      return NextResponse.json(
        {
          error: 'Trop de requêtes',
          details: 'adventure_generate_rate_limited',
          retryAfterS: burst.retryAfterSeconds,
        },
        { status: 429, headers: rateLimitHeaders(burst) }
      );
    }
    if (burst.outcome === 'unavailable') {
      return NextResponse.json(
        { error: 'Service temporairement indisponible', details: 'rate_limit_indisponible' },
        { status: 503, headers: rateLimitHeaders(burst) }
      );
    }

    const idempotencyKey = (request.headers.get('idempotency-key') ?? '').trim();
    if (idempotencyKey.length === 0 || idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      return NextResponse.json(
        {
          error: 'Idempotency-Key requis',
          details: `En-tête Idempotency-Key obligatoire (1 à ${MAX_IDEMPOTENCY_KEY_LENGTH} caractères)`,
        },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Corps invalide', details: 'JSON attendu' },
        { status: 400 }
      );
    }

    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Corps invalide', details: zodDetails(parsed.error) },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }

    const store = createSupabaseGenerationRequestStore(supabase);
    // A13 (S3) — gating `full_generation` : les usages gratuits ne sont pas
    // bloqués, seulement limités à un quota réduit explicite.
    const entitlements = await resolveUserEntitlements(supabase, user.id);
    const quotaPerHour = generationQuotaFor(entitlements);
    const fullGeneration = entitlements.entitlements.includes('full_generation');
    const sinceIso = new Date(Date.now() - GENERATION_QUOTA_WINDOW_S * 1000).toISOString();
    const [existing, activePending, recentCount] = await Promise.all([
      store.findByKey(user.id, idempotencyKey),
      store.hasActivePending(user.id),
      store.countRecent(user.id, sinceIso),
    ]);

    const evaluation = evaluateGenerationRequest({
      existing,
      activePending,
      recentCount,
      quotaPerHour,
    });

    if (evaluation.decision === 'reuse' && evaluation.planId) {
      return await reuseResponse(supabase, evaluation.planId);
    }
    if (evaluation.decision === 'conflict') {
      return NextResponse.json(
        {
          error: 'Génération déjà en cours',
          details: 'Une seule génération active à la fois — réessayez dans quelques instants.',
        },
        { status: 409 }
      );
    }
    if (evaluation.decision === 'rate_limited') {
      const retryAfterS = evaluation.retryAfterS ?? GENERATION_QUOTA_WINDOW_S;
      return NextResponse.json(
        {
          error: 'Quota de génération atteint',
          details: fullGeneration
            ? `Maximum ${quotaPerHour} générations par heure et par utilisateur — réessayez dans ${retryAfterS} s.`
            : `Quota gratuit : ${quotaPerHour} générations par heure. Passez au plan ${requiredPlanFor('full_generation')} pour un quota étendu — réessayez dans ${retryAfterS} s.`,
          retryAfterS,
          quotaPerHour,
          ...(fullGeneration ? {} : { requiredPlan: requiredPlanFor('full_generation') }),
        },
        { status: 429, headers: { 'Retry-After': String(retryAfterS) } }
      );
    }

    const created = await store.createPending(user.id, idempotencyKey);
    if (!created) {
      return NextResponse.json(
        {
          error: 'Génération déjà en cours',
          details: 'Clé déjà utilisée ou génération simultanée en cours.',
        },
        { status: 409 }
      );
    }

    const flags = await currentAdventureFeatureFlags();

    let result: Awaited<ReturnType<typeof generateAdventure>>;
    try {
      result = await generateAdventure(
        {
          ownerId: user.id,
          text: parsed.data.text,
          locks: parsed.data.locks,
          coordinates: parsed.data.coordinates,
          weatherDays: parsed.data.weatherDays,
          correlationId: parsed.data.correlationId,
          featureFlags: {
            performance_profile_v2: flags.performance_profile_v2,
            route_prediction_v2: flags.route_prediction_v2,
            collective_intelligence: flags.collective_intelligence === true,
            terrain_live: flags.terrain_live === true,
          },
        },
        {
          registry: createDefaultRegistry(),
          persistence: createSupabaseAdventurePersistence(supabase),
          // A10 (10.9) : consentement vérifié côté serveur, puis profil réel
          // (service_role) injecté dans les adaptateurs ; sinon repli standard.
          hasActiveConsent: async (userId, purpose) => {
            const { data, error } = await supabase.rpc('has_active_consent', {
              p_user_id: userId,
              p_purpose: purpose,
            });
            if (error) {
              console.error('[adventure/generate] has_active_consent en échec:', error.message);
              return false;
            }
            return data === true;
          },
          getCurrentProfile: (userId) => getStoredPerformanceProfile(supabase, userId),
          persistAdventurePredictions:
            createSupabaseAdventurePredictionPersistence(supabase),
          // A13 (S1) — ETA réelle : map-matching + géométries OSM + profil.
          routePredictionClient: createSupabaseRoutePredictionClient(supabase),
          // A13 (S4) — sources vivantes : Terrain Live + POI OSM eau/refuges.
          liveSourcesClient: createSupabaseLiveSourcesClient(supabase),
        }
      );
    } catch (error) {
      try {
        await store.markFailed(created.id);
      } catch (markError) {
        console.error(
          '[adventure/generate] markFailed en échec:',
          markError instanceof Error ? markError.message : markError
        );
      }
      throw error;
    }

    await store.markDone(created.id, result.plan.id);

    return NextResponse.json(
      {
        planId: result.plan.id,
        version: result.plan.currentVersion,
        candidates: result.candidates,
        // A11 #14 — trois plans complets en plus des deltas légers.
        candidatePlans: result.candidatePlans ?? [],
        // A13 (S2) — tableau comparatif réellement comparable.
        candidateComparison: result.candidateComparison,
        explanation: result.explanation,
        aiUsed: result.aiUsed,
        ...(result.correlationId ? { correlationId: result.correlationId } : {}),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[adventure/generate] erreur inattendue:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
