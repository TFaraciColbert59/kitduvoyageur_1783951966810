import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { OUTING_METRIC_KEYS } from '@/features/compte/domain/metricVisibility';
import {
  resetOutingMetricVisibility,
  saveOutingMetricVisibility,
} from '@/features/compte/server/outingShareMetrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();
const MetricVisibilityPatch = z
  .object({
    /**
     * Liste fermée des clés que le propriétaire accepte de publier. Une clé
     * absente vaut `false` : l'API n'invente jamais une autorisation.
     */
    visibility: z.array(z.enum(OUTING_METRIC_KEYS)).max(OUTING_METRIC_KEYS.length),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

async function parseRequest(context: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false as const, response: auth.response };
  const parsedId = Id.safeParse((await context.params).id);
  if (!parsedId.success) {
    return { ok: false as const, response: fail('not_found', 'Sortie introuvable.') };
  }
  return { ok: true as const, auth, id: parsedId.data };
}

export async function PUT(request: Request, context: RouteContext) {
  const parsed = await parseRequest(context);
  if (!parsed.ok) return parsed.response;

  const body = MetricVisibilityPatch.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail('not_found', 'Réglage de partage invalide.');

  try {
    const visibility = await saveOutingMetricVisibility(
      parsed.auth.supabase,
      parsed.auth.user.id,
      parsed.id,
      body.data.visibility
    );
    return ok({ status: 'updated', visibility });
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return fail('not_found', 'Sortie introuvable.');
    }
    return fail('server', 'Impossible d’enregistrer ce réglage de partage.');
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const parsed = await parseRequest(context);
  if (!parsed.ok) return parsed.response;

  try {
    await resetOutingMetricVisibility(
      parsed.auth.supabase,
      parsed.auth.user.id,
      parsed.id
    );
    return ok({ status: 'reset' });
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return fail('not_found', 'Sortie introuvable.');
    }
    return fail('server', 'Impossible de réinitialiser ce réglage de partage.');
  }
}
