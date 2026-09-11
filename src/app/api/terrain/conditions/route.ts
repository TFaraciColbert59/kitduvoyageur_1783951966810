import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  createSupabaseTerrainReportsClient,
  listNearbyTerrainReports,
} from '@/features/adventure-intelligence/server/terrainReports';
import { currentAdventureFeatureFlags } from '@/features/adventure-intelligence/server/featureFlags';

export const dynamic = 'force-dynamic';

const nearbyQuerySchema = z.object({
  lat: z
    .number()
    .min(-90, 'lat doit être compris entre -90 et 90')
    .max(90, 'lat doit être compris entre -90 et 90'),
  lng: z
    .number()
    .min(-180, 'lng doit être compris entre -180 et 180')
    .max(180, 'lng doit être compris entre -180 et 180'),
  radius: z
    .number()
    .min(1, 'radius doit être au moins 1 mètre')
    .max(50000, 'radius ne peut pas dépasser 50 000 mètres')
    .optional(),
});

function zodDetails(error: z.ZodError): string {
  return error.issues.map((issue) => issue.path.join('.')).join(', ');
}

/**
 * GET /api/terrain/conditions?lat&lng&radius — signalements confirmés/actifs
 * non expirés autour d'un point. Lecture de la vue publique (aucune identité,
 * jamais `reporter_id`) via la RPC A5, triée par distance.
 */
export async function GET(request: NextRequest) {
  try {
    const latRaw = request.nextUrl.searchParams.get('lat');
    const lngRaw = request.nextUrl.searchParams.get('lng');
    if (latRaw === null || lngRaw === null || latRaw === '' || lngRaw === '') {
      return NextResponse.json(
        { error: 'Paramètres invalides', details: 'lat et lng sont requis' },
        { status: 400 }
      );
    }

    const parsed = nearbyQuerySchema.safeParse({
      lat: Number(latRaw),
      lng: Number(lngRaw),
      radius:
        request.nextUrl.searchParams.get('radius') === null
          ? undefined
          : Number(request.nextUrl.searchParams.get('radius')),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Paramètres invalides', details: zodDetails(parsed.error) },
        { status: 400 }
      );
    }

    const flags = await currentAdventureFeatureFlags();
    if (flags.terrain_live !== true) {
      return NextResponse.json({ error: 'Fonctionnalité non activée' }, { status: 503 });
    }

    const supabase = getServiceSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }

    const reports = await listNearbyTerrainReports(
      { lat: parsed.data.lat, lng: parsed.data.lng, radiusM: parsed.data.radius },
      createSupabaseTerrainReportsClient(supabase)
    );

    return NextResponse.json({ reports });
  } catch (err) {
    console.error(
      '[terrain/conditions] erreur inattendue:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
