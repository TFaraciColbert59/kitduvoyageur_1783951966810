import { z } from 'zod';
import { fail, ok } from '@/lib/api/respond';
import { requireUser } from '@/lib/api/requireUser';
import { associateGearToOuting, loadGearCatalogForOuting } from '@/features/gear/server/catalog';
import { GearError } from '@/features/gear/server/mileage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();
const AssociateBody = z.object({ gearItemId: z.string().uuid() }).strict();

function failure(error: unknown) {
  if (error instanceof GearError) {
    if (error.code === 'not_found') return fail('not_found', 'Sortie ou matériel introuvable.');
    if (error.code === 'migration_required') return fail('conflict', 'L’association de matériel n’est pas encore activée.');
  }
  return fail('server', 'Impossible de lire le matériel de cette sortie.');
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Id.safeParse((await params).id);
  if (!parsed.success) return fail('not_found', 'Sortie introuvable.');

  try {
    return ok(await loadGearCatalogForOuting(auth.supabase, auth.user.id, parsed.data));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await params).id);
  if (!parsedId.success) return fail('not_found', 'Sortie introuvable.');
  const parsed = AssociateBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('conflict', 'Matériel invalide.');

  try {
    const result = await associateGearToOuting(
      auth.supabase,
      auth.user.id,
      parsedId.data,
      parsed.data.gearItemId
    );
    return ok(result, result.status === 'attached' ? 201 : 200);
  } catch (error) {
    return failure(error);
  }
}
