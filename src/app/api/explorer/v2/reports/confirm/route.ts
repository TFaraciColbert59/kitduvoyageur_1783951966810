import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  reportId: z.string().uuid(),
  verdict: z.enum(['present', 'gone']),
});

/**
 * Confirmation communautaire : « toujours là » (`explorer_confirm_report`) ou
 * « plus là » (`explorer_mark_report_gone`). Le jeton utilisateur est requis :
 * un signalement ne se corrobore pas anonymement.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'authentification requise' }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'verdict invalide' }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'configuration absente' }, { status: 503 });

  const fn = parsed.data.verdict === 'present' ? 'explorer_confirm_report' : 'explorer_mark_report_gone';
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_report_id: parsed.data.reportId }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'refusé', detail: (await res.text()).slice(0, 200) }, { status: res.status });
    }
    return NextResponse.json({ status: 'ok', result: await res.json() });
  } catch (error) {
    console.error('[explorer-v2] reports confirm', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
