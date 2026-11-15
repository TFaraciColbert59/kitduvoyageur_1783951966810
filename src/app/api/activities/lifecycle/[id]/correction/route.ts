import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import {
  ActivityIdSchema,
  CorrectionSchema,
  createSupabaseLifecycleService,
  GpsSmoothingSchema,
} from '@/features/compte/server/lifecycle';
import { handleLifecycleError, rejected } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CorrectionBody =
  | { kind: 'gps_spikes'; maxPlausibleSpeedMs?: number }
  | ({ kind: 'distance_elevation' } & Record<string, unknown>);

/**
 * POST /api/activities/lifecycle/[id]/correction
 * Corps : `{ kind: 'distance_elevation', ...CorrectionSchema }` ou
 * `{ kind: 'gps_spikes', maxPlausibleSpeedMs? }`.
 *
 * Toute surcharge manuelle désactive l'éligibilité aux classements
 * automatiques GPS et laisse une révision annulable (S1.23).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const id = ActivityIdSchema.safeParse((await params).id);
  if (!id.success) return rejected('invalid_activity_id', 'Identifiant d’activité invalide.');

  const raw = (await request.json().catch(() => null)) as CorrectionBody | null;
  if (!raw || (raw.kind !== 'gps_spikes' && raw.kind !== 'distance_elevation')) {
    return rejected(
      'invalid_correction',
      'Type de correction attendu : « distance_elevation » ou « gps_spikes ».'
    );
  }

  try {
    const service = createSupabaseLifecycleService(auth.supabase);

    if (raw.kind === 'gps_spikes') {
      const parsed = GpsSmoothingSchema.safeParse({
        maxPlausibleSpeedMs: raw.maxPlausibleSpeedMs,
      });
      if (!parsed.success) {
        return rejected(
          'invalid_correction',
          parsed.error.issues[0]?.message ?? 'Correction GPS invalide.'
        );
      }
      const outcome = await service.smoothGpsSpikes(
        auth.user.id,
        id.data,
        parsed.data.maxPlausibleSpeedMs
      );
      if (outcome.ok === false) return rejected(outcome.code, outcome.error);
      return ok({ record: outcome.record, spikesRemoved: outcome.spikesRemoved });
    }

    const { kind: _kind, ...correction } = raw;
    const parsed = CorrectionSchema.safeParse(correction);
    if (!parsed.success) {
      return rejected(
        'invalid_correction',
        parsed.error.issues[0]?.message ?? 'Correction invalide.'
      );
    }
    const outcome = await service.correct(auth.user.id, id.data, parsed.data);
    if (outcome.ok === false) return rejected(outcome.code, outcome.error);
    return ok({ record: outcome.record, projectionEvent: outcome.projectionEvent });
  } catch (error) {
    return handleLifecycleError(error);
  }
}

/**
 * DELETE /api/activities/lifecycle/[id]/correction
 * Annule la dernière correction distance/D+ et restaure l'état mesuré
 * d'avant correction (S1.23).
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const id = ActivityIdSchema.safeParse((await params).id);
  if (!id.success) return rejected('invalid_activity_id', 'Identifiant d’activité invalide.');

  try {
    const service = createSupabaseLifecycleService(auth.supabase);
    const outcome = await service.revertCorrection(auth.user.id, id.data);
    if (outcome.ok === false) return rejected(outcome.code, outcome.error);
    return ok({ record: outcome.record, projectionEvent: outcome.projectionEvent });
  } catch (error) {
    return handleLifecycleError(error);
  }
}
