import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { parseProviderId, oauthStartBodySchema } from '@/lib/connectors/schemas';
import { beginConnectorOAuth } from '@/lib/connectors/service';
import { hydrateConnectorConsentFromDb } from '@/lib/connectors/consents';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Démarre OAuth 2.0 + PKCE ; aucune URL factice sans credentials. */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const providerId = parseProviderId((await params).provider);
  if (!providerId) return fail('bad_request', 'Connecteur partenaire inconnu.');

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Pas de corps : le retour par défaut est /compte/connecteurs.
  }
  const parsed = oauthStartBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return fail('bad_request', 'Demande OAuth invalide.');
  }

  await hydrateConnectorConsentFromDb(auth.user.id, auth.supabase);
  const started = beginConnectorOAuth({
    userId: auth.user.id,
    providerId,
    origin: new URL(request.url).origin,
    returnTo: parsed.data.returnTo,
  });

  if (!started.ok) {
    if (started.failure.status === 'conflict') {
      return fail('conflict', started.failure.error);
    }
    if (started.failure.status === 'invalid_request') {
      return NextResponse.json(
        { error: started.failure.error, code: 'invalid_request' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      {
        error: started.failure.error,
        code: started.failure.status,
        missingEnvVars: started.failure.missingEnvVars,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return ok(started.response);
}
