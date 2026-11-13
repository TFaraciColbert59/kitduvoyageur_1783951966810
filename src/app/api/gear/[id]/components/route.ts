import { z } from 'zod';
import { fail, ok } from '@/lib/api/respond';
import { requireUser } from '@/lib/api/requireUser';
import { addGearComponent, GearError, replaceGearComponent } from '@/features/gear/server/mileage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();
const KINDS = ['chaine', 'pneus', 'plaquettes', 'plateau', 'cassette', 'derailleur', 'roue', 'autre'] as const;

const CreateBody = z
  .object({
    name: z.string().trim().min(1).max(120),
    kind: z.enum(KINDS).default('autre'),
    installedAtKm: z.number().min(0).max(10_000_000).nullable().optional().default(null),
    thresholdKm: z.number().positive().max(1_000_000).nullable().optional().default(null),
  })
  .strict();

const ReplaceBody = z
  .object({
    componentId: z.string().uuid(),
    replacedAtKm: z.number().min(0).max(10_000_000).nullable().optional(),
  })
  .strict();

function failure(error: unknown) {
  if (error instanceof GearError) {
    if (error.code === 'not_found') return fail('not_found', 'Matériel ou composant introuvable.');
    if (error.code === 'no_mileage') return fail('conflict', 'Aucun kilométrage mesuré pour dater le remplacement.');
    if (error.code === 'invalid') return fail('conflict', 'Valeur invalide.');
  }
  return fail('server', 'Impossible de mettre à jour les composants.');
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await params).id);
  if (!parsedId.success) return fail('not_found', 'Matériel introuvable.');
  const parsed = CreateBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('conflict', 'Composant invalide.');

  try {
    const component = await addGearComponent(auth.supabase, auth.user.id, parsedId.data, {
      name: parsed.data.name,
      kind: parsed.data.kind,
      installedAtKm: parsed.data.installedAtKm,
      thresholdKm: parsed.data.thresholdKm,
    });
    return ok({ component }, 201);
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await params).id);
  if (!parsedId.success) return fail('not_found', 'Matériel introuvable.');
  const parsed = ReplaceBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('conflict', 'Remplacement invalide.');

  try {
    const component = await replaceGearComponent(
      auth.supabase,
      auth.user.id,
      parsedId.data,
      parsed.data.componentId,
      parsed.data.replacedAtKm ?? null
    );
    return ok({ component });
  } catch (error) {
    return failure(error);
  }
}
