import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { parseProviderId } from '@/lib/connectors/schemas';
import { completeConnectorOAuth } from '@/lib/connectors/service';
import { hydrateConnectorConsentFromDb } from '@/lib/connectors/consents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redirectToAccount(
  request: NextRequest,
  params: Record<string, string>,
  path = '/compte/connecteurs'
): NextResponse {
  const safePath = path.startsWith('/') && !path.startsWith('//') ? path : '/compte/connecteurs';
  const url = new URL(safePath, request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

/** Callback OAuth : état à usage unique, PKCE vérifié, aucun jeton exposé. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const providerId = parseProviderId((await params).provider);
  if (!providerId) return redirectToAccount(request, { oauth_error: 'Connecteur partenaire inconnu.' });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(new URL(`/connexion?next=${next}`, request.url));
  }

  const errorParam = request.nextUrl.searchParams.get('error');
  if (errorParam) {
    return redirectToAccount(request, { oauth_error: `Autorisation refusée par le partenaire (${errorParam}).` });
  }

  await hydrateConnectorConsentFromDb(user.id, supabase);

  const state = request.nextUrl.searchParams.get('state');
  if (!state) return redirectToAccount(request, { oauth_error: 'État OAuth absent.' });

  const result = await completeConnectorOAuth({
    providerId,
    state,
    code: request.nextUrl.searchParams.get('code'),
    userId: user.id,
  });

  if (!result.ok) {
    return redirectToAccount(request, { oauth_error: result.error, oauth_status: result.status });
  }

  return redirectToAccount(request, { connected: result.providerId }, result.redirectTo);
}
