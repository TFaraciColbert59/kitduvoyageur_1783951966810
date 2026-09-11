import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { requireEntitlement } from '@/lib/entitlements/server';
import { getAdventurePlan } from '@/features/adventure-intelligence/server/generateAdventure';
import {
  computeAndPersistGroupPlan,
  createSupabaseGroupTrekDataSource,
  readLatestGroupPlan,
} from '@/features/adventure-intelligence/server/groupTrek';

export const dynamic = 'force-dynamic';

const planIdSchema = z.string().uuid('id doit être un UUID');

const groupBodySchema = z
  .object({
    crewId: z.string().uuid('crewId doit être un UUID').optional(),
    strategy: z.enum(['comfort', 'recommended', 'fast']).optional(),
  })
  .strict();

async function readJsonBody(request: NextRequest): Promise<unknown> {
  const raw = await request.text();
  if (raw.trim() === '') return {};
  return JSON.parse(raw) as unknown;
}

function invalidBodyResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Corps invalide', details: 'JSON attendu (crewId/strategy optionnels)' },
    { status: 400 }
  );
}

/**
 * POST /api/adventure/[id]/group — calcule le plan de groupe réel (crew lié ou
 * `crewId` fourni, profils consentis uniquement) et le persiste en version
 * `group-computed`. Gating `group` (402), ownership strict (403/404).
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
      return invalidBodyResponse();
    }
    const parsedBody = groupBodySchema.safeParse(body);
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

    const entitlement = await requireEntitlement(service, user.id, 'group');
    if (!entitlement.ok) return entitlement.response;

    const stored = await getAdventurePlan(service, parsedId.data);
    if (!stored) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }
    if (stored.plan.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', details: 'Seul le propriétaire peut calculer le plan de groupe.' },
        { status: 403 }
      );
    }

    const source = createSupabaseGroupTrekDataSource(service);
    const result = await computeAndPersistGroupPlan(source, user.id, stored.plan, {
      crewId: parsedBody.data.crewId ?? null,
      strategy: parsedBody.data.strategy,
      now: new Date().toISOString(),
    });

    if (!result.ok) {
      if (result.reason === 'crew_required') {
        return NextResponse.json(
          {
            error: 'crew_required',
            details: 'Aucun équipage actif lié au plan — précisez crewId.',
          },
          { status: 400 }
        );
      }
      if (result.reason === 'stages_unavailable') {
        return NextResponse.json(
          {
            error: 'stages_unavailable',
            details: 'Aucune étape exploitable dans ce plan — aucun calcul inventé.',
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Forbidden', details: 'Équipage inaccessible.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        version: result.version,
        groupPlan: result.summary,
        stagesSource: result.meta.stagesSource,
        strategy: result.meta.strategy,
        memberCount: result.meta.memberCount,
        computedAt: result.meta.computedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[adventure/[id]/group] erreur inattendue:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * GET /api/adventure/[id]/group — dernier plan de groupe **public** persisté
 * (agrégats uniquement). 404 explicite si aucun calcul n'a encore été fait.
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

    const entitlement = await requireEntitlement(service, user.id, 'group');
    if (!entitlement.ok) return entitlement.response;

    const stored = await getAdventurePlan(service, parsedId.data);
    if (!stored) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }
    if (stored.plan.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', details: 'Seul le propriétaire peut lire ce plan de groupe.' },
        { status: 403 }
      );
    }

    const source = createSupabaseGroupTrekDataSource(service);
    const latest = await readLatestGroupPlan(source, parsedId.data);
    if (!latest) {
      return NextResponse.json(
        {
          error: 'group_plan_absent',
          details: 'Aucun plan de groupe calculé pour cette version du plan.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        version: latest.version,
        groupPlan: latest.summary,
        stagesSource: latest.meta.stagesSource,
        strategy: latest.meta.strategy,
        memberCount: latest.meta.memberCount,
        computedAt: latest.meta.computedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[adventure/[id]/group] erreur inattendue (GET):',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
