import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import { validateWatchFieldLayout } from '@/features/compte/server/watches';
import { WatchFieldLayoutSchema } from '@/features/compte/server/watches/validation';
import { handleWatchError, readJson, rejected } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/watches/fields/validate — valide une disposition de champs. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const raw = await readJson(request);
  const candidate =
    raw && typeof raw === 'object' && 'config' in raw
      ? (raw as { config: unknown }).config
      : raw;
  const parsed = WatchFieldLayoutSchema.safeParse(candidate);
  if (!parsed.success) {
    return rejected(
      'invalid_layout',
      parsed.error.issues[0]?.message ?? 'Disposition de champs invalide.',
    );
  }

  try {
    return ok(validateWatchFieldLayout(auth.user.id, parsed.data));
  } catch (error) {
    return handleWatchError(error);
  }
}
