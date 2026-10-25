import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  createSupabaseShadowClient,
  runAdventureShadows,
} from '@/features/adventure-intelligence/server/shadowRuns';
import { SHADOW_FLAGS, type ShadowFlag } from '@/features/adventure-intelligence/domain/shadowMode';

export const dynamic = 'force-dynamic';

/**
 * Cron A10 (10.10) — shadow runners : comparaison silencieuse V1/V2.
 * Déclencheur externe avec `Authorization: Bearer ${CRON_SECRET}`.
 * Les flags shadow sont lus en direct via service_role (la RPC
 * `current_feature_flags` est réservée à `authenticated` et retomberait sur
 * les défauts en contexte cron). Aucun flag activé ⇒ aucun échantillon lu.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
  }

  const { data, error } = await supabase
    .from('feature_flags')
    .select('id, enabled')
    .in('id', [...SHADOW_FLAGS]);
  if (error) {
    console.error('[adventure-intelligence/cron/shadows] flags en échec:', error.message);
    return NextResponse.json({ error: 'Flags indisponibles' }, { status: 502 });
  }

  const byId = new Map(
    ((data ?? []) as { id: string; enabled: boolean }[]).map((row) => [row.id, row.enabled])
  );
  const flags: Partial<Record<ShadowFlag, boolean>> = {};
  for (const flag of SHADOW_FLAGS) {
    flags[flag] = byId.get(flag) === true;
  }

  try {
    const result = await runAdventureShadows(createSupabaseShadowClient(supabase), { flags });
    return NextResponse.json(result);
  } catch (runError) {
    console.error(
      '[adventure-intelligence/cron/shadows] exécution en échec:',
      runError instanceof Error ? runError.message : runError
    );
    return NextResponse.json({ error: 'Shadow runners indisponibles' }, { status: 502 });
  }
}
