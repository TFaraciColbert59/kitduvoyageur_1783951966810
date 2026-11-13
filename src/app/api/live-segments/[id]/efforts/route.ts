import { NextResponse } from 'next/server';
import { getLiveSegment } from '@/lib/live-segments/server/catalog';
import {
  EffortSubmissionSchema,
  validateEffortSubmission,
} from '@/lib/live-segments/server/validation';
import {
  LIVE_SEGMENTS_NO_STORE,
  notFound,
  readJsonBody,
  rejected,
} from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/live-segments/[id]/efforts
 *
 * Scelle un effort terminé côté appareil. Le serveur rejoue la validation
 * (version, sport, sens, couverture, vitesse plausible) et renvoie le verdict
 * qui fait foi ; `isValidForLeaderboard`, `beatPr` et `beatKom` ne sont jamais
 * repris du client. La persistance du classement appartient au lot S02.
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  const entry = getLiveSegment(id);
  if (!entry) return notFound();

  const body = await readJsonBody(request);
  const parsed = EffortSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return rejected({
      code: 'invalid_effort',
      message: parsed.error.issues[0]?.message ?? 'Effort invalide.',
    });
  }

  if (parsed.data.segmentId !== id) {
    return rejected({
      code: 'segment_mismatch',
      message: 'L’effort ne correspond pas au segment demandé.',
    });
  }

  const verdict = validateEffortSubmission(parsed.data, entry.definition);
  if (verdict.ok === false) {
    return rejected({ code: verdict.code, message: verdict.message });
  }

  return NextResponse.json(
    {
      accepted: true,
      effort: verdict.effort,
      segmentId: entry.definition.id,
      dataSource: entry.dataSource,
      /** Le classement n'est pas encore branché sur ce lot. */
      persisted: false,
    },
    { headers: LIVE_SEGMENTS_NO_STORE },
  );
}
