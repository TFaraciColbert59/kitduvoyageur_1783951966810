import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getHubAdventureData } from '@/features/hub/server/getHubAdventureData';
import { bagFromCorps, configFromRows, getStudioData } from '@/features/kit-studio/server/getStudioData';

const noStore = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ reason: 'auth' }, { status: 401, headers: noStore });

  const { trip } = await getHubAdventureData();
  const kitId = new URL(request.url).searchParams.get('kit');
  if (!kitId || kitId !== trip?.kit_id) {
    return NextResponse.json({ reason: 'unassigned' }, { status: 404, headers: noStore });
  }

  const rows = await supabase.from('one_bag_configs').select('kit_id,corps_id,modules,colors')
    .eq('user_id', user.id).eq('kit_id', kitId).limit(1).maybeSingle();
  if (rows.error) return NextResponse.json({ reason: 'unavailable' }, { status: 503, headers: noStore });
  if (!rows.data || !bagFromCorps(rows.data.corps_id)) return NextResponse.json({ reason: 'no_configuration' }, { status: 404, headers: noStore });

  try {
    const { kits, items, one, colorways, families } = await getStudioData(user.id, kitId, supabase);
    const kit = kits.find((candidate) => candidate.id === kitId);
    if (!kit) return NextResponse.json({ reason: 'unassigned' }, { status: 404, headers: noStore });
    const config = configFromRows([rows.data], colorways, null);
    const packedIds = new Set(Object.values(kit.packed).flat());
    return NextResponse.json({ kit, items: items.filter((item) => packedIds.has(item.id)), one, config, colorways, families },
      { headers: noStore });
  } catch {
    return NextResponse.json({ reason: 'unavailable' }, { status: 503, headers: noStore });
  }
}
