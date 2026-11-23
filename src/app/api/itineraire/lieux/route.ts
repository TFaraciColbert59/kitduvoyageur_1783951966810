// Lieux réels autour des étapes d'un itinéraire (nuits, eau, ravitaillement, sorties) pour /compas/itineraire.
//
// Même source que le tiroir « Jour » du Compas v5 : OpenStreetMap (Overpass, ODbL), lue par
// `lookupStagePois` et partagée une semaine entre tous (cache Supabase). Rien n'est inventé : une panne
// d'Overpass rend une liste vide et `partial: true`, jamais un lieu fabriqué. Le classement des nuits
// (`rankStayOptions`) et les prix de barème se font côté page, sur ces lieux.
//
// Entrée validée par zod ; lecture seule, limitée par IP (le service public Overpass est partagé par tout le site).
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { lookupStagePois } from '@/features/compas/server/stagePoiLookup';
import { STAGE_POI_MAX_PLACES } from '@/features/compas/engine/stagePois';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const dynamic = 'force-dynamic';

const RATE_LIMIT = {
  scope: 'itineraire-lieux',
  limit: 30,
  windowMs: 60_000,
  failMode: 'open' as const,
};

const bodySchema = z
  .object({
    points: z
      .array(
        z.object({
          lat: z.number().finite().min(-90).max(90),
          lon: z.number().finite().min(-180).max(180),
        }),
      )
      .min(1)
      .max(STAGE_POI_MAX_PLACES),
  })
  .strict();

const SOURCE = 'OpenStreetMap (Overpass), contributeurs OpenStreetMap, ODbL';

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), RATE_LIMIT);
  if (limited) return limited;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ status: 'invalid', reason: 'json_invalide' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ status: 'invalid', reason: 'points_invalides' }, { status: 400 });
  }

  try {
    const found = await lookupStagePois(parsed.data.points);
    return NextResponse.json(
      {
        status: 'ok',
        pois: found.pois,
        partial: found.partial,
        fetchedAt: new Date().toISOString(),
        source: SOURCE,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    // Le service public n'a pas répondu : l'écran dit « lieux indisponibles », sans valeur comblée.
    return NextResponse.json(
      { status: 'unavailable', pois: [], partial: true, fetchedAt: new Date().toISOString(), source: SOURCE },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
