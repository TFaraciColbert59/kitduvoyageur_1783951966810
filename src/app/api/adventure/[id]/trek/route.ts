import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { requireEntitlement } from '@/lib/entitlements/server';
import { getAdventurePlan } from '@/features/adventure-intelligence/server/generateAdventure';
import {
  computeAndPersistTrekPlan,
  createSupabaseGroupTrekDataSource,
  readLatestTrekPlan,
} from '@/features/adventure-intelligence/server/groupTrek';

export const dynamic = 'force-dynamic';

const planIdSchema = z.string().uuid('id doit être un UUID');

const trekBodySchema = z
  .object({
    packWeightKg: z
      .number()
      .min(0, 'packWeightKg doit être compris entre 0 et 40 kg')
      .max(40, 'packWeightKg doit être compris entre 0 et 40 kg')
      .optional(),
  })
  .strict();

async function readJsonBody(request: NextRequest): Promise<unknown> {
  const raw = await request.text();
  if (raw.trim() === '') return {};
  return JSON.parse(raw) as unknown;
}

function forbiddenResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Forbidden', details: 'Seul le propriétaire peut simuler ce trek.' },
    { status: 403 }
  );
}

function stagesUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'stages_unavailable',
      details: 'Aucune étape exploitable dans ce plan — aucun résultat inventé.',
    },
    { status: 409 }
  );
}

/**
 * POST /api/adventure/[id]/trek — simule le trek multi-jours des étapes du plan
 * (trip_steps réels sinon répartition blueprint explicite) et persiste le
 * résultat en version `trek-computed`. Gating `trek` (402).
 */
export async function POST(
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
    if (!parsedId.success) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch {
      return NextResponse.json(
        { error: 'Corps invalide', details: 'JSON attendu (packWeightKg optionnel)' },
        { status: 400 }
      );
    }
    const parsedBody = trekBodySchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: 'Corps invalide',
          details: parsedBody.error.issues.map((issue) => issue.path.join('.')).join(', '),
        },
        { status: 400 }
      );
    }

    const service = getServiceSupabase();
    if (!service) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }

    const entitlement = await requireEntitlement(service, user.id, 'trek');
    if (!entitlement.ok) return entitlement.response;

    const stored = await getAdventurePlan(service, parsedId.data);
    if (!stored) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }
    if (stored.plan.ownerId !== user.id) return forbiddenResponse();

    const source = createSupabaseGroupTrekDataSource(service);
    const result = await computeAndPersistTrekPlan(source, stored.plan, {
      packWeightKg: parsedBody.data.packWeightKg ?? null,
      now: new Date().toISOString(),
    });
    if (!result.ok) return stagesUnavailableResponse();

    return NextResponse.json(
      {
        version: result.version,
        trekPlan: result.result,
        stagesSource: result.meta.stagesSource,
        dayCount: result.meta.dayCount,
        computedAt: result.meta.computedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[adventure/[id]/trek] erreur inattendue:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/** GET — dernier résultat trek persisté. 404 explicite si non simulé. */
export async function GET(
  _request: NextRequest,
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
    if (!parsedId.success) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }

    const service = getServiceSupabase();
    if (!service) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }

    const entitlement = await requireEntitlement(service, user.id, 'trek');
    if (!entitlement.ok) return entitlement.response;

    const stored = await getAdventurePlan(service, parsedId.data);
    if (!stored) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }
    if (stored.plan.ownerId !== user.id) return forbiddenResponse();

    const source = createSupabaseGroupTrekDataSource(service);
    const latest = await readLatestTrekPlan(source, parsedId.data);
    if (!latest) {
      return NextResponse.json(
        {
          error: 'trek_plan_absent',
          details: 'Aucune simulation trek persistée pour cette version du plan.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        version: latest.version,
        trekPlan: latest.result,
        stagesSource: latest.meta.stagesSource,
        dayCount: latest.meta.dayCount,
        computedAt: latest.meta.computedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[adventure/[id]/trek] erreur inattendue (GET):',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
