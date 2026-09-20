import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getTerritoryState,
  updateDeclaredTerritory,
  updatePrivateAttachment,
} from '@/features/progression/server/territoryService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const state = await getTerritoryState(user.id);
    return NextResponse.json({ success: true, ...state });
  } catch (err) {
    const message = 'Erreur lors de la lecture du territoire'; console.error('[API /api/progression/territory]', err);
    console.error('[API /api/progression/territory] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
    }

    const hasCoordinates =
      body.lat !== undefined || body.lng !== undefined || body.accuracy_m !== undefined;

    if (hasCoordinates) {
      const result = await updatePrivateAttachment(user.id, {
        lat: Number(body.lat),
        lng: Number(body.lng),
        accuracy_m: body.accuracy_m === undefined ? null : Number(body.accuracy_m),
        consent: body.consent === true,
        correction: body.correction === true,
      });

      if (!result.ok) {
        const status =
          result.error === 'consent_required' || result.error === 'invalid_coordinates' ? 400 : 409;
        return NextResponse.json({ success: false, error: result.error }, { status });
      }
      if (!('privateAttachment' in result)) {
        return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
      }

      return NextResponse.json({ success: true, privateAttachment: result.privateAttachment });
    }

    const result = await updateDeclaredTerritory(user.id, {
      city_code: typeof body.city_code === 'string' ? body.city_code : null,
      region_code: typeof body.region_code === 'string' ? body.region_code : null,
      country_code: typeof body.country_code === 'string' ? body.country_code : null,
      city_name: typeof body.city_name === 'string' ? body.city_name : null,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    if (!('declared' in result)) {
      return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
    }

    return NextResponse.json({ success: true, declared: result.declared });
  } catch (err) {
    const message = 'Erreur lors de la mise à jour du territoire'; console.error('[API /api/progression/territory]', err);
    console.error('[API /api/progression/territory] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
