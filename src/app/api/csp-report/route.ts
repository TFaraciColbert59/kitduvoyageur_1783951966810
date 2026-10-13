import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { appErrorRow } from '@/lib/observability/appErrors';
import { rateLimit, clientIpFromHeaders, rateLimitHeaders } from '@/lib/rate-limit';
import { CSP_MAX_BODY_BYTES, CSP_SCOPE, cspMessage, parseCspReports } from '@/lib/security/cspReport';

export const dynamic = 'force-dynamic';

/**
 * Collecte des rapports de la CSP en `Report-Only` (plan 2.11), à 0 € : une ligne par violation
 * dans `app_errors` (scope `csp`, code = directive, message `<report|enforce> <hôte bloqué> <page>`).
 * Aucune donnée personnelle (voir `lib/security/cspReport.ts`). Lecture : `select * from
 * public.csp_report_summary(7)` dans le SQL Editor, ou la colonne `csp_reports` du rapport quotidien.
 *
 * Limites : 60 rapports par 10 minutes et par adresse (compteur de secours en mémoire s'il tombe) ;
 * 2 000 lignes par jour pour tout le site, au-delà ou compteur illisible on laisse tomber (204) :
 * un rapport perdu ne coûte rien, une base remplie coûte. Le navigateur ignore la réponse.
 */
const PER_IP = { limit: 60, windowMs: 10 * 60_000 };
const SITE_PER_DAY = 2_000;
const INSERT_TIMEOUT_MS = 2_000;

export async function POST(req: Request) {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > CSP_MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (text.length > CSP_MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
  const violations = parseCspReports(text);
  if (violations.length === 0) return new NextResponse(null, { status: 400 });

  const mine = await rateLimit({
    key: `csp:ip:${clientIpFromHeaders(req.headers)}`,
    limit: PER_IP.limit,
    windowMs: PER_IP.windowMs,
    failMode: 'open',
  });
  if (!mine.allowed) return new NextResponse(null, { status: 429, headers: rateLimitHeaders(mine) });

  const client = getServiceSupabase();
  if (!client) return new NextResponse(null, { status: 204 });

  const day = new Date().toISOString().slice(0, 10);
  for (const v of violations) {
    const site = await rateLimit({
      key: `csp:site:${day}`,
      limit: SITE_PER_DAY,
      windowMs: 86_400_000,
      failMode: 'closed',
    });
    if (!site.allowed) break;
    const row = { ...appErrorRow(CSP_SCOPE, cspMessage(v)), code: v.directive };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const outcome = await Promise.race([
        Promise.resolve(client.from('app_errors').insert(row)),
        new Promise<'timeout'>((resolve) => {
          timer = setTimeout(() => resolve('timeout'), INSERT_TIMEOUT_MS);
        }),
      ]);
      if (outcome === 'timeout') console.warn('[csp-report] délai dépassé');
      else if (outcome.error) console.warn('[csp-report]', outcome.error.code);
    } catch {
      // Un rapport perdu ne fait pas échouer la réponse.
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return new NextResponse(null, { status: 204 });
}
