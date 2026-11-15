import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { revokeAllOutingShareLinks } from '@/features/compte/server/privacyZones';
import { updateOuting } from '@/features/compte/server/sorties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BulkVisibilitySchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    visibility: z.enum(['private', 'followers', 'public', 'collective_anonymized']),
  })
  .strict();

/**
 * S6.13 — Modification de visibilité en lot avec révocation immédiate des liens
 * de partage lorsque la sortie redevient privée.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = BulkVisibilitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('bad_request', 'Sélection ou visibilité invalide.');

  const updated: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  for (const id of parsed.data.ids) {
    try {
      await updateOuting(auth.supabase, auth.user.id, id, {
        visibility: parsed.data.visibility,
      });
      if (parsed.data.visibility === 'private') {
        await revokeAllOutingShareLinks(auth.supabase, auth.user.id, id).catch(() => undefined);
      }
      updated.push(id);
    } catch (error) {
      failed.push({
        id,
        reason: error instanceof Error && error.message === 'not_found' ? 'not_found' : 'update_failed',
      });
    }
  }

  return ok({
    updated,
    failed,
    visibility: parsed.data.visibility,
  });
}
