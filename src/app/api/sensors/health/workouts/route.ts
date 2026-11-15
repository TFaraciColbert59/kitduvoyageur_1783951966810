import { evaluateHealthWorkouts, healthWorkoutsRequestSchema } from '../../_lib/workouts';
import { invalidPayload, jsonNoStore, readJsonBody } from '../../_lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/sensors/health/workouts
 *
 * Pré-vol sans effet de bord : déduplication des séances lues ou détection
 * d'un doublon avant écriture native. Aucune séance n'est créée ici et aucune
 * valeur absente n'est complétée.
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body === null) return invalidPayload('Corps JSON invalide.');

  const parsed = healthWorkoutsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return invalidPayload(
      'Séance Santé invalide.',
      parsed.error.issues.map((issue) => issue.path.join('.')),
    );
  }

  return jsonNoStore(evaluateHealthWorkouts(parsed.data));
}
