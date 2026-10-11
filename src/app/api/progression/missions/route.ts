import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  abandonProgressionMission,
  chooseProgressionMission,
  getUserMissions,
  replaceProgressionMission,
  type MissionMutationResult,
} from '@/features/progression/server/challengeService';

export const dynamic = 'force-dynamic';

/**
 * T13 — Missions du compte (≤ 3 actives). L'identité vient toujours de la
 * session serveur ; le corps ne porte qu'un choix de catalogue validé.
 * Aucune route ne permet de lire ou modifier les missions d'un autre compte.
 */
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } as const;

const mutationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('choose'), modelId: z.string().min(8).max(80) }),
  z.object({
    action: z.literal('replace'),
    assignmentId: z.string().min(30).max(60),
    modelId: z.string().min(8).max(80),
  }),
  z.object({ action: z.literal('abandon'), assignmentId: z.string().min(30).max(60) }),
]);

function mutationStatus(result: MissionMutationResult): number {
  if (result.ok) return 200;
  switch (result.reason) {
    case 'invalid_input':
      return 400;
    case 'limite_atteinte':
    case 'modele_non_publie':
      return 409;
    case 'assignation_introuvable':
      return 404;
    default:
      return 503;
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const limited = await enforceRateLimit(user.id, {
      scope: 'progression-missions',
      limit: 60,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const missions = await getUserMissions(user.id);
    return NextResponse.json({ success: true, missions }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error('[API /api/progression/missions] GET', err);
    return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const limited = await enforceRateLimit(user.id, {
      scope: 'progression-missions',
      limit: 60,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
    }
    const parsed = mutationSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
    }

    const body = parsed.data;
    const result =
      body.action === 'choose'
        ? await chooseProgressionMission(user.id, body.modelId)
        : body.action === 'replace'
          ? await replaceProgressionMission(user.id, body.assignmentId, body.modelId)
          : await abandonProgressionMission(user.id, body.assignmentId);

    const status = mutationStatus(result);
    if (result.ok) {
      return NextResponse.json(
        { success: true, assignmentId: result.assignmentId ?? null },
        { status, headers: NO_STORE_HEADERS }
      );
    }
    return NextResponse.json({ success: false, error: result.reason }, { status });
  } catch (err) {
    console.error('[API /api/progression/missions] POST', err);
    return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 });
  }
}
