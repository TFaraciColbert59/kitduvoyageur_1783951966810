import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  COCKPIT_MAX_TRACKING_POSITIONS,
  COCKPIT_PLAN_NOT_FOUND_WARNING,
  EMPTY_RECALC_STATE,
  buildCockpitLiveData,
  createSupabaseCockpitDataClient,
} from '@/features/adventure-intelligence/server/cockpitData';
import { currentAdventureFeatureFlags } from '@/features/adventure-intelligence/server/featureFlags';
import type { RecalcState } from '@/features/adventure-intelligence/domain/recalcTriggers';

export const dynamic = 'force-dynamic';

const planIdSchema = z.string().uuid('id doit être un UUID');

const positionSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  timestamp: z.string().min(1),
});

const recalcStateSchema = z
  .object({
    lastRecalcAt: z.string().nullable().optional(),
    lastPositionAt: z.string().nullable().optional(),
    lastPosition: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
    lastPaceMinPerKm: z.number().nullable().optional(),
    lastReportsVersion: z.number().int().min(0).optional(),
    lastOffRouteAt: z.string().nullable().optional(),
    batteryLevel: z.number().min(0).max(100).nullable().optional(),
    routeVersion: z.number().int().min(0).optional(),
  })
  .optional();

const cockpitBodySchema = z.object({
  positions: z.array(positionSchema).max(COCKPIT_MAX_TRACKING_POSITIONS).optional(),
  offline: z.boolean().optional(),
  batteryLevel: z.number().min(0).max(100).nullable().optional(),
  reportsVersion: z.number().int().min(0).optional(),
  recalcState: recalcStateSchema,
});

function fullRecalcState(partial: z.infer<typeof recalcStateSchema>): RecalcState {
  return {
    ...EMPTY_RECALC_STATE,
    ...(partial ?? {}),
  };
}

/**
 * POST /api/adventure/[id]/cockpit — assemble les entrées réelles du cockpit
 * (plan version courante, prédictions persistées, sessions récentes) et
 * n'évalue le recalcul QUE via `evaluateRecalc` (anti-rebond 60 s). Le client
 * ne poste que sur déclencheur : jamais à chaque rendu React.
 *
 * Auth de session obligatoire ; l'appartenance du plan est appliquée par la
 * RLS du client injecté (plan inaccessible ⇒ 404, aucune fuite d'existence).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const parsedBody = cockpitBodySchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: 'Corps invalide',
          details: parsedBody.error.issues.map((issue) => issue.path.join('.')).join(', '),
        },
        { status: 400 }
      );
    }

    let featureFlags: Record<string, boolean> = {};
    try {
      featureFlags = (await currentAdventureFeatureFlags(user.id)) as unknown as Record<
        string,
        boolean
      >;
    } catch {
      featureFlags = {};
    }

    const result = await buildCockpitLiveData(
      {
        userId: user.id,
        planId: parsedId.data,
        trackingPositions: parsedBody.data.positions ?? [],
        offline: parsedBody.data.offline === true,
        batteryLevel: parsedBody.data.batteryLevel ?? null,
        reportsVersion: parsedBody.data.reportsVersion,
        recalcState: fullRecalcState(parsedBody.data.recalcState),
        featureFlags,
      },
      createSupabaseCockpitDataClient(session)
    );

    if (result.warnings.includes(COCKPIT_PLAN_NOT_FOUND_WARNING)) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(
      '[adventure/[id]/cockpit] erreur inattendue:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
