import type { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/api/serviceClient';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit';

export interface RankingsRequestContext {
  /** `''` pour un visiteur non connecté : le contrat garde `isCurrentUser` faux. */
  viewerId: string;
  supabase: SupabaseClient;
  limited: NextResponse | null;
}

/**
 * Une seule entrée pour les routes rankings : auth, client de lecture
 * (service_role si disponible, sinon RLS de session) et quota anti-rafale.
 */
export async function resolveRankingsRequest(
  request: NextRequest,
  scope: string
): Promise<RankingsRequestContext> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  const viewerId = user?.id ?? '';

  const limited = await enforceRateLimit(viewerId || clientIpFromHeaders(request.headers), {
    scope,
    limit: 60,
    windowMs: 60_000,
    failMode: 'open',
  });

  const service = createServiceClient();
  return {
    viewerId,
    supabase: service ?? authClient,
    limited,
  };
}
