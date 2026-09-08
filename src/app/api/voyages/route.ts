import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPublicTrips, createTrip } from '@/lib/queries-trips';
import { tripFiltersSchema } from '@/features/trips/schemas/trip.schema';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    const filters = tripFiltersSchema.parse(rawParams);

    const result = await getPublicTrips(filters);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    // M8: Protection CSRF sur les mutations
    const origin = request.headers.get('origin');
    if (origin) {
      try {
        const originHost = new URL(origin).host;
        const requestHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
        if (requestHost && originHost !== requestHost) {
          return NextResponse.json({ error: 'Origine de requête non autorisée' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Origine invalide' }, { status: 403 });
      }
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const trip = await createTrip(body, user.id);
    return NextResponse.json(trip, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
