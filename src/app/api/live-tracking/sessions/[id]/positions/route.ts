import { z } from 'zod';

import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { getLiveTrackingRuntime } from '@/features/compte/live-tracking/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().trim().min(1).max(128);
const Position = z
  .object({
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
    accuracyM: z.number().finite().nonnegative().max(100_000).nullish(),
    altitudeM: z.number().finite().min(-500).max(10_000).nullish(),
    headingDeg: z.number().finite().min(0).max(360).nullish(),
    speedMps: z.number().finite().min(0).max(150).nullish(),
    recordedAtMs: z.number().int().nonnegative().optional(),
    monotonicMs: z.number().int().nonnegative().optional(),
  })
  .strict();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const id = Id.safeParse((await params).id);
  if (!id.success) return fail('not_found', 'Séance introuvable.');

  try {
    const result = await getLiveTrackingRuntime().listPositions(auth.user.id, id.data);
    if (!result.ok) return fail('not_found', 'Séance introuvable.');
    return ok({ points: result.points });
  } catch {
    return fail('server', 'Impossible de charger les positions.');
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const id = Id.safeParse((await params).id);
  if (!id.success) return fail('not_found', 'Séance introuvable.');
  const body = Position.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail('conflict', 'Position invalide.');

  try {
    const result = await getLiveTrackingRuntime().publishPosition(auth.user.id, {
      sessionId: id.data,
      lat: body.data.lat,
      lng: body.data.lng,
      accuracyM: body.data.accuracyM ?? null,
      altitudeM: body.data.altitudeM ?? null,
      headingDeg: body.data.headingDeg ?? null,
      speedMps: body.data.speedMps ?? null,
      recordedAtMs: body.data.recordedAtMs ?? Date.now(),
      monotonicMs: body.data.monotonicMs,
    });
    if (!result.ok) {
      if (result.error === 'unauthorized') return fail('forbidden', 'Séance non autorisée.');
      if (result.error === 'invalid_position') return fail('conflict', 'Position invalide.');
      return fail('conflict', 'La séance n’est plus active.');
    }
    return ok({ status: 'recorded' }, 201);
  } catch {
    return fail('server', 'Impossible d’enregistrer la position.');
  }
}
