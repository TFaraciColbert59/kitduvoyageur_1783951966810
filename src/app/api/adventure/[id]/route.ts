import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { getAdventurePlan } from '@/features/adventure-intelligence/server/generateAdventure';
import { createSupabaseGroupTrekDataSource } from '@/features/adventure-intelligence/server/groupTrek';
import {
  acceptedPlanMetaFromSnapshot,
  buildAcceptedPlanEditVersion,
} from '@/features/adventure-intelligence/domain/acceptedPlanEdit';
import { acceptedPlanSchema } from '@/features/adventure-prep/acceptedPlan';

export const dynamic = 'force-dynamic';

const planIdSchema = z.string().uuid('id doit être un UUID');

/** Anti-rafale des modifications (par utilisateur). */
const EDIT_BURST_LIMIT = 60;
const EDIT_BURST_WINDOW_MS = 5 * 60_000;

const editBodySchema = z
  .object({
    /** Verrou optimiste : la version sur laquelle l'écran a travaillé. */
    expectedVersion: z.number().int().min(1),
    acceptedPlan: acceptedPlanSchema,
  })
  .strict();

function notFound(): NextResponse {
  return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
}

/**
 * GET /api/adventure/[id] — lecture du plan + version courante + décisions.
 * Le client de session applique les policies A1 (propriétaire ou
 * collaborateur du voyage) : tout plan inaccessible est un 404.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();

    const { id } = await params;
    const parsedId = planIdSchema.safeParse(id);
    if (!parsedId.success) return notFound();
    if (!user) return notFound();

    const stored = await getAdventurePlan(session, parsedId.data);
    if (!stored) return notFound();

    const acceptedPlanMeta = acceptedPlanMetaFromSnapshot(stored.version?.snapshot);

    return NextResponse.json({
      plan: stored.plan,
      version: stored.version,
      decisions: stored.decisions,
      // A11 #14 — les plans candidats ne sont renvoyés que s'ils existent.
      ...(stored.candidates && stored.candidates.length > 0
        ? { candidates: stored.candidates }
        : {}),
      // A13 (S2) — le tableau comparatif n'est exposé que si la version le porte.
      ...(stored.candidateComparison ? { candidateComparison: stored.candidateComparison } : {}),
      // L0.6 — le plan tel que validé à l'écran, revalidé par le contrat strict.
      acceptedPlan: stored.acceptedPlan ?? null,
      ...(acceptedPlanMeta ? { acceptedPlanMeta } : {}),
      // L0.7 — seul le propriétaire peut modifier depuis le préparateur.
      canEdit: stored.plan.ownerId === user.id,
    });
  } catch (error) {
    console.error(
      '[adventure/[id]] erreur inattendue:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * PUT /api/adventure/[id] — enregistre la modification d'une aventure depuis
 * le préparateur (L0.7). Jamais de régénération : le plan accepté est ajouté
 * comme NOUVELLE version immuable (`a13_append_plan_version`, propriété
 * vérifiée sous verrou). Verrou optimiste : 409 si une autre version a été
 * écrite depuis la lecture de l'écran.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const parsedId = planIdSchema.safeParse(id);
    if (!parsedId.success) return notFound();

    const burst = await rateLimit({
      key: `adventure-edit:${user.id}`,
      limit: EDIT_BURST_LIMIT,
      windowMs: EDIT_BURST_WINDOW_MS,
    });
    if (burst.outcome === 'limited') {
      return NextResponse.json(
        {
          error: 'Trop de requêtes',
          details: 'adventure_edit_rate_limited',
          retryAfterS: burst.retryAfterSeconds,
        },
        { status: 429, headers: rateLimitHeaders(burst) }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Corps invalide', details: 'JSON attendu' }, { status: 400 });
    }
    const parsed = editBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Corps invalide',
          details: parsed.error.issues.map((issue) => issue.path.join('.')).join(', '),
        },
        { status: 400 }
      );
    }

    const service = getServiceSupabase();
    if (!service) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }

    // Lecture service_role : la propriété est vérifiée ICI puis de nouveau
    // sous verrou par la RPC. Un plan d'autrui répond 404 (aucune fuite).
    const stored = await getAdventurePlan(service, parsedId.data);
    if (!stored || stored.plan.ownerId !== user.id) return notFound();

    const currentVersion = stored.version?.version ?? stored.plan.currentVersion;
    if (parsed.data.expectedVersion !== currentVersion) {
      return NextResponse.json(
        {
          error: 'version_conflict',
          details: 'Cette aventure a été modifiée ailleurs depuis son ouverture.',
          currentVersion,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const edit = buildAcceptedPlanEditVersion({
      plan: stored.plan,
      latestSnapshot: stored.version?.snapshot ?? null,
      previousAccepted: stored.acceptedPlan ?? null,
      nextAccepted: parsed.data.acceptedPlan,
      now,
    });

    const source = createSupabaseGroupTrekDataSource(service);
    let version: number;
    try {
      version = await source.appendVersion({
        planId: stored.plan.id,
        userId: user.id,
        // Le numéro fait autorité côté base (réécrit sous verrou par la RPC) :
        // on transmet la version attendue, jamais une valeur devinée.
        version: { version: currentVersion + 1, ...edit.version },
      });
    } catch (error) {
      console.error(
        '[adventure/[id]] append en échec:',
        error instanceof Error ? error.message : error
      );
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    // Le titre visible au Hub suit le nom choisi. Best-effort : la version
    // immuable est déjà écrite et reste la source de vérité.
    if (edit.title !== undefined && edit.title !== stored.plan.title) {
      const { error: titleError } = await service
        .from('adventure_plans')
        .update({ title: edit.title })
        .eq('id', stored.plan.id)
        .eq('owner_id', user.id);
      if (titleError) {
        console.error('[adventure/[id]] titre non mis à jour:', titleError.message);
      }
    }

    return NextResponse.json(
      {
        planId: stored.plan.id,
        version,
        acceptedPlanMeta: edit.meta,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[adventure/[id]] erreur inattendue (PUT):',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
