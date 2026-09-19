import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/** Taille du lot consommé par exécution de cron. */
const OUTBOX_LIMIT = 50;

/**
 * Cron P1 — consomme l'outbox de progression : journal, cumuls, saison, niveau.
 * Déclencheur externe avec `Authorization: Bearer ${CRON_SECRET}`. La RPC
 * `process_progression_outbox` est atomique et concurrente (`SKIP LOCKED`).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 503 });
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc('process_progression_outbox', {
    p_limit: OUTBOX_LIMIT,
  });
  if (error) {
    console.error('[progression/cron] consommation en échec:', error.message);
    return NextResponse.json({ error: 'Consommation indisponible' }, { status: 502 });
  }

  const result = (data ?? { processed: 0, failed: 0 }) as { processed?: number; failed?: number };
  return NextResponse.json({ processed: result.processed ?? 0, failed: result.failed ?? 0 });
}
