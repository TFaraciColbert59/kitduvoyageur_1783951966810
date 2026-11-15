import { evaluateTelemetry, telemetryRequestSchema } from '../_lib/telemetry';
import { invalidPayload, jsonNoStore, readJsonBody } from '../_lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/sensors/telemetry
 *
 * Décode des trames GATT brutes (base64) et retourne un instantané qualifié.
 * Une trame illisible est rejetée et comptée ; elle ne devient jamais une
 * mesure. Aucune valeur n'est inventée pour les métriques absentes.
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body === null) return invalidPayload('Corps JSON invalide.');

  const parsed = telemetryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return invalidPayload(
      'Trame de télémétrie invalide.',
      parsed.error.issues.map((issue) => issue.path.join('.')),
    );
  }

  return jsonNoStore(evaluateTelemetry(parsed.data));
}
