import { NextRequest, NextResponse } from 'next/server';
import { getTripBySlug } from '@/lib/queries-trips';
import { generateTripGpx } from '@/features/trips/engine/exportEngine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const token = request.nextUrl.searchParams.get('token') || undefined;

    const trip = await getTripBySlug(slug, token);

    if (!trip) {
      return new NextResponse('Voyage introuvable ou non autorisé', { status: 404 });
    }

    const gpxContent = generateTripGpx(trip);
    const filename = `${trip.slug || 'itineraire'}.gpx`;

    return new NextResponse(gpxContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/gpx+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    console.error('[LKDV GPX] Erreur génération GPX:', err);
    return new NextResponse('Erreur serveur lors de la génération du fichier GPX', {
      status: 500,
    });
  }
}
