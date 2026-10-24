import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { loadProfileSettings, updateProfileSettings } from '@/features/compte/server/compte';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Link = z
  .object({
    label: z.string().trim().max(40),
    url: z.string().trim().url().max(300),
  })
  .strict();

const Patch = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    handle: z.string().trim().min(3).max(24).optional(),
    bio: z.string().max(160).optional(),
    location: z.string().max(80).optional(),
    avatarUrl: z.string().trim().max(600).nullable().optional(),
    coverUrl: z.string().trim().max(600).nullable().optional(),
    links: z.array(Link).max(3).optional(),
    visibility: z.enum(['public', 'prive']).optional(),
    notificationPrefs: z
      .object({
        social: z.boolean().optional(),
        loans: z.boolean().optional(),
        orders: z.boolean().optional(),
        system: z.boolean().optional(),
        quietHours: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    return ok(await loadProfileSettings(auth.supabase, auth.user.id, auth.user.email ?? ''));
  } catch {
    return fail('server', 'Impossible de charger ton profil.');
  }
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Modification invalide.');
  try {
    const settings = await updateProfileSettings(auth.supabase, auth.user.id, parsed.data);
    return ok(settings);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'handle_taken') return fail('conflict', 'Ce handle est déjà pris.');
    if (code === 'invalid_handle') return fail('conflict', 'Handle invalide (3 à 24 lettres, chiffres ou _).');
    if (code === 'invalid_bio') return fail('conflict', 'La bio est limitée à 160 caractères.');
    if (code === 'bio_link') return fail('conflict', 'La bio ne peut pas contenir de lien.');
    if (code === 'invalid_url') return fail('conflict', 'Le lien doit commencer par http:// ou https://.');
    if (code === 'invalid_name') return fail('conflict', 'Le nom ne peut pas être vide.');
    return fail('server', 'Impossible d’enregistrer ton profil.');
  }
}
