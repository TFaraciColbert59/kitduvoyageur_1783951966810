import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '@/features/compte/server/compte';
import { invalidateUserCache } from '@/lib/perf/userMemo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Preference = z
  .object({
    type: z.string().trim().min(1).max(64),
    inApp: z.boolean().optional(),
    email: z.boolean().optional(),
    push: z.boolean().optional(),
  })
  .strict();

const Categories = z
  .object({
    social: z.boolean().optional(),
    loans: z.boolean().optional(),
    orders: z.boolean().optional(),
    system: z.boolean().optional(),
  })
  .strict();

const Patch = z
  .object({
    preferences: z.array(Preference).max(80).optional(),
    categories: Categories.optional(),
  })
  .strict();

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    return ok(await loadNotificationPreferences(auth.supabase, auth.user.id));
  } catch {
    return fail('server', 'Impossible de charger tes réglages de notifications.');
  }
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Réglage de notification invalide.');
  const hasPreferences = (parsed.data.preferences?.length ?? 0) > 0;
  const hasCategories = Object.keys(parsed.data.categories ?? {}).length > 0;
  if (!hasPreferences && !hasCategories) {
    return fail('not_found', 'Aucun réglage à enregistrer.');
  }
  try {
    const payload = await saveNotificationPreferences(auth.supabase, auth.user.id, parsed.data);
    invalidateUserCache(auth.user.id);
    return ok(payload);
  } catch (error) {
    if (error instanceof Error && error.message === 'unknown_notification_type') {
      return fail('conflict', 'Ce type de notification n’est pas reconnu.');
    }
    return fail('server', 'Impossible d’enregistrer tes réglages de notifications.');
  }
}
