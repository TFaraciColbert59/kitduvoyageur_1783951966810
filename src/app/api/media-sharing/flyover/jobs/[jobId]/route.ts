import { badRequest, invalidJson, json, readJson, serverError } from '../../../_http';
import {
  flyoverJobUpdateSchema,
  getFlyoverJob,
  revokeFlyoverTrack,
  updateFlyoverJob,
} from '@/components/media-sharing/server/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Context {
  params: Promise<{ jobId: string }>;
}

/** GET /api/media-sharing/flyover/jobs/[jobId] */
export async function GET(_request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = getFlyoverJob(jobId);
  if (!job) {
    return json({ error: 'Rendu introuvable', code: 'job_not_found' }, 404);
  }
  return json(job);
}

/**
 * PATCH /api/media-sharing/flyover/jobs/[jobId]
 * `ready` publie l'URL de sortie ; `failed` conserve la raison. Un job révoqué
 * ne peut plus être complété (le contrat retourne null).
 */
export async function PATCH(request: Request, context: Context) {
  const { jobId } = await context.params;
  const body = await readJson(request);
  if (!body.ok) return invalidJson();

  const parsed = flyoverJobUpdateSchema.safeParse(body.value);
  if (!parsed.success) return badRequest(parsed.error);

  try {
    const updated = updateFlyoverJob(jobId, parsed.data);
    if (!updated) {
      return json(
        { error: 'Rendu introuvable ou révoqué', code: 'job_not_updatable' },
        409,
      );
    }
    return json(updated);
  } catch (error) {
    return serverError('flyover/jobs/[jobId]', error);
  }
}

/**
 * DELETE /api/media-sharing/flyover/jobs/[jobId]
 * Révoque tous les rendus d'une trace (le job ciblé doit exister). Le corps
 * porte le `trackId` pour rester compatible avec les clients sans query.
 */
export async function DELETE(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = getFlyoverJob(jobId);
  if (!job) {
    return json({ error: 'Rendu introuvable', code: 'job_not_found' }, 404);
  }

  let trackId = job.trackId;
  try {
    const body = (await request.json()) as { trackId?: unknown };
    if (typeof body.trackId === 'string' && body.trackId.length > 0) {
      trackId = body.trackId;
    }
  } catch {
    /* corps absent : on révoque la trace du job */
  }

  const revoked = revokeFlyoverTrack(trackId);
  return json({ ok: true, trackId, revoked });
}
