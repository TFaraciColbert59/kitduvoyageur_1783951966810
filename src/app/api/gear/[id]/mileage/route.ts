import { z } from 'zod';
import { fail, ok } from '@/lib/api/respond';
import { requireUser } from '@/lib/api/requireUser';
import {
  acknowledgeGearAlert,
  GearError,
  loadGearMileage,
  saveGearThreshold,
} from '@/features/gear/server/mileage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();
const ThresholdBody = z.object({ thresholdKm: z.number().positive().max(1_000_000).nullable() }).strict();
const AckBody = z.object({ action: z.enum(['seen', 'dismiss']) }).strict();

function failure(error: unknown) {
  if (error instanceof GearError) {
    if (error.code === 'not_found') return fail('not_found', 'Matériel introuvable.');
    if (error.code === 'invalid') return fail('conflict', 'Valeur invalide.');
    if (error.code === 'no_mileage') return fail('conflict', 'Aucun kilométrage mesuré pour ce matériel.');
    return fail('conflict', 'Le suivi de kilométrage n’est pas encore activé.');
  }
  return fail('server', 'Impossible de lire le kilométrage.');
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Id.safeParse((await params).id);
  if (!parsed.success) return fail('not_found', 'Matériel introuvable.');

  try {
    return ok(await loadGearMileage(auth.supabase, auth.user.id, parsed.data));
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await params).id);
  if (!parsedId.success) return fail('not_found', 'Matériel introuvable.');
  const parsed = ThresholdBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('conflict', 'Seuil invalide.');

  try {
    const settings = await saveGearThreshold(auth.supabase, auth.user.id, parsedId.data, parsed.data.thresholdKm);
    return ok({ settings });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await params).id);
  if (!parsedId.success) return fail('not_found', 'Matériel introuvable.');
  const parsed = AckBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('conflict', 'Action invalide.');

  try {
    const result = await acknowledgeGearAlert(
      auth.supabase,
      auth.user.id,
      parsedId.data,
      parsed.data.action
    );
    return ok(result);
  } catch (error) {
    return failure(error);
  }
}
