import { NextRequest, NextResponse } from 'next/server';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { compasSources } from '@/features/compas/server/sources';

/**
 * Les sources gratuites que ce déploiement peut appeler : présence de chaque
 * clé (vrai/faux), jamais une valeur. Sert à vérifier qu'une clé posée dans
 * Vercel est bien lue, sans rien en révéler.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'compas-sources',
    limit: 20,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;
  return NextResponse.json(compasSources(), { headers: { 'Cache-Control': 'no-store' } });
}
