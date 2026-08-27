import { NextResponse } from 'next/server';
import { getTrails } from '@/lib/queries/trails';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const difficulty = searchParams.get('difficulty');
    const minDist = searchParams.get('minDist') ? parseFloat(searchParams.get('minDist')!) : 0;
    const maxDist = searchParams.get('maxDist') ? parseFloat(searchParams.get('maxDist')!) : null;

    const trails = await getTrails({
      search,
      difficulty,
      minDist,
      maxDist,
      includeShort: true,
    });

    return NextResponse.json(
      { trails },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
        },
      }
    );
  } catch (err: any) {
    console.error('API /api/trails error:', err);
    return NextResponse.json({ error: err.message, trails: [] }, { status: 500 });
  }
}
