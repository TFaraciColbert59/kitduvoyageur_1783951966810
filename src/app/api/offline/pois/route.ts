import { NextRequest, NextResponse } from 'next/server';
import { filterAndNormalizeOfflinePois, type OfflinePoiRecord } from '@/features/offline';
import { invalidBody, serverError } from '../_lib/http';
import { poisInputSchema } from '../_lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/offline/pois — filtre et normalise les POI/photos d’un paquet (K4.17).
 *
 * Route de préparation pure : un POI non autorisé, un média sans licence, une
 * URI à jeton temporaire ou une donnée `private_user` dans un paquet partagé
 * sont retirés. Aucune coordonnée, aucun média et aucun texte ne sont inventés.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Corps invalide', details: 'JSON attendu' },
        { status: 400 }
      );
    }

    const parsed = poisInputSchema.safeParse(body);
    if (!parsed.success) return invalidBody(parsed.error);

    const { pois, sharedPublicly } = parsed.data;
    const filtered = filterAndNormalizeOfflinePois(pois as OfflinePoiRecord[], {
      sharedPublicly,
    });

    const rawMediaCount = pois.reduce((total, poi) => total + poi.mediaAssets.length, 0);
    const keptMediaCount = filtered.reduce((total, poi) => total + poi.mediaAssets.length, 0);

    return NextResponse.json(
      {
        pois: filtered,
        keptPoiCount: filtered.length,
        droppedPoiCount: pois.length - filtered.length,
        keptMediaCount,
        droppedMediaCount: rawMediaCount - keptMediaCount,
        sharedPublicly,
      },
      { status: 200 }
    );
  } catch (error) {
    return serverError('offline/pois', error);
  }
}
