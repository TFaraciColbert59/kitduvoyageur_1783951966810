import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { resolveAssistantIdentity } from '@/features/ai-assistant/server/identity';
import { createSupabaseHistoryConsentPort } from '@/features/ai-assistant/history/consent';
import { describeHistoryConnections } from '@/features/ai-assistant/history/connections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * S2.38 — accès et révocation côté Compte.
 * GET     : état du consentement et des connexions Claude / Gemini.
 * POST    : accorde le consentement personnel_performance (connexion).
 * DELETE  : révoque le consentement ; la purge RGPD existante est déclenchée.
 * Aucune table nouvelle, aucune clé inventée.
 */
export async function GET(request: NextRequest) {
  const identity = await resolveAssistantIdentity(request);
  if (!identity) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });

  const consent = createSupabaseHistoryConsentPort(identity.supabase);
  const granted = await consent.isGranted(identity.user.id);
  return NextResponse.json(describeHistoryConnections(granted));
}

export async function POST(request: NextRequest) {
  const identity = await resolveAssistantIdentity(request);
  if (!identity) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });

  if (identity.auth === 'bearer') {
    return NextResponse.json(
      { error: 'Gestion des connexions réservée à la surface Compte' },
      { status: 403 }
    );
  }

  const limited = await enforceRateLimit(identity.user.id, {
    scope: 'ai-assistant-connections-write',
    limit: 10,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const consent = createSupabaseHistoryConsentPort(identity.supabase);
  const result = await consent.grant(identity.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: 'Consentement non enregistré', details: result.error }, { status: 503 });
  }
  return NextResponse.json(describeHistoryConnections(true));
}

export async function DELETE(request: NextRequest) {
  const identity = await resolveAssistantIdentity(request);
  if (!identity) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });

  if (identity.auth === 'bearer') {
    return NextResponse.json(
      { error: 'Gestion des connexions réservée à la surface Compte' },
      { status: 403 }
    );
  }

  const limited = await enforceRateLimit(identity.user.id, {
    scope: 'ai-assistant-connections-write',
    limit: 10,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const consent = createSupabaseHistoryConsentPort(identity.supabase);
  const result = await consent.revoke(identity.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: 'Révocation non enregistrée', details: result.error }, { status: 503 });
  }
  return NextResponse.json(describeHistoryConnections(false));
}
